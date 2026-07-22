# 2026-07-21 (noite) — Evolution API passa a persistir mensagens/chats

## Prompt do Daniel

Percebeu que na Evolution API dava pra ver o que o agente MAG respondia no
WhatsApp, mas não o que a pessoa mandou — queria acompanhar se o bot está
respondendo certo. Perguntou se dava pra fazer a própria Evolution assumir
essa responsabilidade (ver todos os chats por lá).

## O que foi feito

Causa raiz: os composes (dev e prod) só tinham `DATABASE_SAVE_DATA_INSTANCE:
"true"` — a Evolution nunca persistia mensagens/contatos/chats no Postgres
dela, só a instância. Por isso o Manager (`/manager`) não tinha histórico
pra mostrar; só dava pra ver em tempo real (via webhook) o lado que ela
mesma envia.

Adicionadas 4 env vars em `plataforma/evolution/docker-compose.dev.yml` e
`plataforma/docker-compose.prod.yml` (mesmo bloco `environment` do serviço
`evolution-api`):

- `DATABASE_SAVE_DATA_NEW_MESSAGE: "true"`
- `DATABASE_SAVE_MESSAGE_UPDATE: "true"`
- `DATABASE_SAVE_DATA_CONTACTS: "true"`
- `DATABASE_SAVE_DATA_CHATS: "true"`

Documentado em `plataforma/evolution/README.md` (seção "Por que assim").

Dev: container `magma-evolution-api-dev` recriado (`docker compose up -d
evolution-api`) — confirmado via `docker inspect` que as 4 vars novas estão
ativas, container voltou `healthy`.

## Pendente

- **Prod**: mudança está só no arquivo — precisa `docker compose --env-file
  .env.prod -f docker-compose.prod.yml up -d evolution-api` (ou
  `init-prod.sh` de novo) na VPS pra valer lá. Nada foi tocado em produção
  nesta sessão.
- Conversas anteriores à mudança não aparecem retroativamente no Manager —
  só a partir de agora.
- Alternativa mais robusta pro médio prazo (não feita agora, só registrada
  no plano): ação `registrar_interacao_lead` (§8 de
  `docs/subsistemas/02b-agente-whatsapp-n8n.md`) gravaria a conversa como
  histórico do Lead direto no Django Admin — fonte de verdade na plataforma
  em vez de depender da Evolution/n8n.
