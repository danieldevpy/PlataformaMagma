# Plan 027 — Resiliência do n8n

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| Infra dev | `plataforma/n8n/docker-compose.dev.yml` — versão fixada, poda de execuções, limite de memória | `plataforma/n8n/README.md` |
| Infra prod | `plataforma/docker-compose.prod.yml` — idem + watchdog | `plataforma/README.md` |
| n8n | `mag-fase-0-sdr.json` — timeout no nó do agente (as duas pistas: SDR e Operadora) | `plataforma/n8n/workflows/README.md` |
| Backend | (talvez) ação de alarme reusando `listar_gestores` — só se o watchdog não puder avisar direto | spec 019-T9 |
| Docs | `.context/decisoes.md` (ADR do achado), `.context/status.md`, `historico/` | higiene do CLAUDE.md |

## T1 — como investigar (roteiro)

### Passo 1: reproduzir sem observador

O harness da bateria de 25/07 já existe (descrito no histórico). Rodar de
novo **sem** a leitura periódica do banco, e com carga crescente:

1. 1 conversa, 3 fragmentos por turno — baseline.
2. 3 conversas simultâneas (números diferentes), 3 fragmentos cada = 9
   execuções concorrentes.
3. 10 conversas simultâneas = 30 execuções concorrentes.

Medir em cada patamar: CPU do container, RSS, latência do `healthz`,
execuções que não terminam.

Se travar: **anotar o patamar**. Esse número é a resposta pra "acontece em
prod?" — basta comparar com o volume esperado da campanha.

### Passo 2: ver onde está o laço

Com o processo travado, capturar um perfil de CPU. Ordem de tentativa,
da menos invasiva pra mais:

1. `docker exec magma-n8n-dev kill -SIGUSR1 1` abre o inspector do Node na
   9229; conectar e tirar um CPU profile. Se o event loop está bloqueado,
   o inspector pode não responder — nesse caso:
2. Subir o n8n com `NODE_OPTIONS=--cpu-prof --cpu-prof-dir=/home/node/.n8n/prof`
   **antes** de reproduzir; o perfil é escrito quando o processo morre
   (matar com `SIGINT` depois do travamento).
3. Último recurso: `perf`/`gdb` no host contra o PID do node.

O que se procura: um frame dominando o perfil. Suspeitos por ordem de
plausibilidade (ver abaixo).

### Passo 3: testar os suspeitos isoladamente

| # | Hipótese | Por que é plausível | Como isolar |
|---|---|---|---|
| H1 | Laço síncrono na camada do agente (LangChain) ao montar a 2ª chamada depois do tool result | É exatamente onde parou; a 1ª chamada e a tool foram normais | Repetir só a sequência "1 chamada + registrar_lead + 2ª chamada", sem buffer e sem concorrência |
| H2 | Concorrência de execuções seguradas pelo nó `Wait` | 3 execuções vivas no instante do travamento; cada fragmento vira uma | Mandar 10 mensagens fragmentadas de números diferentes ao mesmo tempo, **sem** agente no caminho |
| H3 | Volume gravado por execução | `returnIntermediateSteps: true` faz cada execução guardar o payload **inteiro** de `listar_cursos` + `detalhes_curso` (curso com FAQs, fotos, avaliações). 41 execuções = 55 MB de banco. Serializar isso é trabalho de CPU síncrono | Rodar a mesma conversa com `returnIntermediateSteps` desligado e comparar |
| H4 | Retry sem backoff do SDK do Gemini | Explicaria a espera infinita | Descartável rápido: retry de rede é I/O, **não** prende o event loop nem gasta 100% de CPU |

H3 é o suspeito que eu subestimaria se não estivesse escrito: a spec 021
ligou `returnIntermediateSteps` pra gravar as ferramentas na conversa, e o
efeito colateral é que **todo payload de curso passa a ser serializado e
persistido a cada turno**. É a mudança mais recente no caminho quente.

### Passo 4: escrever a resposta

Uma frase sobre a causa, um número sobre o patamar, e a decisão sobre
queue mode. Vai pro `historico/` e pro ADR.

## Blindagens (independem da T1)

### Timeout no nó do agente

Os nós `agent` do n8n aceitam timeout. Sem ele, "pendurado" é um estado
permanente. Com ele, vira uma execução que falha — e falha é observável.

Valor proposto: **60s**. As conversas medidas levaram 2,5–6,5s de agente;
60s é 10× a pior medição, então só dispara em anomalia real.

### Watchdog que reinicia de verdade

O `healthcheck` do compose **não reinicia nada** — marca "unhealthy" e
pronto. `restart: unless-stopped` só cobre processo **morto**, e o nosso
ficou vivo. As opções:

1. **Container `autoheal`** (padrão conhecido: monitora containers
   marcados como unhealthy e reinicia). Uma linha de compose + um label.
   **Proposta.**
2. Cron no host com `curl /healthz || docker restart`. Menos elegante,
   zero dependência nova.

Em qualquer das duas, o healthcheck atual do n8n já serve de sonda — ele
detectou o travamento corretamente (foi como eu percebi).

### Alarme no reinício

Reinício silencioso troca "o bot parou" por "o bot some por 30s de vez em
quando, e ninguém sabe por quê". O watchdog tem que avisar. Caminho mais
barato: no reinício, chamar o webhook do `mag-avisar-equipe` (que já sabe
buscar todos os gestores, spec 019-T9) — mas ele roda **dentro** do n8n
que acabou de reiniciar, então precisa de espera ou de um caminho
independente. Decidir na implementação; o requisito é "o Daniel fica
sabendo".

### Poda de execuções

Hoje: nada configurado, nos dois ambientes. Dev tem 55 MB de banco com 41
execuções. Ligar `EXECUTIONS_DATA_PRUNE` com janela curta é seguro
**agora** porque a spec 021 mudou o jogo: o histórico que importa
(conversas, ferramentas, desfecho) vive no **Django**, não nas execuções
do n8n. As execuções voltaram a ser o que sempre deveriam ter sido —
depuração de curto prazo.

Proposta: manter ~7 dias. Manter dado de execução além disso hoje não
serve a ninguém e cobra caro em I/O e em serialização.

### Versão fixada

`image: n8nio/n8n:latest` nos dois ambientes significa que um `docker
compose pull` pode trocar a versão do motor do atendimento sem ninguém
pedir. Fixar na versão validada (**2.31.5**, a que rodou esta bateria) e
subir de versão por decisão, não por acaso.

### Limite de memória no container

Não foi a causa aqui (580 MiB de 4,2 GiB de heap), mas container sem
limite num host compartilhado é a diferença entre "o n8n travou" e "a VPS
inteira travou". Limite generoso, só como cerca.

## Riscos

- **Reproduzir pode não travar.** Bug de concorrência não é determinístico.
  Se três rodadas de carga não reproduzirem, a T1 fecha com "não
  reproduzido" e as blindagens entram assim mesmo — elas são o valor
  garantido desta spec.
- **Watchdog mascarando o problema.** Reiniciar sozinho é rede de
  proteção, não conserto. Por isso o alarme é requisito, não opcional: sem
  ele, o sistema fica reiniciando em silêncio e ninguém investiga.
