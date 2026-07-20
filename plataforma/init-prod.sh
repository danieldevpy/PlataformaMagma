#!/usr/bin/env bash
# Ambiente de produção — containers (Next.js + Django/gunicorn + MySQL) via
# docker-compose.prod.yml. O nginx roda no HOST da VPS (não é container),
# termina o TLS e faz proxy pros containers publicados no loopback:
#   /api e /dj-admin -> 127.0.0.1:8000  |  resto -> 127.0.0.1:3000
# Ver nginx/nginx.conf (config de referência pra copiar em /etc/nginx).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE=".env.prod"
COMPOSE_FILE="docker-compose.prod.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado. Instale o Docker (e o plugin docker compose) antes de continuar." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  cp .env.prod.example "$ENV_FILE"
  echo "Criei $ENV_FILE a partir de .env.prod.example."
  echo "Preencha DOMAIN, EXTERNAL_IP, senhas do MySQL e DJANGO_SECRET_KEY antes de rodar de novo."
  exit 1
fi

# Barra o deploy se algum placeholder óbvio do .example não foi trocado —
# evita subir produção com senha/secret padrão.
if grep -Eq '(troque-esta-senha|gere-uma-chave-forte-aqui|gere-um-segredo-aqui|gere-uma-chave-n8n-aqui|gere-uma-chave-evolution-aqui|203\.0\.113\.10)' "$ENV_FILE"; then
  echo "$ENV_FILE ainda tem valores de exemplo (senha/secret/IP placeholder)." >&2
  echo "Edite $ENV_FILE com os valores reais da VPS antes de subir produção." >&2
  exit 1
fi

echo "==> Build + subida dos containers"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build

echo ""
echo "==> Status"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" | cut -d= -f2-)"
HTTPS_ENABLED="$(grep -E '^DJANGO_HTTPS_ENABLED=' "$ENV_FILE" | cut -d= -f2-)"
SCHEME="http"
[ "$HTTPS_ENABLED" = "true" ] && SCHEME="https"

echo ""
echo "Containers no ar (portas só no loopback 127.0.0.1):"
echo "  backend    -> 127.0.0.1:8000"
echo "  frontend   -> 127.0.0.1:3000"
echo "  n8n        -> 127.0.0.1:5678"
echo "  evolution  -> 127.0.0.1:8080 (gateway WhatsApp, sem domínio público — administração via túnel SSH)"
echo ""
echo "O acesso público é pelo nginx do HOST. Se ainda não configurou:"
echo "  1. Ajuste os caminhos em nginx/nginx.conf pros diretórios abaixo e"
echo "     copie pra /etc/nginx/sites-available/ (veja o cabeçalho do arquivo)."
echo "       static -> ${SCRIPT_DIR}/staticfiles/"
echo "       media  -> ${SCRIPT_DIR}/media/"
echo "  2. sudo nginx -t && sudo systemctl reload nginx"
echo "  3. sudo certbot --nginx -d ${DOMAIN}   (emitir/renovar o TLS)"
echo ""
N8N_DOMAIN="$(grep -E '^N8N_DOMAIN=' "$ENV_FILE" | cut -d= -f2-)"

echo "Depois, acesse:"
echo "  ${SCHEME}://${DOMAIN}/            -> site (Next.js)"
echo "  ${SCHEME}://${DOMAIN}/dj-admin/   -> admin do Django"
echo "  ${SCHEME}://${DOMAIN}/api/        -> API"
echo "  ${SCHEME}://${N8N_DOMAIN:-n8n.$DOMAIN}/  -> n8n (requer DNS + certbot do subdomínio; ver nginx/nginx.conf)"
echo ""
echo "Logs em tempo real: docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs -f"
echo "Parar tudo:         docker compose --env-file $ENV_FILE -f $COMPOSE_FILE down"
