#!/usr/bin/env bash
# Ambiente de desenvolvimento — local, sem Docker. Backend Django com
# SQLite (config/settings/dev.py) + frontend Next.js em modo dev, cada um
# no seu processo. Ctrl+C encerra os dois.
#
# Flag opcional:
#   --n8n   sobe também o n8n em container (http://localhost:5678); ele fica
#           rodando em segundo plano mesmo depois do Ctrl+C — parar com:
#           docker compose -f n8n/docker-compose.dev.yml down
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

COM_N8N=false
for arg in "$@"; do
  case "$arg" in
    --n8n) COM_N8N=true ;;
    *) echo "Opção desconhecida: $arg (única suportada: --n8n)" >&2; exit 1 ;;
  esac
done

warn_if_port_busy() {
  local port="$1" label="$2"
  if command -v lsof >/dev/null 2>&1 && lsof -i ":$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Aviso: a porta $port já está em uso (esperada pro $label)."
    echo "Pode ser uma instância anterior deste projeto ainda rodando. Detalhes:"
    lsof -i ":$port" -sTCP:LISTEN || true
    echo ""
  fi
}

warn_if_port_busy 8000 backend
warn_if_port_busy 3000 frontend

if [ "$COM_N8N" = true ]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "--n8n requer Docker instalado; seguindo sem o n8n." >&2
  else
    echo "==> n8n (container) — http://localhost:5678"
    docker compose -f "$SCRIPT_DIR/n8n/docker-compose.dev.yml" up -d
  fi
fi

echo "==> Backend (Django + SQLite) — http://localhost:8000"
cd "$BACKEND_DIR"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
# Sem .env mesmo: config/settings/dev.py não exige nenhuma variável (SQLite
# fixo, SECRET_KEY tem default de dev em base.py). backend/.env.example é
# só referência pras variáveis que o modo prod usa.
python manage.py migrate --noinput
python manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!
deactivate
cd "$SCRIPT_DIR"

echo "==> Frontend (Next.js dev) — http://localhost:3000"
cd "$FRONTEND_DIR"
if [ ! -d node_modules ]; then
  npm install
fi
if [ ! -f .env.local ]; then
  cp .env.local.example .env.local
  echo "(criado frontend/.env.local a partir do .env.local.example)"
fi
npm run dev &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

cleanup() {
  echo ""
  echo "Encerrando backend e frontend..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup INT TERM

echo ""
echo "Backend:  http://localhost:8000/api/   (admin em /dj-admin/)"
echo "Frontend: http://localhost:3000"
if [ "$COM_N8N" = true ]; then
  echo "n8n:      http://localhost:5678   (segue rodando após o Ctrl+C; parar: docker compose -f n8n/docker-compose.dev.yml down)"
fi
echo "Ctrl+C para parar backend e frontend."
echo ""

wait
