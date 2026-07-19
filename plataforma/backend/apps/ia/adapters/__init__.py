"""Adaptadores de provedor de IA — cada um implementa `AdaptadorBase` (ver
`apps/ia/adapters/base.py`) e declara quais capacidades sabe executar.
Trocar de provedor não toca o Studio nem `views.py`: só este registro muda.
"""

from apps.ia.adapters.anthropic import AdaptadorAnthropic
from apps.ia.adapters.base import AdaptadorBase, ErroAdaptadorIA
from apps.ia.adapters.gemini import AdaptadorGemini
from apps.ia.adapters.openai import AdaptadorOpenAI

REGISTRO_ADAPTADORES = {
    "anthropic": AdaptadorAnthropic,
    "openai": AdaptadorOpenAI,
    "gemini": AdaptadorGemini,
}


def obter_adaptador(provedor_ia):
    """Instancia o adaptador certo pra uma `ProvedorIA` (models.py) — usado
    por `views.py` pra não conhecer detalhe nenhum de provedor específico."""
    classe = REGISTRO_ADAPTADORES.get(provedor_ia.provedor)
    if classe is None:
        raise ErroAdaptadorIA(f'Provedor "{provedor_ia.provedor}" sem adaptador implementado.')
    return classe(provedor_ia)


__all__ = [
    "AdaptadorBase",
    "ErroAdaptadorIA",
    "REGISTRO_ADAPTADORES",
    "obter_adaptador",
]
