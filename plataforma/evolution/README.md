# Evolution API — gateway WhatsApp

Container que fala o protocolo do WhatsApp Web (API não-oficial) e expõe REST +
webhooks pro n8n orquestrar. É o gateway escolhido pelo plano do agente MAG —
ver `docs/subsistemas/02b-agente-whatsapp-n8n.md` (§2.1: comparação com
whatsmeow, riscos assumidos).

## Por que assim (decisões)

- **Banco: Postgres dedicado**, em dev E prod. A Evolution API v2 não suporta
  SQLite/MySQL — só Postgres (ou MySQL via `psql_bouncer`, não usado aqui) —
  então não dá pra reaproveitar o MySQL da plataforma nem o SQLite do n8n.
  Container próprio (`evolution-postgres`), schema dedicado
  (`?schema=evolution_api` na connection URI).
- **Redis dedicado**: recomendado pela doc oficial pra cache de sessão/conexão
  (evita re-parear o QR code à toa). Container próprio (`evolution-redis`),
  sem persistência crítica além do `appendonly`.
- **Sem Manager UI separada** (a imagem `evolution-manager` do compose oficial
  de referência): a própria imagem `evolution-api` já serve o Manager embutido
  em `/manager` na mesma porta — evita um container a mais e um conflito de
  porta 3000 com o frontend Next.js da plataforma.
- **Sem porta pública em prod**: n8n e Evolution vivem no mesmo compose e se
  enxergam pela rede interna (`http://evolution-api:8080` /
  `http://n8n:5678/webhook/...`). Não precisa de subdomínio, DNS nem bloco de
  nginx — só o `backend`/`frontend`/`n8n` têm domínio público hoje. O loopback
  (`127.0.0.1:8080`) fica só pra administração via túnel SSH.
- **Número dedicado ao bot**: API não-oficial = risco real de banimento do
  número. Nunca parear o número principal da escola aqui — ver riscos em
  `docs/subsistemas/02b-agente-whatsapp-n8n.md` §2.1.

## Como rodar

| | Dev | Prod |
|---|---|---|
| Subir | `../init-dev.sh --evolution` (ou `docker compose -f docker-compose.dev.yml up -d`) | `../init-prod.sh` (já incluso no `docker-compose.prod.yml`) |
| Manager | http://localhost:8080/manager | via túnel SSH: `ssh -L 8080:127.0.0.1:8080 <vps>` → http://localhost:8080/manager |
| API key | fixa no compose (`dev-evolution-key-troque-em-prod`) | `EVOLUTION_API_KEY` no `.env.prod` |
| Parar | `docker compose -f docker-compose.dev.yml down` | junto com o compose de prod |
| Dados | volumes `evolution_postgres_dev_data` / `evolution_redis_dev_data` / `evolution_instances_dev` | volumes `evolution_postgres_data` / `evolution_redis_data` / `evolution_instances` |

## Comportamentos esperados (não são bug do nosso setup)

- **Primeiro boot demora ~20-30s** (aplica ~60 migrations no Postgres antes
  de responder). `init-dev.sh --evolution` já espera o container ficar
  `healthy` antes de mostrar o link — se você abrir o Manager antes disso
  (ou subir com `docker compose up -d` direto, sem esperar), a tela trava em
  "The application is taking longer than expected to load": é só dar refresh
  depois que o container terminar de subir (`docker compose -f
  evolution/docker-compose.dev.yml ps` mostrando `healthy`).
- **Logo do Manager não carrega (ícone quebrado no topo)**: o Manager busca o
  SVG em `https://evolution-api.com/files/evo/evolution-logo-white.svg`, que
  retorna 404 — bug no CDN da própria Evolution (confirmado via inspeção do
  bundle + teste headless), não depende de nada aqui. Cosmético, não afeta
  login nem funcionalidade.

## Setup único de prod (checklist)

1. `.env.prod`: preencher `EVOLUTION_API_KEY` (gerar com `openssl rand -hex 32`
   — dá pra rotacionar depois, diferente da `N8N_ENCRYPTION_KEY`) e
   `EVOLUTION_POSTGRES_PASSWORD`.
2. `../init-prod.sh` (sobe `evolution-postgres` + `evolution-redis` +
   `evolution-api` junto com o resto).
3. Abrir o Manager por túnel SSH, criar a instância (parear o número dedicado
   via QR code).
4. Configurar o webhook da instância pra `http://n8n:5678/webhook/...`
   (URL interna — Evolution e n8n estão na mesma rede do compose).

## Próximo passo (fora deste setup)

Este container só é o gateway — o agente em si (workflows do n8n, prompts dos
subagentes, roteamento por papel) nasce como spec quando o Daniel aprovar o
plano em `docs/subsistemas/02b-agente-whatsapp-n8n.md` (§9, Fase 0 em diante).
