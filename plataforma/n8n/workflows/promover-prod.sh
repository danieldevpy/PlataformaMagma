#!/usr/bin/env bash
# Promove um workflow do n8n de dev pra prod (spec 013, 2026-07-21) —
# automatiza o que antes era feito na mão: achar o ID do workflow em prod,
# remapear os IDs de credencial, importar, publicar e reiniciar o n8n de
# prod pra aplicar. Ver README.md pra contexto completo.
#
# Uso:
#   plataforma/n8n/workflows/promover-prod.sh mag-fase-0-sdr.json
#   plataforma/n8n/workflows/promover-prod.sh mag-nutridora-t0.json
#
# Pré-requisito: ssh configurado pro host da VPS (ver VPS_HOST abaixo) e
# ids-prod.json com o workflow/credenciais já mapeados (ver esse arquivo).
#
# O que o script faz (nessa ordem):
#   1. Monta uma cópia do JSON local com o ID de prod injetado e as
#      credenciais remapeadas (_montar_json_prod.py).
#   2. Copia pra VPS e importa dentro do container do n8n (atualiza o
#      workflow existente, não duplica).
#   3. Publica a versão importada.
#   4. Reinicia o container do n8n — NECESSÁRIO pra publicação ter efeito
#      nesse modo de deployment (não-cluster). Isso derruba o processamento
#      de webhook por alguns segundos (bots MAG ficam sem responder
#      brevemente) — não roda isso sem querer promover de verdade.
#
# Depois de rodar, teste manualmente mandando uma mensagem de teste pro
# número do bot antes de considerar terminado.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VPS_HOST="45.231.133.116"
N8N_CONTAINER="plataforma-n8n-1"

if [ $# -ne 1 ]; then
  echo "Uso: $0 <arquivo.json>  (ex.: mag-fase-0-sdr.json)" >&2
  exit 1
fi

ARQUIVO="$1"
LOCAL_JSON="$SCRIPT_DIR/$ARQUIVO"
IDS_JSON="$SCRIPT_DIR/ids-prod.json"

if [ ! -f "$LOCAL_JSON" ]; then
  echo "Arquivo não encontrado: $LOCAL_JSON" >&2
  exit 1
fi
if [ ! -f "$IDS_JSON" ]; then
  echo "Falta $IDS_JSON (mapa de IDs de prod) — ver README.md." >&2
  exit 1
fi

TMP_JSON="$(mktemp /tmp/mag-prod-XXXXXX.json)"
trap 'rm -f "$TMP_JSON"' EXIT

echo "==> Montando JSON pronto pra prod (ID do workflow + credenciais remapeadas)"
python3 "$SCRIPT_DIR/_montar_json_prod.py" "$LOCAL_JSON" "$IDS_JSON" "$TMP_JSON"

echo "==> Copiando pra VPS"
scp -q "$TMP_JSON" "$VPS_HOST:/tmp/mag-prod-import.json"

echo "==> Importando, publicando e reiniciando o n8n de prod"
# shellcheck disable=SC2087
ssh "$VPS_HOST" N8N_CONTAINER="$N8N_CONTAINER" bash -s <<'REMOTO'
set -euo pipefail
docker cp /tmp/mag-prod-import.json "${N8N_CONTAINER}":/tmp/mag-prod-import.json
WF_ID=$(docker exec "${N8N_CONTAINER}" node -e "console.log(require('/tmp/mag-prod-import.json').id)")
docker exec "${N8N_CONTAINER}" n8n import:workflow --input=/tmp/mag-prod-import.json
docker exec "${N8N_CONTAINER}" n8n publish:workflow --id="$WF_ID"
docker exec "${N8N_CONTAINER}" rm -f /tmp/mag-prod-import.json
rm -f /tmp/mag-prod-import.json

echo "==> Reiniciando n8n pra aplicar a publicação"
docker restart "${N8N_CONTAINER}"

echo "==> Aguardando ficar saudável"
for i in $(seq 1 15); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "${N8N_CONTAINER}" 2>/dev/null || echo "unknown")
  if [ "$status" = "healthy" ]; then
    echo "n8n saudável."
    exit 0
  fi
  sleep 2
done
echo "AVISO: n8n não ficou 'healthy' em 30s — conferir 'docker logs ${N8N_CONTAINER}' na VPS." >&2
REMOTO

echo ""
echo "==> Pronto. Workflow '$ARQUIVO' promovido pra prod."
echo "Teste manualmente mandando uma mensagem de teste pro número do bot antes de considerar terminado."
