# Spec 027 — Resiliência do n8n: entender o travamento e blindar o atendimento

> Nasce de um incidente real observado na bateria de conversas simuladas de
> 25/07 (`.context/historico/2026-07-25-simulacoes-sdr-6-perfis.md`).
>
> Pedido do Daniel: *"vi que foi muito importante simular esses acessos
> simultâneos, quero até analisar sobre o que de fato ocorreu de verdade,
> para saber se teria acontecido em produção, vamos analisar para depois
> poder reforçar todo o sistema"*.
>
> Por isso esta spec tem uma forma diferente das outras: **T1 é
> investigação**, e o escopo do reforço só fecha depois dela. O que já está
> decidido são as blindagens que valem **independentemente** da causa raiz.

## O que aconteceu (fatos observados)

Durante a 4ª conversa simulada, o n8n de dev **parou de funcionar por
inteiro** e só voltou com `docker compose restart`.

**Linha do tempo** (horário UTC do banco do n8n):

| Execução | Início | Fim | Status |
|---|---|---|---|
| 1585 | 23:57:45.808 | 23:57:50.876 | success (fragmento absorvido) |
| 1586 | 23:57:47.837 | 23:57:52.916 | success (fragmento absorvido) |
| **1587** | **23:57:49.860** | **nunca** | **travou** |
| 1588 | 23:57:55.948 | 23:57:55.975 | success (Nutridora T+0) |
| 1589 | **00:13:42** | — | primeira execução depois do restart |

**Dentro da 1587**, nó a nó — tudo normal até o fim:

```
Buffer: aguardar debounce      5001 ms   ok
Consolidar mensagens             13 ms   ok
Identificar Contato              13 ms   ok
Gemini Chat Model               904 ms   ok   (uma única chamada)
registrar_lead                   28 ms   ok   (Lead #31 criado, Nutridora disparou)
SDR - Capitã de Matrículas         —     TRAVOU AQUI
```

O agente pendurou **depois** de a tool voltar em 28ms, na hora de fazer a
segunda chamada ao modelo. A partir daí, por mais de 10 minutos:

- 1 núcleo a **100% de CPU**, constante;
- `GET /healthz` sem resposta (timeout de 10s) → **event loop bloqueado**;
- **o webhook parou de aceitar mensagem** — nenhuma conversa entra;
- **memória estável em 580 MiB**, sem crescer;
- **nada nos logs** — nenhuma exceção, nenhum aviso.

### O que já dá pra descartar

| Hipótese | Por que está fora |
|---|---|
| Falta de memória | 580 MiB de RSS, limite de heap do Node em **4.288 MiB**, container **sem** limite de memória. A mensagem `"possible out-of-memory issue"` que o n8n gravou na execução é o **texto genérico de recuperação** que ele escreve em toda execução que estava rodando quando o processo caiu — não é diagnóstico. |
| Backend fora do ar | Durante o travamento, `GET /api/cursos/socorrista-aph/` respondeu **200 em 18ms**. O Django estava saudável. |
| Crash / restart-loop do n8n | O processo nunca morreu — ficou vivo e girando. Nenhum reinício nos logs. |
| Esgotamento de heap (GC em espiral) | Descartado pelos números acima: GC em espiral consome memória até o teto; aqui ela ficou plana a 1/7 do limite. |

Sobra a assinatura de **laço síncrono na thread principal** — algo girando
sem soltar o event loop.

### Caveat honesto

Enquanto o teste rodava, eu consultava o banco de execuções do n8n a cada
4 segundos (`docker exec` + leitura do SQLite de 55 MB). É processo
separado e leitura `READONLY`, então não deveria bloquear a thread do n8n
— mas **é uma variável que não existia num uso normal**, e a investigação
tem que reproduzir o cenário **sem** ela antes de concluir qualquer coisa.

## Isso aconteceria em produção?

A resposta honesta é **não sei — e é exatamente por isso que a T1
existe**. O que dá pra afirmar hoje:

- **Prod roda o mesmo código.** Mesma imagem (`n8nio/n8n:latest`, sem
  versão fixada), mesmos workflows, mesmo buffer, mesmo agente.
- **Prod tem mais concorrência, não menos.** Cada mensagem fragmentada
  vira **uma execução por fragmento** (buffer da spec 016). Uma pessoa
  escrevendo em 3 partes = 3 execuções simultâneas. Dez pessoas ao mesmo
  tempo = 30 — e no momento do travamento havia só **3**.
- **Prod não tem rede de proteção.** Sem limite de memória, sem
  `EXECUTIONS_DATA_PRUNE`, sem timeout no nó do agente, e o `healthcheck`
  do compose **não reinicia nada** — ele só pinta o container de
  "unhealthy". `restart: unless-stopped` não cobre processo vivo e travado.
- **Em prod ninguém perceberia.** Não há alarme. O sintoma pro Daniel
  seria "o bot parou de responder", descoberto por acaso — e as mensagens
  que chegarem durante o travamento **somem** (o WhatsApp não retenta).

Ou seja: com a campanha de tráfego pago (spec 018) trazendo gente ao mesmo
tempo, o cenário de prod é **mais** propício ao travamento que o de dev.

## O que muda para o usuário

- **Contato:** para de existir a janela em que ele manda mensagem e
  ninguém — nem robô nem gente — recebe.
- **Gestor:** descobre que o atendimento caiu **pelo aviso**, não pelo
  cliente reclamando.

## Critérios de aceite

### Investigação (T1)

- [ ] O travamento é **reproduzido em dev** de forma controlada, sem o
      observador (a leitura periódica do banco).
- [ ] Existe um perfil de CPU do momento do travamento apontando **onde**
      o laço acontece.
- [ ] Está escrito, em uma frase, se o gatilho é (a) o agente/LangChain,
      (b) concorrência de execuções com `Wait`, (c) o volume de dados
      gravado por execução, ou (d) outra coisa.
- [ ] Está respondido: **acontece em produção, sim ou não** — e com qual
      volume.

### Blindagem (vale mesmo se a T1 não achar a causa)

- [ ] **Timeout no agente.** O nó do SDR não fica pendurado
      indefinidamente: passado o limite, a execução falha e libera.
- [ ] **Watchdog.** n8n travado (healthz sem resposta por N checagens
      seguidas) é reiniciado sozinho, em dev e em prod.
- [ ] **Alarme.** Reinício por travamento gera aviso no WhatsApp dos
      gestores — o Daniel fica sabendo sem precisar olhar.
- [ ] **Poda de execuções.** O banco do n8n deixa de crescer sem limite
      (55 MB em dev, com 41 execuções guardando payload de tool inteiro).
- [ ] **Imagem com versão fixada** em vez de `latest`, nos dois ambientes.
- [ ] **Teste de carga documentado**: N conversas simultâneas, com o
      número que o sistema aguenta registrado em algum lugar.

## Critério de aceite do gestor

Se o atendimento cair de madrugada, o Daniel **acorda com uma mensagem
avisando** — e o sistema já voltou sozinho antes disso.

## Fora de escopo

- Migrar o n8n pra **queue mode** (execuções em workers separados, que é
  a solução estrutural pro bloqueio de thread principal). Fica registrado
  como o caminho "de gente grande", a ser decidido **depois** da T1 — se a
  causa for concorrência, vira spec própria.
