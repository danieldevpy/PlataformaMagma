#!/usr/bin/env python3
"""Prepara um workflow exportado do dev pra ser importado em prod: injeta o
`id` do workflow já existente em prod (import atualiza em vez de duplicar)
e remapeia os IDs de credencial de cada nó (cada instância n8n tem os seus
próprios IDs, mesmo pra credenciais com nome idêntico ao de dev).

Chamado por promover-prod.sh — não roda sozinho no dia a dia."""

import json
import sys


def main():
    local_path, ids_path, saida_path = sys.argv[1:4]

    workflow = json.load(open(local_path))
    ids = json.load(open(ids_path))

    nome = workflow["name"]
    if nome not in ids["workflows"]:
        sys.exit(
            f"Workflow '{nome}' não está em {ids_path} — adicione o ID de "
            f"prod lá antes de promover (primeira vez: importe manualmente "
            f"em prod uma vez e pegue o ID gerado; ver README.md)."
        )
    workflow["id"] = ids["workflows"][nome]

    trocados = 0
    faltando = set()
    for node in workflow["nodes"]:
        credenciais = node.get("credentials")
        if not credenciais:
            continue
        for ref in credenciais.values():
            nome_credencial = ref.get("name")
            if nome_credencial in ids["credenciais"]:
                ref["id"] = ids["credenciais"][nome_credencial]
                trocados += 1
            else:
                faltando.add(nome_credencial)

    if faltando:
        sys.exit(
            f"Credencial(is) sem mapeamento em {ids_path}: {sorted(faltando)} "
            f"— adicione o ID de prod dela(s) antes de promover (ver "
            f"README.md § 'Descobrir um ID novo')."
        )

    json.dump(workflow, open(saida_path, "w"), ensure_ascii=False, indent=2)
    print(f"OK — {trocados} referências de credencial remapeadas pra prod.")


if __name__ == "__main__":
    main()
