# Plan 020 — Agente WhatsApp: Nutridora T+1d/3d/7d

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| Modelos/migrations | `Lead.nutridora_ultimo_toque` (CharField+choices, blank default) | `docs/plataforma/02` |
| API (ações) | `apps/leads/acoes.py` ganha `processar_nutridora` (reusa `turma_destaque_de` de `apps/cursos/serializers.py` pro dado de vagas) | `docs/plataforma/03-api-contratos.md` |
| Testes | `apps/leads/tests.py` (ou `apps/nucleo/tests.py`, seguir onde já tem cobertura de ações de `leads`) | |
| n8n | Workflow novo `plataforma/n8n/workflows/mag-nutridora-t1-t3-t7.json`: `Schedule Trigger` → `HTTP Request` → `Split Out` → `HTTP Request` (Evolution) | `plataforma/n8n/workflows/README.md` |
| TokenAgente (dev) | escopo `leads:processar_nutridora` | via shell/admin dev |
| Docs | `.context/status.md` + `historico/` + `workflows/README.md` | regra de higiene do CLAUDE.md |

## Decisões desta feature

- **Polling diário, não webhook por lead**: T+0 é evento (signal na
  criação); T+1/3/7 são atrasados no tempo, então precisam de um cron que
  pergunta "quem está na janela hoje" — mesmo padrão já validado no
  Radar (spec 019, `Schedule Trigger`). Rodar 1x/dia é suficiente (janela
  de 1 dia de granularidade, não faz sentido rodar de hora em hora).
- **Marca o toque no mesmo request que gera o conteúdo** (não um
  "confirma depois que mandou" separado): simplifica o workflow (só 1
  chamada ao Django, não precisa de loop com callback por item). Troca:
  se a Evolution cair bem na hora do envio, aquele toque específico é
  perdido (não reenviado depois) — aceitável pro MVP porque não é ação
  crítica (diferente de `gerar_cobranca`, que sempre confirma antes/depois).
- **`Split Out` no n8n**: `processar_nutridora` devolve um array
  (`resultado.processados`); esse node novo (não usado ainda no projeto)
  transforma o array em N itens do n8n, e o `HTTP Request` seguinte roda
  automaticamente uma vez por item (comportamento padrão do n8n) — não
  precisa de loop explícito.
- **T+3 sem depoimento disponível → não marca, tenta de novo amanhã**:
  único toque que pode ficar "esperando" indefinidamente, porque é o
  único cujo conteúdo (avaliação aprovada real) pode genuinamente não
  existir ainda. T+1 e T+7 sempre têm fallback genérico e sempre marcam.
- **Filtro de silêncio reusa `ContatoEscalado`** (mesmo mecanismo do
  handoff, spec 012) em vez de criar um campo de opt-out novo — um
  contato escalado já significa "não responder automaticamente", vale
  igual pros toques proativos.
- **Sem AI Agent**: mesma razão do Radar — conteúdo é dado real
  formatado, não geração; LLM aqui só adicionaria custo/latência/risco
  sem necessidade.

## Riscos / pontos de atenção

- Node `Split Out` (`n8n-nodes-base.splitOut` ou equivalente) é novo no
  projeto — conferir o nome exato do node via `n8n-mcp` antes de montar
  (evitar o mesmo tipo de erro de `typeVersion` já documentado).
- Testar com leads de teste com `criado_em` retroativo (`Lead.objects.create`
  seguido de `.update(criado_em=...)`, mesmo truque usado nos testes do
  Radar) — não dá pra esperar 7 dias de verdade.
- Confirmar que `ContatoEscalado.numero` e `Lead.whatsapp` usam o mesmo
  formato (só dígitos com DDI) antes de filtrar por igualdade — mesma
  convenção já documentada em `identificar_contato`/`escalar_contato`.
- Como a campanha pode começar **amanhã**, dar prioridade a testar o
  fluxo de ponta a ponta ainda hoje, mesmo que a promoção pra prod (T7 da
  spec) fique pra depois — o importante é o dev estar validado a tempo
  do Daniel decidir promover rápido se precisar.
