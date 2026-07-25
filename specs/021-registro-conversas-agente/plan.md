# Plan 021 — Registro e análise das conversas do agente

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| App novo | `apps/conversas/` — `models.py` (`Conversa`, `Turno`), `acoes.py` (3 ações), `admin.py`, `apps.py` (registra ações no `ready()`), `tests.py`, migração inicial | `docs/plataforma/02-backend-django.md` |
| Config | `ConfiguracaoSite.conversas_retencao_dias` (novo campo + migração). **Não** entra em `CAMPOS_CONFIG` do serializer — é config operacional, não conteúdo público | `apps/nucleo/serializers.py` |
| API (ações) | `registrar_turnos`, `exportar_conversas`, `purgar_conversas` — escopos `conversas:*` | `docs/plataforma/03-api-contratos.md` |
| n8n | `mag-fase-0-sdr.json`: 2 nós novos (um por pista, depois do envio). `mag-nutridora-t0.json` e `mag-nutridora-t1-t3-t7.json`: 1 nó cada. `mag-radar-resumo-diario.json`: 1 nó de purga no fim | `plataforma/n8n/workflows/README.md` |
| TokenAgente (dev) | `agente-recepcionista-mag` ganha os 3 escopos novos | via shell/admin dev |
| Docs | `.context/status.md` + `historico/` + `.context/backend.md` + `.context/decisoes.md` (ADR de retenção/privacidade) + `workflows/README.md` | regra de higiene do CLAUDE.md |

## Decisões desta feature

- **App próprio (`conversas`), não um model dentro de `leads`**: a
  conversa não é só de lead — o gestor também conversa com a Operadora, e
  um aluno matriculado também fala com a MAG. Pendurar em `leads` forçaria
  um vínculo que nem sempre existe. `Conversa` referencia `Lead`/`Usuario`
  quando dá, e vive sem eles quando não dá.

- **Registro DEPOIS de responder, num nó só, não dois no meio do fluxo**:
  os dois AI Agents já estão com `returnIntermediateSteps: true`, então a
  saída do agente carrega o texto final **e** as ferramentas chamadas com
  seus argumentos. Um único `HTTP Request` colocado depois do
  `Responder no WhatsApp` consegue gravar os dois turnos de uma vez.
  Ganhos: zero latência percebida pelo lead, um nó por pista em vez de
  dois, e nenhum ponto novo de falha no caminho crítico
  (`onError: continueRegularOutput` fecha o risco).

- **Retenção no `ConfiguracaoSite`, não em variável de ambiente**: o
  pedido do Daniel foi explícito ("se tiver algo configurável seria
  melhor, pra caso eu quiser manter por mais tempo eu apenas mudar uma
  config"). Env var em prod significa editar `.env.prod` na VPS + recriar
  container; campo no Admin significa três toques no celular. É a única
  config global editável que o projeto já tem, e o serializer público usa
  lista explícita de campos (`CAMPOS_CONFIG`), então acrescentar um campo
  ali **não vaza** pro site. `0` = nunca apagar (escape hatch pra quando
  ele quiser guardar tudo de uma campanha).

- **Purga pendurada no Radar, não em cron novo**: o Radar já roda todo
  dia às 8h, já está ativo em dev e prod, e já é o lugar das rotinas
  diárias. Um `Schedule Trigger` novo seria infra a mais pra fazer a
  mesma coisa. Fica **no fim** do workflow, depois do envio do resumo,
  pra uma falha na purga nunca comer o relatório da manhã.

- **Sessão por janela de inatividade de 6h (constante no código, não
  configurável)**: configurável demais vira configuração que ninguém
  entende. 6h separa bem "conversa de hoje de manhã" de "voltou à noite"
  sem picotar um atendimento normal. Se na prática cortar errado, muda-se
  a constante — é uma linha.

- **`desfecho` derivado por código, não por LLM**: a informação "essa
  conversa virou matrícula" já está nas ferramentas que o agente chamou.
  Derivar disso é exato e de graça; pedir pra um modelo classificar seria
  caro, lento e sujeito a erro — mesma lógica do Radar (spec 019) não ter
  AI Agent.

- **`exportar_conversas` devolve transcrição já formatada, não só JSON
  cru**: o consumidor principal é uma LLM lendo dezenas de conversas de
  uma vez. Entregar `{"turnos": [...]}` obrigaria quem analisa a
  remontar o diálogo; entregar o texto corrido (com os metadados ao lado)
  torna a análise imediata. O JSON estruturado continua disponível pro
  Admin e pra qualquer uso programático.

- **Não mexer no `memoryBufferWindow` nesta spec**: trocar por memória
  persistente resolve um segundo problema real (contexto do lead morre no
  restart do n8n), mas é mudança no caminho vivo do atendimento, com
  outro perfil de risco. Virou **spec 022** (Redis Chat Memory, reusando
  a credencial que o buffer da spec 016 já tem nos dois ambientes) —
  implementada logo depois desta e promovida junto, já que as duas mexem
  no mesmo `mag-fase-0-sdr.json` e um restart só do n8n de prod cobre as
  duas.

## Riscos / pontos de atenção

- **Não pode quebrar o fluxo de atendimento.** Qualquer nó novo entra
  depois do envio e com `onError: continueRegularOutput`. Se o Django
  estiver fora do ar, a MAG continua atendendo e só perde o registro
  daquela mensagem.
- **Cuidados de n8n já documentados** (specs 010/012/013): editar campo
  aninhado só com `patchNodeField`, nunca `updateNode` bruto (apaga
  irmãos); conferir com `mode: filtered` depois de editar; não usar
  expression `{{ }}` no campo `url` de `toolHttpRequest` — aqui não se
  aplica, os nós novos são `HTTP Request` comuns.
- **Formato do `intermediateSteps`** varia entre versões do node AI
  Agent. Antes de escrever o parser, inspecionar a saída real de uma
  execução em dev (`n8n_executions`) em vez de assumir o formato — e
  tratar ausência do campo sem estourar (grava o turno sem ferramentas).
- **Volume**: cada mensagem vira 2 linhas de `Turno` com texto livre. Com
  a campanha, dezenas de conversas por dia — irrelevante pro MySQL, mas
  é justamente o que a purga de 15 dias mantém sob controle.
- **Ambiente**: a porta 8000 do host costuma estar ocupada por outro
  projeto (achado recorrente das specs 017/019/020) — se acontecer,
  testar com `runserver` em `:8001` e reverter os nós antes de exportar
  o JSON.
- **Suíte isolada**: sempre `plataforma/rodar-testes.sh` ou
  `--settings=config.settings.test` (incidente de 2026-07-20, memória
  `testes-settings-isolado`).
