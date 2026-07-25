"""Converte o export cru do `n8n export:workflow` pro formato versionado do
repo: só name/nodes/connections/settings, sem id de workflow (o
promover-prod.sh injeta o de prod) e sem metadados de instância.
"""

import json
import sys

CHAVES_NO = {
    "id",
    "name",
    "type",
    "typeVersion",
    "position",
    "parameters",
    "credentials",
    "webhookId",
    "onError",
    "disabled",
    "notes",
    "notesInFlow",
    "alwaysOutputData",
    "retryOnFail",
    "maxTries",
    "waitBetweenTries",
    "executeOnce",
}

bruto = json.load(open(sys.argv[1], encoding="utf-8"))
if isinstance(bruto, list):
    bruto = bruto[0]

limpo = {
    "name": bruto["name"],
    "nodes": [{k: v for k, v in n.items() if k in CHAVES_NO} for n in bruto["nodes"]],
    "connections": bruto["connections"],
    "settings": bruto.get("settings", {"executionOrder": "v1"}),
}

with open(sys.argv[2], "w", encoding="utf-8") as f:
    json.dump(limpo, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"{sys.argv[2]}: {len(limpo['nodes'])} nós")
