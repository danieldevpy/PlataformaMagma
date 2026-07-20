# Tasks 009 — Fundação do agente WhatsApp (identificação de contato)

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| ~~T1~~ | ~~Modelo `OperadorWhatsApp`~~ — descartado, ver Log | DONE | |
| T2 | Ação `identificar_contato` (nucleo) + testes (gestor/lead/desconhecido) | DONE | claude |
| T3 | `TokenAgente` `agente-recepcionista-mag` (escopo `nucleo:identificar_contato`) | DONE | claude |
| T4 | Atualizar workflow n8n `MAG - Fase 0` (nó HTTP Request + resposta por papel) | DONE | claude |
| T5 | `docs/plataforma/03-api-contratos.md` — registrar a ação nova | DONE | claude |
| T6 | Teste real: Daniel preenche `whatsapp` no seu `Usuario`, manda "oi", confere resposta | DONE | Daniel |

## Ondas

- Onda 1 (paralelo): T2, T3
- Onda 2 (depende de T2, T3): T4, T5
- Onda 3 (depende de T4): T6

## Log

- (2026-07-20) Spec criada a partir da sessão que montou Evolution API no
  compose + `n8n-mcp` + workflow eco de teste ponta a ponta (branch
  `feature/evolution-api-compose`).
- (2026-07-20) T1 descartada ao começar a implementar: `contas.Usuario` já
  tem `whatsapp` e `papel` (gestor/instrutor) — o modelo `OperadorWhatsApp`
  planejado seria duplicata. `spec.md`/`plan.md` atualizados pra usar
  `Usuario` direto, sem migration nova. `identificar_contato` ganhou de
  graça a identificação de instrutor (login existente), que antes estava
  fora de escopo.
- (2026-07-20) Spec ENTREGUE e validada ponta a ponta. `apps/nucleo/acoes_contato.py`
  (ação registrada em `NucleoConfig.ready()`), 7 testes novos em
  `apps/nucleo/tests.py::IdentificarContatoTests` (27/27 do app passando),
  `TokenAgente agente-recepcionista-mag` criado no banco dev, workflow n8n
  `MAG - Fase 0` ganhou o nó "Identificar Contato" entre extração e
  resposta, `docs/plataforma/03-api-contratos.md` atualizado. **Critério do
  gestor confirmado por Daniel**: preencheu o `whatsapp` do seu `Usuario`
  pelo admin, mandou "oi" de verdade, a MAG respondeu reconhecendo como
  gestor.
