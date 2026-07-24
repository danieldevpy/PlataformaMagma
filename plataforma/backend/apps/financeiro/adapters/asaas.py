"""Cliente HTTP do Asaas — `requests` puro, mesma linha dos adapters de IA
(ver apps/ia/adapters/gemini.py::_chamar): trata erro de rede/HTTP como
exceção de domínio (`ErroAsaas`) com mensagem em linguagem humana, nunca
deixa vazar stack trace/payload cru pra quem chamou (ação do agente,
Admin)."""

import requests

TIMEOUT_SEGUNDOS = 15

URL_BASE = {
    "sandbox": "https://api-sandbox.asaas.com/v3",
    "producao": "https://api.asaas.com/v3",
}


class ErroAsaas(Exception):
    """Erro ao chamar a API do Asaas — mensagem já pronta pra ir direto no
    `{"detail": ...}`/`ErroAcao` de quem chamou."""


def _headers(config):
    chave = config.get_credencial()
    if not chave:
        raise ErroAsaas(
            f"Nenhuma chave de API cadastrada pro ambiente {config.get_ambiente_display()}."
        )
    return {"access_token": chave, "content-type": "application/json"}


def _chamar(config, metodo, caminho, **kwargs):
    url = f"{URL_BASE[config.ambiente]}{caminho}"
    try:
        resposta = requests.request(
            metodo, url, headers=_headers(config), timeout=TIMEOUT_SEGUNDOS, **kwargs
        )
    except requests.RequestException as erro:
        raise ErroAsaas(f"Falha de conexão com o Asaas: {erro}") from erro

    try:
        corpo = resposta.json()
    except ValueError:
        corpo = {}

    if resposta.status_code >= 400:
        erros = corpo.get("errors") or []
        mensagem = erros[0].get("description") if erros else resposta.text[:200]
        raise ErroAsaas(f"Asaas recusou a chamada: {mensagem}")

    return corpo


def buscar_ou_criar_cliente(config, aluno):
    """Procura um cliente Asaas já criado pra esse aluno por
    `externalReference` (o `aluno.token`) — sem guardar o id localmente,
    evita mais uma tabela e a ambiguidade de qual ambiente ele pertence.
    Cria se não achar."""
    referencia = str(aluno.token)

    encontrados = _chamar(
        config, "GET", "/customers", params={"externalReference": referencia}
    )
    dados = encontrados.get("data") or []
    if dados:
        return dados[0]["id"]

    payload = {"name": aluno.nome, "cpfCnpj": aluno.cpf, "externalReference": referencia}
    if aluno.whatsapp:
        payload["mobilePhone"] = aluno.whatsapp
    if aluno.email:
        payload["email"] = aluno.email

    criado = _chamar(config, "POST", "/customers", json=payload)
    return criado["id"]


def criar_cobranca(config, customer_id, valor, vencimento, billing_type, external_reference):
    corpo = _chamar(
        config,
        "POST",
        "/payments",
        json={
            "customer": customer_id,
            "billingType": billing_type,
            "value": float(valor),
            "dueDate": vencimento.isoformat(),
            "externalReference": external_reference,
        },
    )
    return {
        "id": corpo["id"],
        "link_pagamento": corpo["invoiceUrl"],
        "status": corpo.get("status", "PENDING"),
    }
