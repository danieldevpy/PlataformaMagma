"""Adaptador OpenAI — Chat Completions API via `requests` puro (sem SDK),
alternativa a Anthropic pra capacidades de texto (ver
docs/subsistemas/10-studio-2.0.md §5.5)."""

import requests

from apps.ia.adapters.base import AdaptadorBase, ErroAdaptadorIA

URL_CHAT_COMPLETIONS = "https://api.openai.com/v1/chat/completions"
MODELO_PADRAO = "gpt-4o-mini"
TIMEOUT_SEGUNDOS = 30


class AdaptadorOpenAI(AdaptadorBase):
    capacidades = {"texto.gerar", "texto.melhorar", "texto.variacoes"}

    def executar(self, capacidade, contexto):
        from apps.ia.prompts import montar_mensagem

        sistema, mensagem_usuario = montar_mensagem(capacidade, contexto)
        payload = {
            "model": self.provedor_ia.modelo or MODELO_PADRAO,
            "messages": [
                {"role": "system", "content": sistema},
                {"role": "user", "content": mensagem_usuario},
            ],
        }
        corpo = self._chamar(payload)

        escolhas = corpo.get("choices") or []
        texto = escolhas[0]["message"]["content"] if escolhas else ""
        uso = corpo.get("usage") or {}
        return {
            "resultado": (texto or "").strip(),
            "tokens_entrada": uso.get("prompt_tokens"),
            "tokens_saida": uso.get("completion_tokens"),
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
            raise ErroAdaptadorIA("Provedor OpenAI sem credencial configurada.")

        try:
            resposta = requests.post(
                URL_CHAT_COMPLETIONS,
                json=payload,
                headers={
                    "Authorization": f"Bearer {chave}",
                    "content-type": "application/json",
                },
                timeout=TIMEOUT_SEGUNDOS,
            )
        except requests.RequestException as erro:
            raise ErroAdaptadorIA(f"Falha de conexão com a OpenAI: {erro}") from erro

        try:
            corpo = resposta.json()
        except ValueError:
            corpo = {}

        if resposta.status_code >= 400:
            mensagem = (corpo.get("error") or {}).get("message") or resposta.text[:200]
            raise ErroAdaptadorIA(f"OpenAI recusou a chamada: {mensagem}")

        return corpo
