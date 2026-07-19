#!/usr/bin/env bash
# Runner único da suíte de testes (spec 001) — "posso deployar?" em ~1 min.
#
# Sempre roda: backend (Django, settings isolado — nunca db.sqlite3/media
# reais) + checagem de sintaxe dos JS estáticos do admin (node --check, se
# houver Node) + testes de lógica pura do frontend (Vitest — rápido, sem
# jsdom/build, só lib/* e rotas de API).
#
# Flag opcional:
#   --full   também roda `tsc --noEmit` + `next build` no frontend (mais
#            lento; obrigatório antes de deploy, não precisa no dia a dia).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

COM_FULL=false
for arg in "$@"; do
  case "$arg" in
    --full) COM_FULL=true ;;
    *) echo "Opção desconhecida: $arg (única suportada: --full)" >&2; exit 1 ;;
  esac
done

echo "==> Backend (manage.py test — config.settings.test)"
cd "$BACKEND_DIR"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
python manage.py test --settings=config.settings.test
deactivate
cd "$SCRIPT_DIR"
echo ""

echo "==> Estáticos (node --check nos JS do admin/Studio)"
if command -v node >/dev/null 2>&1; then
  arquivos_js=$(find "$BACKEND_DIR/static" -name "*.js" 2>/dev/null || true)
  if [ -z "$arquivos_js" ]; then
    echo "(nenhum .js encontrado em backend/static — nada a checar)"
  else
    while IFS= read -r arquivo; do
      node --check "$arquivo"
      echo "  ok: ${arquivo#"$BACKEND_DIR"/}"
    done <<< "$arquivos_js"
  fi
else
  echo "Node não encontrado — pulando checagem de sintaxe dos estáticos." >&2
fi
echo ""

echo "==> Frontend — lógica pura (Vitest: lib/*, app/api/revalidate)"
cd "$FRONTEND_DIR"
if [ ! -d node_modules ]; then
  npm install
fi
npm run test
cd "$SCRIPT_DIR"
echo ""

if [ "$COM_FULL" = true ]; then
  echo "==> Frontend (--full: tsc --noEmit + next build)"
  cd "$FRONTEND_DIR"
  npx tsc --noEmit
  npm run build
  cd "$SCRIPT_DIR"
  echo ""
fi

echo "Suíte verde. Pode deployar."
