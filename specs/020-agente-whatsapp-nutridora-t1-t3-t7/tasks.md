# Tasks 020 — Agente WhatsApp: Nutridora T+1d/3d/7d

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | Migração `Lead.nutridora_ultimo_toque` | DONE | claude |
| T2 | Ação `processar_nutridora` em `apps/leads/acoes.py` | DONE | claude |
| T3 | Testes (elegibilidade por janela, fallback de conteúdo, exclusão de escalado/utm=whatsapp, marcação idempotente) | DONE | claude |
| T4 | `docs/plataforma/03-api-contratos.md` — entrada da ação | DONE | claude |
| T5 | n8n dev: criar workflow `MAG - Nutridora (T+1/3/7)` (Schedule Trigger + HTTP Request + Split Out + HTTP Request Evolution), escopo novo no `TokenAgente` dev | DONE | claude |
| T6 | Teste manual (leads de teste com `criado_em` retroativo, sem esperar dias de verdade) | DONE | claude |
| T7 | Exportar `mag-nutridora-t1-t3-t7.json`, atualizar `workflows/README.md` | DONE | claude |
| T8 | `.context/status.md` + `historico/2026-07-24-...md` | DONE | claude |
| T9 | Promover pra prod (escopo no TokenAgente prod + import + ativar) — **prioridade alta**, campanha pode começar amanhã | PENDENTE | — (decisão do Daniel) |

## Ondas

- Onda 1: T1
- Onda 2 (depende de T1): T2, T4 (paralelo)
- Onda 3 (depende de T2): T3
- Onda 4 (depende de T2): T5 → T6 → T7
- Onda 5: T8
- T9 fica pra quando o Daniel decidir promover — mas diferente das specs
  anteriores, aqui a urgência é real (campanha amanhã), então vale avisar
  assim que T1-T8 estiverem prontos.

## Log

- (2026-07-24) Spec criada a pedido do Daniel, no contexto de que a
  campanha de tráfego pago (spec 018) pode começar amanhã e passar a
  trazer leads reais pelo WhatsApp. Iniciando implementação.
- (2026-07-24) **ENTREGUE (T1-T8)**. `Lead.nutridora_ultimo_toque` +
  `processar_nutridora` (11 testes novos, suíte completa 245/245).
  Workflow novo `MAG - Nutridora (T+1/3/7)` (id `ZkAxwOPuWVxWncax`)
  criado, testado progressivamente com o mesmo lead de teste em 3
  rodadas (T+1 habilidades reais, T+3 avaliação real, T+7 vagas reais —
  "restam 14 vaga(s)") e ativado em dev. Ver §Log detalhado em
  `historico/2026-07-24-spec-020-nutridora-t1-t3-t7.md`.
  **Pendente T9**: promover pra prod — **prioridade alta**, campanha de
  tráfego pago pode começar amanhã.
