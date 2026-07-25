#!/usr/bin/env bash
# Reexporta os workflows do n8n de DEV pros arquivos versionados aqui.
#
# Contrapartida do promover-prod.sh: aquele leva daqui pra produção, este
# traz de dev pra cá. Usa o CLI do próprio n8n (`n8n export:workflow`) e
# normaliza o resultado com _limpar_export.py, então o formato do arquivo é
# sempre o mesmo — sem diff cosmético escondendo a mudança real na revisão.
#
#   ./exportar-dev.sh                      # todos
#   ./exportar-dev.sh mag-fase-0-sdr.json  # só um
set -euo pipefail

cd "$(dirname "$0")"

CONTAINER="${MAGMA_N8N_CONTAINER:-magma-n8n-dev}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# arquivo versionado -> id do workflow no n8n de DEV
declare -A IDS=(
  ["mag-fase-0-sdr.json"]="ypeJKZLsGq1WxkQB"
  ["mag-nutridora-t0.json"]="3qI5VzAWMZbU2vly"
  ["mag-nutridora-t1-t3-t7.json"]="ZkAxwOPuWVxWncax"
  ["mag-radar-resumo-diario.json"]="kq6ULUF5lYU9HRQf"
  ["mag-avisar-equipe.json"]="8PELlklNlOVVrTl9"
)

alvos=("$@")
if [ ${#alvos[@]} -eq 0 ]; then
  alvos=("${!IDS[@]}")
fi

for arquivo in "${alvos[@]}"; do
  id="${IDS[$arquivo]:-}"
  if [ -z "$id" ]; then
    echo "erro: '$arquivo' não está no mapa de IDs deste script." >&2
    exit 1
  fi
  docker exec "$CONTAINER" n8n export:workflow --id="$id" --output=/tmp/exp.json >/dev/null
  docker cp "$CONTAINER:/tmp/exp.json" "$TMP/exp.json" >/dev/null
  python3 _limpar_export.py "$TMP/exp.json" "$arquivo"
done

echo
echo "Confira o diff antes de commitar: git diff -- plataforma/n8n/workflows/"
