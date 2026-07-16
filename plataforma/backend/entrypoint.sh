#!/bin/sh
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-3306}"

echo "Aguardando banco de dados em ${DB_HOST}:${DB_PORT}..."
python - "$DB_HOST" "$DB_PORT" <<'PY'
import socket
import sys
import time

host, port = sys.argv[1], int(sys.argv[2])
for _ in range(60):
    try:
        socket.create_connection((host, port), timeout=2).close()
        break
    except OSError:
        time.sleep(2)
else:
    sys.exit(f"Banco de dados {host}:{port} não respondeu a tempo.")
PY
echo "Banco disponível."

# Permite sobrescrever o comando (ex.: `docker compose run backend python
# manage.py createsuperuser`) — espera o banco subir e roda isso no lugar
# do fluxo padrão abaixo.
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}"
