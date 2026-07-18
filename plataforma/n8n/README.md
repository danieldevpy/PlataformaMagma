# n8n — automações e agente WhatsApp

Orquestrador de automações da Magma (agente de WhatsApp, follow-up de leads,
notificações). Integrado ao ecossistema da plataforma nos dois ambientes.

## Por que assim (decisões)

- **Banco: SQLite interno do n8n** (no volume), em dev E prod. O n8n **não
  suporta MySQL** (desde a v1 só SQLite/Postgres), então o banco existente da
  plataforma não pode ser reaproveitado. Para o volume atual de automações,
  SQLite é o correto e mais simples; migrar para um Postgres dedicado só se
  houver muitos workflows simultâneos/queue mode (registrado como evolução).
- **Sem Redis/queue mode/workers** por ora — instância única dá conta e
  mantém a complexidade baixa.
- **Prod no mesmo compose da plataforma** (`../docker-compose.prod.yml`):
  sobe junto no `init-prod.sh`, porta só no loopback (`127.0.0.1:5678`),
  público via nginx do host no subdomínio `n8n.magmacursosltda.com.br`.
- **Dev em compose separado** (`docker-compose.dev.yml`): o dev da plataforma
  não usa Docker (runserver+next dev), então o n8n é o único container —
  opcional, via `../init-dev.sh --n8n`.

## Como rodar

| | Dev | Prod |
|---|---|---|
| Subir | `../init-dev.sh --n8n` (ou `docker compose -f docker-compose.dev.yml up -d`) | `../init-prod.sh` (já incluso) |
| Editor | http://localhost:5678 | https://n8n.magmacursosltda.com.br |
| Parar | `docker compose -f docker-compose.dev.yml down` | junto com o compose de prod |
| Dados | volume `n8n_dev_data` | volume `n8n_data` |

Primeiro acesso ao editor cria a conta do dono (user management nativo do n8n).

## Setup único de prod (checklist)

1. DNS: registro **A** de `n8n.magmacursosltda.com.br` → IP da VPS.
2. `.env.prod`: preencher `N8N_DOMAIN` e `N8N_ENCRYPTION_KEY`
   (`openssl rand -hex 32`; **nunca trocar depois** — a chave criptografa as
   credenciais salvas e trocá-la invalida todas).
3. nginx do host: copiar o bloco do n8n de `../nginx/nginx.conf`,
   `sudo nginx -t && sudo systemctl reload nginx`.
4. TLS: `sudo certbot --nginx -d n8n.magmacursosltda.com.br`.
5. `../init-prod.sh` (o script barra deploy com a chave placeholder).

## Como o n8n conversa com a plataforma

- **Workflow → API da plataforma**: em prod, pela rede interna do compose:
  `http://backend:8000/api/...`. Em dev: `http://host.docker.internal:8000/api/...`.
  Autenticação: JWT (`POST /api/token/`) com um usuário de serviço.
- **Plataforma → n8n**: já existe o gancho de leads — todo lead novo dispara
  `POST` para `N8N_LEAD_WEBHOOK` (`apps/leads/signals.py`; vazio = desligado).
  Em prod use a URL interna, ex.: `http://n8n:5678/webhook/lead-novo`.
- **WhatsApp/Meta → n8n**: webhooks públicos chegam em
  `https://n8n.magmacursosltda.com.br/webhook/...` (nginx → loopback 5678).
  Webhook de teste do editor exige URL pública — testar fluxo de WhatsApp real
  direto em prod (ou túnel temporário em dev).

## Próximo passo (fora deste setup)

O agente de WhatsApp em si (workflows, credencial Meta/Evolution, prompts) é
uma feature própria — deve nascer como spec em `specs/` quando for começar,
começando pelo fluxo de leads (`N8N_LEAD_WEBHOOK` → primeira mensagem).
