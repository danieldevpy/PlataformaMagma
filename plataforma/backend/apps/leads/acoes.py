"""Ações expostas via `POST /api/acoes/executar/` (ver apps/nucleo/acoes.py)."""

from datetime import timedelta

from django.utils import timezone

from apps.leads.models import Lead
from apps.nucleo.acoes import ErroAcao, registrar_acao


@registrar_acao(
    nome="listar_leads",
    descricao=(
        "Lista leads criados nos últimos N dias corridos (padrão: hoje), "
        "do mais recente pro mais antigo. Filtro opcional por status exato."
    ),
    params={
        "dias": "int, opcional (padrão 1) — janela em dias corridos, contando hoje",
        "status": "string, opcional — filtra por status exato (ex.: 'novo', 'contatado')",
    },
    escopo="leads:listar_leads",
)
def listar_leads(params, request):
    bruto = params.get("dias")
    try:
        dias = int(bruto) if bruto not in (None, "") else 1
    except (TypeError, ValueError):
        raise ErroAcao("'dias' precisa ser um número inteiro.")
    if dias < 1:
        raise ErroAcao("'dias' precisa ser maior ou igual a 1.")

    inicio = timezone.localdate() - timedelta(days=dias - 1)
    leads = Lead.objects.filter(criado_em__date__gte=inicio).select_related("curso")

    status_filtro = (params.get("status") or "").strip()
    if status_filtro:
        leads = leads.filter(status=status_filtro)

    return [
        {
            "nome": lead.nome,
            "whatsapp": lead.whatsapp,
            "curso": lead.curso.nome if lead.curso_id else None,
            "quando_pretende": lead.quando_pretende,
            "status": lead.status,
            "utm_source": lead.utm_source,
            "criado_em": lead.criado_em,
        }
        for lead in leads.order_by("-criado_em")
    ]
