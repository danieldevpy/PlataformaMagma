"""Identificação de contato e handoff pro agente de WhatsApp (ver
apps/nucleo/acoes.py, specs/009-agente-whatsapp-fundacao,
specs/012-agente-whatsapp-handoff e docs/subsistemas/02b-agente-whatsapp-n8n.md §3-4).
"""

from apps.contas.models import Usuario
from apps.leads.models import Lead
from apps.nucleo.acoes import ErroAcao, registrar_acao
from apps.nucleo.models import ContatoEscalado


@registrar_acao(
    nome="identificar_contato",
    descricao=(
        "Resolve o papel de quem está falando no WhatsApp (gestor/instrutor "
        "via Usuario, lead via Lead, ou desconhecido) a partir do número, e "
        "se o contato está escalado (silenciado até liberação manual)."
    ),
    params={"numero": "string, só dígitos com DDI (sem @s.whatsapp.net)"},
    escopo="nucleo:identificar_contato",
)
def identificar_contato(params, request):
    numero = (params.get("numero") or "").strip()
    if not numero:
        raise ErroAcao("Informe 'numero'.")

    escalado = ContatoEscalado.objects.filter(numero=numero).exists()

    usuario = Usuario.objects.filter(whatsapp=numero, is_active=True).first()
    if usuario is not None:
        return {
            "papel": usuario.papel,
            "nome": usuario.get_full_name() or usuario.username,
            "escalado": escalado,
        }

    lead = Lead.objects.filter(whatsapp=numero).first()
    if lead is not None:
        return {"papel": "lead", "nome": lead.nome, "escalado": escalado}

    return {"papel": "desconhecido", "nome": None, "escalado": escalado}


@registrar_acao(
    nome="escalar_contato",
    descricao=(
        "Marca um número como escalado pro humano — a MAG para de responder "
        "automaticamente esse contato até alguém da equipe liberar (apagar "
        "o registro no admin)."
    ),
    params={
        "numero": "string, só dígitos com DDI",
        "motivo": "string, por que está escalando (ex.: 'quer fechar matrícula')",
    },
    escopo="nucleo:escalar_contato",
)
def escalar_contato(params, request):
    numero = (params.get("numero") or "").strip()
    motivo = (params.get("motivo") or "").strip()
    if not numero:
        raise ErroAcao("Informe 'numero'.")
    if not motivo:
        raise ErroAcao("Informe 'motivo'.")

    ContatoEscalado.objects.update_or_create(
        numero=numero, defaults={"motivo": motivo}
    )
    return {"ok": True}
