"""Ações expostas via `POST /api/acoes/executar/` (ver apps/nucleo/acoes.py)."""

from apps.cursos.models import Turma
from apps.nucleo.acoes import ErroAcao, registrar_acao


@registrar_acao(
    nome="status_turma",
    descricao=(
        "Devolve curso, status, datas e contagens (matrículas/mídias/"
        "postagens/avaliações) de uma turma."
    ),
    params={"turma_codigo": "string, código da turma"},
    escopo="cursos:status_turma",
)
def status_turma(params, request):
    turma_codigo = (params.get("turma_codigo") or "").strip()
    if not turma_codigo:
        raise ErroAcao("Informe 'turma_codigo'.")

    turma = Turma.objects.filter(codigo=turma_codigo).select_related("curso").first()
    if turma is None:
        raise ErroAcao(f"Turma '{turma_codigo}' não encontrada.")

    resultado = {
        "turma_codigo": turma.codigo,
        "curso": turma.curso.nome,
        "status": turma.status,
        "inicio_aulas": turma.inicio_aulas,
        "capacidade": turma.capacidade,
        "vagas_restantes": turma.vagas_restantes,
    }

    # Imports protegidos: se algum desses apps sair do INSTALLED_APPS, a
    # ação continua respondendo o essencial (mesma cautela do get_fotos em
    # apps/avaliacoes/serializers.py).
    try:
        from apps.educacional.models import Matricula

        resultado["matriculas"] = Matricula.objects.filter(
            turma=turma,
            status__in=[Matricula.Status.ATIVA, Matricula.Status.CONCLUIDA],
        ).count()
    except ImportError:
        resultado["matriculas"] = None

    try:
        resultado["midias"] = turma.midias.count()
    except Exception:
        resultado["midias"] = None

    try:
        resultado["postagens"] = turma.postagens.count()
    except Exception:
        resultado["postagens"] = None

    try:
        from apps.avaliacoes.models import Avaliacao

        resultado["avaliacoes"] = Avaliacao.objects.filter(turma=turma).count()
    except ImportError:
        resultado["avaliacoes"] = None

    return resultado


@registrar_acao(
    nome="listar_turmas",
    descricao=(
        "Lista as turmas cadastradas com código, curso, status, início das "
        "aulas e vagas — útil pra descobrir o código de uma turma quando "
        "não lembra de cabeça. Filtro opcional por status."
    ),
    params={
        "status": (
            "string, opcional — filtra por status exato (rascunho|"
            "inscricoes|lotada|em_andamento|encerrada); vazio lista todas"
        ),
    },
    escopo="cursos:listar_turmas",
)
def listar_turmas(params, request):
    turmas = Turma.objects.select_related("curso").order_by("-criado_em")

    status_filtro = (params.get("status") or "").strip()
    if status_filtro:
        turmas = turmas.filter(status=status_filtro)

    return [
        {
            "turma_codigo": turma.codigo,
            "curso": turma.curso.nome,
            "status": turma.status,
            "inicio_aulas": turma.inicio_aulas,
            "capacidade": turma.capacidade,
            "vagas_restantes": turma.vagas_restantes,
        }
        for turma in turmas
    ]
