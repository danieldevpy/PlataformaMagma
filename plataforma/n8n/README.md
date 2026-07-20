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

- **Workflow → Django**: SEMPRE via `http://magma-backend-interno:8000/api/...`
  — hostname neutro que resolve pro mesmo lugar nos dois ambientes (dev:
  `extra_hosts` do compose do n8n dev, apontando pro host via
  `host-gateway`, onde roda o `runserver`; prod: alias de rede no serviço
  `backend`). **Nunca** usar `host.docker.internal` ou `backend` direto nos
  nós — só esse hostname, senão o workflow deixa de rodar sem edição ao subir
  pra prod. Autenticação: Camada de Ações (`X-Agente-Token`, ver
  `docs/plataforma/03-api-contratos.md`) via credencial n8n `MAG -
  X-Agente-Token` — nunca hardcoded no nó.
- **Workflow → Evolution**: `http://evolution-api:8080/...` (idêntico nos dois
  ambientes — mesmo nome de serviço no compose dev e prod). Autenticação via
  credencial n8n `MAG - Evolution apikey` — nunca hardcoded no nó.
- **Filtro de números de teste**: os workflows leem `$env.MAGMA_NUMEROS_TESTE_REGEX`
  (setado no compose de cada ambiente) em vez de ter a regex hardcoded num nó —
  em prod fica vazio (regex vazia casa com qualquer string = sem filtro).
- **Plataforma → n8n**: já existe o gancho de leads — todo lead novo dispara
  `POST` para `N8N_LEAD_WEBHOOK` (`apps/leads/signals.py`; vazio = desligado).
  Em prod use a URL interna, ex.: `http://n8n:5678/webhook/lead-novo`.
- **WhatsApp/Meta → n8n**: webhooks públicos chegam em
  `https://n8n.magmacursosltda.com.br/webhook/...` (nginx → loopback 5678).
  Webhook de teste do editor exige URL pública — testar fluxo de WhatsApp real
  direto em prod (ou túnel temporário em dev).

> Por que esse cuidado todo: os 3 pontos acima (hostname neutro, credenciais,
> `$env` pro filtro) existem pra que o MESMO JSON exportado em
> `workflows/` rode em dev e prod sem precisar editar nó nenhum na hora do
> deploy. Ver `workflows/README.md` para o passo a passo de import em prod, e
> `.context/decisoes.md` (ADR 2026-07-20) pro raciocínio completo.

## Workflows do agente MAG (versionados)

Os workflows do agente WhatsApp (`MAG - Fase 0 (eco WhatsApp)` = A0
identificação + A1 SDR + handoff; `MAG - Nutridora (T+0)` = A2) ficam
versionados em `workflows/*.json` — exportados via n8n-mcp a partir da
instância de dev. Editados ali (n8n-mcp/Claude Code), não direto no editor.
Ver `workflows/README.md` antes de importar em prod pela primeira vez
(credenciais precisam ser recriadas lá, não vêm no JSON).

Documentação completa do agente (personas, specs, roteamento): ver
`docs/subsistemas/02b-agente-whatsapp-n8n.md`.
