# Tasks 021 — Registro e análise das conversas do agente

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | App `apps/conversas/` + modelos `Conversa`/`Turno` + migração + registro em `INSTALLED_APPS` | ENTREGUE | claude |
| T2 | Campo `ConfiguracaoSite.conversas_retencao_dias` (padrão 15, `0` = nunca) + migração; conferir que **não** entra em `CAMPOS_CONFIG` | ENTREGUE | claude |
| T3 | Ação `registrar_turnos` (sessão por janela de 6h + derivação de `desfecho`) | ENTREGUE | claude |
| T4 | Ação `exportar_conversas` (filtros + transcrição formatada) | ENTREGUE | claude |
| T5 | Ação `purgar_conversas` (lê a retenção do `ConfiguracaoSite`) | ENTREGUE | claude |
| T6 | Django Admin: `Conversa` com busca/filtros + turnos inline somente leitura | ENTREGUE | claude |
| T7 | Testes (`apps/conversas/tests.py`): janela de sessão, desfecho derivado, exportação, purga respeitando config (inclusive `0`), 403 por escopo | ENTREGUE | claude |
| T8 | `docs/plataforma/03-api-contratos.md` — as 3 ações novas | ENTREGUE | claude |
| T9 | Inspecionar o formato real do `intermediateSteps` numa execução de dev antes de escrever o parser do nó | ENTREGUE | claude |
| T10 | n8n dev: nós de registro no `MAG - Fase 0` (SDR + Operadora), depois do envio, `onError: continueRegularOutput` | ENTREGUE | claude |
| T11 | n8n dev: registro do toque nas duas Nutridoras (T+0 e T+1/3/7), papel `sistema` | ENTREGUE | claude |
| T12 | n8n dev: nó de purga no fim do `MAG - Radar` | ENTREGUE | claude |
| T13 | Escopos `conversas:*` no `TokenAgente` de dev | ENTREGUE | claude |
| T14 | Teste de ponta a ponta em dev com mensagem real (conversa no Admin + exportação + purga) | ENTREGUE | claude |
| T15 | Exportar os 4 JSONs de workflow + atualizar `workflows/README.md` | ENTREGUE | claude |
| T16 | `.context/status.md` + `.context/backend.md` + ADR em `.context/decisoes.md` + `historico/` | ENTREGUE | claude |
| T17 | Promover pra prod (escopos no `TokenAgente` de prod + migrações + `promover-prod.sh` dos 4 workflows) | PENDENTE | — (decisão do Daniel) |

## Ondas

- Onda 1 (paralelo): T1, T2, T8, T9
- Onda 2 (depende de T1/T2): T3 → T4, T5 (T4 e T5 em paralelo depois de T3)
- Onda 3 (depende de T3-T5): T6, T7
- Onda 4 (depende de T7 + T9): T13 → T10 → T11, T12
- Onda 5: T14 → T15 → T16
- T17 fica pra quando o Daniel decidir promover (mesmo padrão das specs anteriores)

## Log

- (2026-07-24) Spec criada a pedido do Daniel: "preciso gravar as sessões
  de conversas do agente com os alunos, porque tenho que analisar se ele
  vai conseguir responder certo, converter vendas etc.; hoje eu tenho que
  olhar as execuções, e não dá pra fazer análise mais ampla nem uma LLM
  analisar". Retenção definida por ele: **máximo 15 dias por ora, mas
  configurável** ("se tiver algo configurável seria melhor, pra caso eu
  quiser manter por mais tempo eu apenas mudar uma config") — daí a
  decisão de campo no Admin em vez de variável de ambiente. Implementação
  ainda não iniciada.
- (2026-07-24, noite) **ENTREGUE em dev (T1-T16)**. App `apps/conversas/`
  criado com `Conversa`/`Turno`, 3 ações e Admin somente leitura; campo
  `conversas_retencao_dias` no `ConfiguracaoSite` (padrão 15, `0` = nunca).
  29 testes novos, suíte completa **278/278**.
  **Bug pego pelos próprios testes, no código novo**: `params.get("dias")
  or 7` transformava `dias=0` em 7 silenciosamente em vez de recusar —
  corrigido com checagem explícita de `None`/`""` (mesmo tratamento pro
  `limite`). **T9 valeu a pena**: o formato real do `intermediateSteps` é
  `[{action: {tool, toolInput, ...}, observation}]`, e o `observation`
  carrega o payload inteiro da tool (detalhes do curso ≈ 4KB) — de
  propósito só gravo nome + argumentos, nunca a observação.
  **Teste real** com 2 mensagens do número de teste: virou 1 conversa com
  4 turnos, vinculada ao `Lead`, ferramentas capturadas, e o desfecho
  subiu de `lead_registrado` pra `handoff` quando o agente chamou
  `escalar_contato` (regra de "não retroceder no funil" confirmada com
  dado real). **Purga testada** com webhook temporário conectado só no nó
  de purga (mesma técnica da spec 019 — `Schedule Trigger` não dá pra
  disparar via `n8n_test_workflow`; removido antes de exportar):
  envelheci uma conversa pra 40 dias, criei outra recente, e a purga
  apagou só a vencida com os turnos em cascata (`LogAcao`:
  `{'apagadas': 1, 'retencao_dias': 15}`).
  **Achado de tooling (fora do escopo original, mas resolvido)**:
  reexportar os workflows gerava ~1200 linhas de diff cosmético
  (indentação/ordem de chave) que escondiam a mudança real na revisão.
  Virou script versionado `plataforma/n8n/workflows/exportar-dev.sh` +
  `_limpar_export.py` — contrapartida do `promover-prod.sh`. Conferi com
  um diff **semântico** (nó a nó) que a mudança é só a pretendida, e
  revertí `mag-avisar-equipe.json`, que não tinha mudança nenhuma.
  **Pendente**: T17 — promover pra prod **junto com a spec 022** (as duas
  mexem no mesmo `mag-fase-0-sdr.json`; promover junto = um restart só do
  n8n de produção). Decisão do Daniel.
  **Resíduo em dev**: 1 conversa de teste (`5521888887777`) criada à mão
  pra provar a seletividade da purga.
