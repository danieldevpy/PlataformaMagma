"""Adaptador Google Gemini — Generative Language API via `requests` puro
(sem SDK), mesma linha de OpenAI/Anthropic (ver
docs/subsistemas/10-studio-2.0.md §5.5). A chave vai como query param
`key=` (padrão da API do Gemini, diferente de header nos outros dois)."""

import requests

from apps.ia.adapters.base import AdaptadorBase, ErroAdaptadorIA

URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
MODELO_PADRAO = "gemini-2.0-flash"
TIMEOUT_SEGUNDOS = 30


class AdaptadorGemini(AdaptadorBase):
    capacidades = {"texto.gerar", "texto.melhorar", "texto.variacoes"}

    def executar(self, capacidade, contexto):
        from apps.ia.prompts import montar_mensagem

        sistema, mensagem_usuario = montar_mensagem(capacidade, contexto)
        payload = {
            "system_instruction": {"parts": [{"text": sistema}]},
            "contents": [{"role": "user", "parts": [{"text": mensagem_usuario}]}],
        }
        corpo = self._chamar(payload)

        candidatos = corpo.get("candidates") or []
        partes = (candidatos[0].get("content") or {}).get("parts") if candidatos else []
        texto = "".join(parte.get("text", "") for parte in (partes or []))
        uso = corpo.get("usageMetadata") or {}
        return {
            "resultado": texto.strip(),
            "tokens_entrada": uso.get("promptTokenCount"),
            "tokens_saida": uso.get("candidatesTokenCount"),
        }

    def testar(self):
        payload = {
            "contents": [{"role": "user", "parts": [{"text": "Responda apenas: ok"}]}],
            "generationConfig": {"maxOutputTokens": 8},
        }
        self._chamar(payload)
        return True

    def _chamar(self, payload):
        chave = self.provedor_ia.get_credencial()
        if not chave:
            raise ErroAdaptadorIA("Provedor Gemini sem credencial configurada.")

        modelo = self.provedor_ia.modelo or MODELO_PADRAO
        url = f"{URL_BASE}/{modelo}:generateContent"

        try:
            resposta = requests.post(
                url,
                params={"key": chave},
                json=payload,
                headers={"content-type": "application/json"},
                timeout=TIMEOUT_SEGUNDOS,
            )
        except requests.RequestException as erro:
            raise ErroAdaptadorIA(f"Falha de conexão com o Gemini: {erro}") from erro

        try:
            corpo = resposta.json()
        except ValueError:
            corpo = {}

        if resposta.status_code >= 400:
            mensagem = (corpo.get("error") or {}).get("message") or resposta.text[:200]
            raise ErroAdaptadorIA(f"Gemini recusou a chamada: {mensagem}")

        return corpo
