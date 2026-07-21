"""Ações expostas via `POST /api/acoes/executar/` (ver apps/nucleo/acoes.py).
Reusa a mesma mecânica de convite por turma já usada pelo painel/admin —
mesmo model `Matricula`, mesma URL pública (`Matricula.url`), mesmo padrão
de `gerar_link_avaliacao` (apps/avaliacoes/acoes.py)."""

from django.utils import timezone

from apps.cursos.models import Turma
from apps.educacional.models import Matricula
from apps.nucleo.acoes import ErroAcao, registrar_acao


@registrar_acao(
    nome="gerar_link_matricula",
    descricao=(
        "Devolve o link público de matrícula/carteirinha da turma (escopo "
        "turma, compartilhável) — reusa um convite válido existente ou cria "
        "um novo."
    ),
    params={"turma_codigo": "string, código da turma"},
    escopo="educacional:gerar_link_matricula",
)
def gerar_link_matricula(params, request):
    turma_codigo = (params.get("turma_codigo") or "").strip()
    if not turma_codigo:
        raise ErroAcao("Informe 'turma_codigo'.")

    turma = Turma.objects.filter(codigo=turma_codigo).select_related("curso").first()
    if turma is None:
        raise ErroAcao(f"Turma '{turma_codigo}' não encontrada.")

    # Reusa um convite de escopo turma ainda válido (não expirado e ainda
    # não preenchido) em vez de gerar um link novo a cada chamada — mesma
    # turma, mesmo link enquanto durar (evita o bot mandar 5 links
    # diferentes no mesmo dia). `preenchida_em__isnull` é o filtro que
    # importa de verdade: uma Matrícula já preenchida nunca deve ser
    # devolvida como "convite pra preencher", mesmo que o campo `escopo`
    # dela esteja (incorretamente) marcado como turma.
    matricula = (
        Matricula.objects.filter(
            turma=turma,
            escopo=Matricula.Escopo.TURMA,
            expira_em__gt=timezone.now(),
            preenchida_em__isnull=True,
        )
        .order_by("-criado_em")
        .first()
    )
    if matricula is None:
        usuario = request.user if request.user.is_authenticated else None
        matricula = Matricula.objects.create(turma=turma, enviado_por=usuario)

    return {
        "turma_codigo": turma.codigo,
        "url": matricula.url,
        "expira_em": matricula.expira_em,
    }
