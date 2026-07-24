# Tasks 019 — Agente WhatsApp: B5 Radar (resumo diário)

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | Ação `resumo_diario` em `apps/nucleo/acoes_resumo.py` + registro em `apps.py` | DONE | claude |
| T2 | Testes (`ResumoDiarioTests`) | DONE | claude |
| T3 | `docs/plataforma/03-api-contratos.md` — entrada da ação | DONE | claude |
| T4 | n8n dev: criar workflow `MAG - Radar (resumo diário)` (Schedule Trigger + HTTP Request + Code + Evolution), escopo novo no `TokenAgente` dev | DONE | claude |
| T5 | Teste manual (execução avulsa no n8n, sem esperar o cron) | DONE | claude |
| T6 | Exportar `mag-radar-resumo-diario.json`, atualizar `workflows/README.md` | DONE | claude |
| T7 | `.context/status.md` + `historico/2026-07-24-...md` | DONE | claude |
| T8 | Promover pra prod (escopo no TokenAgente prod + import do workflow + ativar) | PENDENTE | — (decisão do Daniel) |

## Ondas

- Onda 1 (paralelo): T1, T3
- Onda 2 (depende de T1): T2
- Onda 3 (depende de T1): T4 → T5 → T6
- Onda 4: T7
- T8 fica pra quando o Daniel decidir promover (mesmo padrão das specs 013-017)

## Log

- (2026-07-24) Spec criada — segunda opção da análise de ferramentas do
  n8n, depois do Daniel decidir adiar a Nutridora T+1/3/7. Iniciando
  implementação.
- (2026-07-24) **ENTREGUE (T1-T7)**. Ação `resumo_diario` implementada
  (5 testes novos, suíte completa 235/235). Workflow novo
  `MAG - Radar (resumo diário)` (id `kq6ULUF5lYU9HRQf`, 4 nós: Schedule
  Trigger 8h → HTTP Request → Code (formata texto, sem LLM) → HTTP Request
  Evolution) criado do zero via `n8n-mcp`. Escopo `nucleo:resumo_diario`
  adicionado ao `TokenAgente` de dev. Como `Schedule Trigger` não dá pra
  testar via `n8n_test_workflow` (só webhook/form/chat), adicionei um
  webhook temporário conectado no mesmo ponto pra disparar manualmente,
  testei, e removi antes de reexportar — só o `Schedule Trigger` fica no
  arquivo final. Mesmo achado de ambiente da spec 017 (porta 8000 do host
  ocupada por outro projeto): testei com `runserver` em `:8001`,
  revertido pra `:8000` antes de exportar. **Teste real**: resumo saiu
  formatado com dado real do dev (3 leads em 24h, turma "026" com
  inscrições abertas, 0 avaliações pendentes, 0 postagens hoje, 18
  execuções de IA no mês/14060 tokens); único erro foi o esperado
  (Evolution API não roda nesta sessão). Workflow ativado em dev (cron
  real vai disparar 8h America/Sao_Paulo a partir de agora).
  **Pendente**: T8 — promover pra prod (workflow ainda não está em
  `ids-prod.json`; escopo novo no `TokenAgente` de prod; ativar depois de
  importar), decisão do Daniel.
