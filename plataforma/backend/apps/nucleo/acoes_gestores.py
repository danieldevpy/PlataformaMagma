"""Ação de descoberta dos gestores pro agente WhatsApp (ver
apps/nucleo/acoes.py) — usada pelos workflows proativos (Radar, handoff)
pra mandar mensagem pra todos os gestores em vez de um número fixo no
n8n. Ver specs/019-agente-whatsapp-radar-diario (adendo 2026-07-24)."""

from apps.contas.models import Usuario
from apps.nucleo.acoes import registrar_acao


@registrar_acao(
    nome="listar_gestores",
    descricao=(
        "Lista os gestores com WhatsApp cadastrado, pra mandar avisos "
        "proativos (resumo diário, handoff) pra todos em vez de um "
        "número fixo."
    ),
    params={},
    escopo="nucleo:listar_gestores",
)
def listar_gestores(params, request):
    gestores = Usuario.objects.filter(
        papel=Usuario.Papel.GESTOR, is_active=True
    ).exclude(whatsapp="")
    return [
        {"nome": gestor.get_full_name() or gestor.username, "whatsapp": gestor.whatsapp}
        for gestor in gestores.order_by("username")
    ]
