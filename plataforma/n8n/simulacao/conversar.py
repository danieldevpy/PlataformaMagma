#!/usr/bin/env python3
"""Um turno de conversa simulada com a MAG, no n8n de DEV.

    ./conversar.py 5500900000001 "Rafa" "oi, quanto custa o curso?"
    ./conversar.py 5500900000001 "Rafa" "oi" "quanto custa" "o de 120h"

Manda a(s) mensagem(ns) no webhook do n8n como se viessem da Evolution
API, espera a execução terminar e imprime a resposta da MAG + as tools
que ela chamou. Várias mensagens numa chamada simulam alguém digitando em
fragmentos (elas caem dentro da janela de debounce de 5s da spec 016 e
viram uma mensagem só).

## Por que é seguro

Os números de teste usam **DDD 00** (`5500 9xxxxxxxx`), que não existe em
WhatsApp real. Consequência: o nó `Responder no WhatsApp (SDR)` falha de
propósito no fim do fluxo com "Bad request" e nada é entregue ao telefone
de ninguém. A conversa é lida do banco de execuções do n8n, não do
WhatsApp — por isso o `ler_execucoes.js`.

Efeito colateral a saber: como o fluxo morre no envio, ele não chega no
`Registrar conversa (SDR)`, então estas conversas **não** aparecem em
`conversas_conversa`.

## Pré-requisitos

Ver README.md desta pasta — o principal é que dev só responde a números
que casem com `MAGMA_NUMEROS_TESTE_REGEX`, e os de DDD 00 não casam com o
valor padrão. Suba o n8n com o override:

    docker compose -f docker-compose.dev.yml -f simulacao/override.dev.yml up -d
"""

import json
import random
import string
import subprocess
import sys
import time
import urllib.request

WEBHOOK = "http://localhost:5678/webhook/whatsapp-in"
CONTAINER = "magma-n8n-dev"
SEGUNDOS_ENTRE_FRAGMENTOS = 2
PRAZO_RESPOSTA = 150


def _sql(consulta):
    r = subprocess.run(
        ["docker", "exec", CONTAINER, "node", "-e", consulta],
        capture_output=True,
        text=True,
    )
    return r.stdout.strip()


def ultima_execucao():
    return int(
        _sql(
            "const p='/usr/local/lib/node_modules/n8n/node_modules/.pnpm';"
            "const fs=require('fs');"
            "const d=fs.readdirSync(p).find(x=>x.startsWith('sqlite3@'));"
            "const s=require(p+'/'+d+'/node_modules/sqlite3');"
            "const b=new s.Database('/home/node/.n8n/database.sqlite',s.OPEN_READONLY);"
            "b.get('select max(id) m from execution_entity',(e,r)=>console.log(r.m||0));"
        )
        or 0
    )


def ler(desde):
    r = subprocess.run(
        ["docker", "exec", CONTAINER, "node", "/tmp/ler_execucoes.js", str(desde)],
        capture_output=True,
        text=True,
    )
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        return []


def enviar(numero, push_name, texto):
    mid = "SIM" + "".join(random.choices(string.ascii_uppercase + string.digits, k=16))
    payload = {
        "event": "messages.upsert",
        "instance": "Agente Whatsapp",
        "data": {
            "key": {
                "remoteJid": f"{numero}@s.whatsapp.net",
                "fromMe": False,
                "id": mid,
            },
            "pushName": push_name,
            "message": {"conversation": texto},
            "messageType": "conversation",
            "messageTimestamp": int(time.time()),
        },
        # Número da instância que recebeu a mensagem. Nenhum workflow lê
        # este campo — ele só existe pra manter o payload fiel ao da
        # Evolution. Fica com DDD 00 (inexistente) de propósito, pra não
        # versionar telefone de gente de verdade.
        "sender": "5500900000000@s.whatsapp.net",
    }
    req = urllib.request.Request(
        WEBHOOK,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    urllib.request.urlopen(req, timeout=15).read()


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)

    numero, push_name, mensagens = sys.argv[1], sys.argv[2], sys.argv[3:]
    base = ultima_execucao()

    for i, texto in enumerate(mensagens):
        enviar(numero, push_name, texto)
        print(f"[{push_name}] {texto}")
        if i < len(mensagens) - 1:
            time.sleep(SEGUNDOS_ENTRE_FRAGMENTOS)

    alvo = None
    prazo = time.time() + PRAZO_RESPOSTA
    while time.time() < prazo and alvo is None:
        time.sleep(4)
        for execucao in ler(base):
            if execucao.get("numero") == numero and execucao.get("agente_texto"):
                alvo = execucao

    if alvo is None:
        print(f"\n[MAG] (sem resposta do agente em {PRAZO_RESPOSTA}s)")
        print("\nExecuções novas — útil pra ver se o contato está silenciado:")
        for execucao in ler(base):
            nos = execucao.get("nos") or []
            print(
                f"  #{execucao['id']} {execucao['status']} "
                f"numero={execucao.get('numero')} "
                f"ultimo_no={nos[-1] if nos else '—'}"
            )
        sys.exit(1)

    print(f"\n[MAG] {alvo['agente_texto']}")
    print(
        f"\n--- execução #{alvo['id']} status={alvo['status']} "
        f"papel={alvo['papel']} escalado={alvo['escalado']}"
    )
    for tool in alvo["tools"]:
        print(f"    tool: {tool['tool']}  {json.dumps(tool['input'], ensure_ascii=False)}")
    if alvo["erro"]:
        # Esperado nos números de DDD 00: o envio pra Evolution falha.
        print(f"    erro no nó: {alvo['erro']}")


if __name__ == "__main__":
    main()
