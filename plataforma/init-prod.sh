#!/usr/bin/env bash
# Ambiente de produção — containers (nginx + Next.js + Django/gunicorn +
# MySQL) via docker-compose.prod.yml. Único ponto de entrada é a porta 80
# do nginx: funciona acessando http://<EXTERNAL_IP>/ ou http://<DOMAIN>/.
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
if grep -Eq '(troque-esta-senha|gere-uma-chave-forte-aqui|gere-um-segredo-aqui|203\.0\.113\.10)' "$ENV_FILE"; then
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
EXTERNAL_IP="$(grep -E '^EXTERNAL_IP=' "$ENV_FILE" | cut -d= -f2-)"
HTTPS_ENABLED="$(grep -E '^DJANGO_HTTPS_ENABLED=' "$ENV_FILE" | cut -d= -f2-)"
SCHEME="http"
[ "$HTTPS_ENABLED" = "true" ] && SCHEME="https"

echo ""
echo "Acesse:"
echo "  http://${EXTERNAL_IP}/          (teste direto pelo IP da VPS)"
echo "  ${SCHEME}://${DOMAIN}/          (quando o DNS já apontar pra cá)"
echo "  .../dj-admin/  -> admin do Django"
echo "  .../api/       -> API"
echo ""
echo "Logs em tempo real: docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs -f"
echo "Parar tudo:         docker compose --env-file $ENV_FILE -f $COMPOSE_FILE down"
