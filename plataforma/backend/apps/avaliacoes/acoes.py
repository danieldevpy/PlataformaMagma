"""Ações expostas via `POST /api/acoes/executar/` (ver apps/nucleo/acoes.py).
Reusa a mesma mecânica de convite por turma já usada pelo painel
(`CriarConvitePainelView`, apps/avaliacoes/views.py) — mesmo model
`ConviteAvaliacao`, mesma URL pública (`ConviteAvaliacao.url`)."""

from django.utils import timezone

from apps.avaliacoes.models import ConviteAvaliacao
from apps.cursos.models import Turma
from apps.nucleo.acoes import ErroAcao, registrar_acao


@registrar_acao(
    nome="gerar_link_avaliacao",
    descricao=(
        "Devolve o link público de avaliação da turma (escopo turma, "
        "compartilhável) — reusa um convite válido existente ou cria um novo."
    ),
    params={"turma_codigo": "string, código da turma"},
    escopo="avaliacoes:gerar_link_avaliacao",
)
def gerar_link_avaliacao(params, request):
    turma_codigo = (params.get("turma_codigo") or "").strip()
    if not turma_codigo:
        raise ErroAcao("Informe 'turma_codigo'.")

    turma = Turma.objects.filter(codigo=turma_codigo).select_related("curso").first()
    if turma is None:
        raise ErroAcao(f"Turma '{turma_codigo}' não encontrada.")

    # Reusa um convite de escopo turma ainda válido (não expirado) em vez de
    # gerar um link novo a cada chamada — mesma turma, mesmo link enquanto
    # durar (evita o bot mandar 5 links diferentes no mesmo dia).
    convite = (
        ConviteAvaliacao.objects.filter(
            turma=turma,
            escopo=ConviteAvaliacao.Escopo.TURMA,
            expira_em__gt=timezone.now(),
        )
        .order_by("-criado_em")
        .first()
    )
    if convite is None:
        usuario = request.user if request.user.is_authenticated else None
        convite = ConviteAvaliacao.objects.create(
            curso=turma.curso,
            turma=turma,
            escopo=ConviteAvaliacao.Escopo.TURMA,
            enviado_por=usuario,
        )

    return {
        "turma_codigo": turma.codigo,
        "url": convite.url,
        "expira_em": convite.expira_em,
    }
