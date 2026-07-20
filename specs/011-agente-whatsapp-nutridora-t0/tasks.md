# Tasks 011 — Nutridora de Leads: boas-vindas imediata (T+0)

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | `backend/.env` (dev) com `N8N_LEAD_WEBHOOK` | DONE | claude |
| T2 | Workflow n8n `MAG - Nutridora (T+0)` | DONE | claude |
| T3 | Reiniciar backend dev + teste real (criar lead → mensagem chega) | DONE | Daniel + claude |

## Ondas

- Onda 1: T1, T2 (paralelo)
- Onda 2 (depende de T1, T2): T3

## Log

- (2026-07-20) Spec criada seguindo a ordem projetada no plano-mãe (depois
  de A0 identificação + A1 SDR). Fatiada só a T+0 — T+1d/3d/7d exigem
  cron + campo novo no Lead, ficam pra próxima spec.
- (2026-07-20) Spec ENTREGUE e validada: lead de teste criado via
  `POST /api/leads/` (curso Socorrista APH) → webhook disparou → n8n montou
  a mensagem com o nome real do curso → Evolution mandou de verdade pro
  número de teste. Confirmado pelo Daniel. Lead de teste removido do banco
  depois.
- (2026-07-20) **Incidente e correção**: o `backend/.env` criado no T1 tem a
  URL real do webhook. Rodar `manage.py test` sem
  `--settings=config.settings.test` (o padrão cai em `dev`, que lê o mesmo
  `.env`) faz toda fixture de teste que cria um `Lead` disparar um webhook
  **de verdade** pro n8n — que, com a Nutridora ativa, mandou WhatsApp real
  pra números fictícios de teste (`5521999990003`/`5521999990004`, de
  `apps/nucleo/tests.py`). Detectado pelo Daniel vendo mensagens estranhas
  no WhatsApp da instância. Fix em duas camadas: (1)
  `config/settings/test.py` agora força `N8N_LEAD_WEBHOOK = ""` sempre,
  independente do `.env`; (2) workflow `MAG - Nutridora (T+0)` ganhou o
  mesmo filtro de números de teste do workflow principal (defesa em
  profundidade). Confirmado com a suíte rodando do jeito certo
  (`--settings=config.settings.test`) que nenhuma execução nova dispara no
  n8n. Lição: sempre usar `--settings=config.settings.test` (ou
  `plataforma/rodar-testes.sh`) — nunca `manage.py test` cru.
- (2026-07-20) **Ajuste de UX** (achado pelo Daniel testando a SDR): quando
  o lead nasce DENTRO da própria conversa de WhatsApp (via `registrar_lead`
  da SDR, spec 010), a boas-vindas da Nutridora ficava redundante —
  interrompia uma conversa que já estava rolando naturalmente com uma
  mensagem de "recebi seu interesse" fora de contexto. Fix: nó "Tem
  WhatsApp?" renomeado pra "Deve mandar boas-vindas?" e ganhou uma 3ª
  condição (`utm_source != "whatsapp"`) — `registrar_lead` sempre marca
  `utm_source: "whatsapp"`, então dá pra distinguir "nasceu no chat" de
  "nasceu no site/outro canal" sem campo novo. Testado os dois caminhos via
  `POST /api/leads/` real (um com `utm_source=whatsapp` → pulou; um com
  `utm_source=instagram` → mandou normal).
