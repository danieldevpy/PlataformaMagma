# 2026-07-19 — Plano do agente multi-agente WhatsApp (n8n)

## Prompt do Daniel (resumo)

Criar um agente no n8n com subagentes, cada um com uma finalidade, baseado na
plataforma e na marca — um "funcionário digital" que atende o público E executa
operações da plataforma pelo WhatsApp (menos cliques). Deve reconhecer lead,
aluno, instrutor e admin; rodar via compose junto do projeto; gateway Evolution
API ou whatsmeow; regras pré-definidas e editáveis. Pedido: analisar o estado
atual da plataforma inteira e entregar um plano completo e criativo pra análise
ANTES de desenvolver.

## O que foi feito

- Análise do estado atual: `.context/*`, contratos de API (`docs/plataforma/03`),
  Camada de Ações da spec 005 (`/api/acoes/` + `TokenAgente` + `LogAcao` — 3 ações
  já registradas), gancho `N8N_LEAD_WEBHOOK`, setup n8n no compose, subsistemas
  02/03/04/05, contexto do Social Maker e constituição.
- **Escrito o plano completo**: `docs/subsistemas/02b-agente-whatsapp-n8n.md`
  (padrão de nome seguindo o `07b`). Conteúdo: visão (persona "MAG"),
  arquitetura roteador+subagentes no n8n, comparação Evolution×whatsmeow
  (recomendação: Evolution pra velocidade), identificação de papéis por número
  (+ modelo novo `OperadorWhatsApp`), elenco de 14 agentes em 3 squads
  (atendimento A0–A4, operações B1–B5, futuros C1–C4), regras editáveis via
  modelo `RegraAgente` (constituição §2), segurança (1 token/agente, escopo
  mínimo, confirmação+PIN nas escritas, LGPD/opt-out), 10 ações novas pro
  registry (§7), memória (n8n descartável, plataforma = verdade), roadmap em
  4 fases entregáveis (Fase 1 mira o 08/08) e 7 decisões em aberto (§10).

## Estado ao sair

- Nenhum código tocado — sessão só de análise e planejamento.
- `.context/status.md` atualizado (bullet novo em EM ANDAMENTO).
- Próximo passo: Daniel analisa o plano e bate o martelo nas decisões da §10;
  aprovado, nasce a spec `specs/NNN-agente-whatsapp/` começando pela Fase 0.
