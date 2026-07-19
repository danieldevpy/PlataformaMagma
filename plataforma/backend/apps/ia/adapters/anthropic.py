"""Adaptador Anthropic — Messages API via `requests` puro (sem SDK), como
pedido no plan.md da spec 004. Cobre as capacidades de texto; modelo padrão
`claude-sonnet-5` (ver docs/subsistemas/10-studio-2.0.md §5.5)."""

import requests

from apps.ia.adapters.base import AdaptadorBase, ErroAdaptadorIA

URL_MESSAGES = "https://api.anthropic.com/v1/messages"
VERSAO_API = "2023-06-01"
MODELO_PADRAO = "claude-sonnet-5"
TIMEOUT_SEGUNDOS = 30
MAX_TOKENS_PADRAO = 1024


class AdaptadorAnthropic(AdaptadorBase):
    capacidades = {"texto.gerar", "texto.melhorar", "texto.variacoes"}

    def executar(self, capacidade, contexto):
        from apps.ia.prompts import montar_mensagem

        sistema, mensagem_usuario = montar_mensagem(capacidade, contexto)
        payload = {
            "model": self.provedor_ia.modelo or MODELO_PADRAO,
            "max_tokens": self.provedor_ia.config.get("max_tokens", MAX_TOKENS_PADRAO),
            "system": sistema,
            "messages": [{"role": "user", "content": mensagem_usuario}],
        }
        corpo = self._chamar(payload)

        blocos = corpo.get("content") or []
        texto = "".join(
            bloco.get("text", "") for bloco in blocos if bloco.get("type") == "text"
        )
        uso = corpo.get("usage") or {}
        return {
            "resultado": texto.strip(),
            "tokens_entrada": uso.get("input_tokens"),
            "tokens_saida": uso.get("output_tokens"),
        }

    def testar(self):
        payload = {
            "model": self.provedor_ia.modelo or MODELO_PADRAO,
            "max_tokens": 8,
            "messages": [{"role": "user", "content": "Responda apenas: ok"}],
        }
        self._chamar(payload)
        return True

    def _chamar(self, payload):
        chave = self.provedor_ia.get_credencial()
        if not chave:
            raise ErroAdaptadorIA("Provedor Anthropic sem credencial configurada.")

        try:
            resposta = requests.post(
                URL_MESSAGES,
                json=payload,
                headers={
                    "x-api-key": chave,
                    "anthropic-version": VERSAO_API,
                    "content-type": "application/json",
                },
                timeout=TIMEOUT_SEGUNDOS,
            )
        except requests.RequestException as erro:
            raise ErroAdaptadorIA(
                f"Falha de conexão com a Anthropic: {erro}"
            ) from erro

        try:
            corpo = resposta.json()
        except ValueError:
            corpo = {}

        if resposta.status_code >= 400:
            mensagem = (corpo.get("error") or {}).get("message") or resposta.text[:200]
            raise ErroAdaptadorIA(f"Anthropic recusou a chamada: {mensagem}")

        return corpo
