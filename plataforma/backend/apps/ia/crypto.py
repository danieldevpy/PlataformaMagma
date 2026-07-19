"""Criptografia da credencial (chave de API) dos provedores de IA — a chave
NUNCA fica em texto puro no banco (ver docs/subsistemas/10-studio-2.0.md §5.2
e §10 "Chaves de API"). Fernet com chave simétrica derivada do próprio
`SECRET_KEY` do Django: nada de segredo novo pra gerenciar em produção."""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _chave_fernet():
    # ATENÇÃO operacional: rotacionar DJANGO_SECRET_KEY em produção invalida
    # SILENCIOSAMENTE toda credencial de ProvedorIA já salva (decifrar()
    # passa a devolver "" — sem exceção, sem aviso). Antes de trocar o
    # SECRET_KEY em prod, recadastre as chaves de API na página Integrações.
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def cifrar(texto_plano):
    """Cifra uma string (ex.: chave de API) — retorna "" se não houver nada
    pra cifrar (provedor ainda sem credencial cadastrada)."""
    if not texto_plano:
        return ""
    fernet = Fernet(_chave_fernet())
    return fernet.encrypt(texto_plano.encode("utf-8")).decode("utf-8")


def decifrar(texto_cifrado):
    """Reverte `cifrar`. Retorna "" em vez de derrubar a request se o valor
    estiver vazio ou ilegível (ex.: SECRET_KEY trocado) — quem chama trata
    isso como "provedor sem credencial válida", nunca como erro 500."""
    if not texto_cifrado:
        return ""
    fernet = Fernet(_chave_fernet())
    try:
        return fernet.decrypt(texto_cifrado.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""
