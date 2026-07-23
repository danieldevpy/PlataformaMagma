"""Ações expostas via `POST /api/acoes/executar/` (ver apps/nucleo/acoes.py)."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models import Q

from apps.cursos.models import Turma
from apps.educacional.models import Aluno, Matricula
from apps.nucleo.acoes import ErroAcao, registrar_acao


def _mascarar_cpf(cpf):
    """'11122233344' -> '111.***' — nunca devolve o CPF cru pro agente
    (constituição §6, CPF é PII)."""
    if not cpf:
        return None
    return f"{cpf[:3]}.***"


@registrar_acao(
    nome="gerar_link_matricula",
    descricao=(
        "Devolve o link público de cadastro de aluno novo da turma "
        "(carteirinha) — estável e reutilizável, um por turma. O aluno "
        "abre, preenche o CPF e já nasce matriculado."
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

    # Link estável de cadastro da própria Turma (spec 014) — não cria/reusa
    # mais Matrícula-fantasma; o mesmo token vale enquanto a turma existir.
    url = f"{settings.FRONTEND_URL}/carteirinha/nova/{turma.token_cadastro}"

    return {
        "turma_codigo": turma.codigo,
        "url": url,
    }


@registrar_acao(
    nome="listar_matriculas_turma",
    descricao=(
        "Lista os alunos matriculados numa turma pelo código — nome, "
        "status da matrícula e data. Use quando o gestor perguntar quem "
        "está matriculado, pedir a lista/relação de alunos de uma turma."
    ),
    params={"turma_codigo": "string, código da turma"},
    escopo="educacional:listar_matriculas_turma",
)
def listar_matriculas_turma(params, request):
    turma_codigo = (params.get("turma_codigo") or "").strip()
    if not turma_codigo:
        raise ErroAcao("Informe 'turma_codigo'.")

    turma = Turma.objects.filter(codigo=turma_codigo).first()
    if turma is None:
        raise ErroAcao(f"Turma '{turma_codigo}' não encontrada.")

    matriculas = Matricula.objects.filter(turma=turma).select_related("aluno").order_by(
        "aluno__nome"
    )

    return {
        "turma_codigo": turma.codigo,
        "alunos": [
            {
                "aluno_token": str(matricula.aluno.token),
                "nome": matricula.aluno.nome,
                "status": matricula.status,
                "matriculado_em": matricula.criado_em,
            }
            for matricula in matriculas
        ],
    }


@registrar_acao(
    nome="buscar_aluno",
    descricao=(
        "Busca aluno já cadastrado por nome, CPF ou WhatsApp — devolve "
        "candidatos (token, nome, CPF mascarado, WhatsApp, quantidade de "
        "matrículas) pra confirmar com o gestor ANTES de matricular. Nunca "
        "matricule sem antes buscar e confirmar qual é a pessoa certa."
    ),
    params={"termo": "string — nome (parcial), CPF ou número de WhatsApp"},
    escopo="educacional:buscar_aluno",
)
def buscar_aluno(params, request):
    termo = (params.get("termo") or "").strip()
    if not termo:
        raise ErroAcao("Informe 'termo' (nome, CPF ou WhatsApp).")

    apenas_digitos = "".join(ch for ch in termo if ch.isdigit())
    eh_numerico = bool(apenas_digitos) and all(
        ch.isdigit() or ch in " .-()" for ch in termo
    )

    if eh_numerico and len(apenas_digitos) == 11:
        # 11 dígitos é ambíguo: CPF (sempre 11) ou celular sem DDI (DDD +
        # 9 dígitos, como o gestor costuma digitar/falar) — tenta os dois
        # em vez de arriscar não achar por causa da ambiguidade.
        alunos = Aluno.objects.filter(
            Q(cpf=apenas_digitos) | Q(whatsapp__icontains=apenas_digitos)
        )
    elif eh_numerico:
        alunos = Aluno.objects.filter(whatsapp__icontains=apenas_digitos)
    else:
        alunos = Aluno.objects.filter(nome__icontains=termo)

    return [
        {
            "token": str(aluno.token),
            "nome": aluno.nome,
            "cpf_mascarado": _mascarar_cpf(aluno.cpf),
            "whatsapp": aluno.whatsapp,
            "matriculas": aluno.matriculas.count(),
        }
        for aluno in alunos.order_by("nome")[:10]
    ]


@registrar_acao(
    nome="matricular_aluno",
    descricao=(
        "Matricula um aluno JÁ EXISTENTE (achado via buscar_aluno e "
        "confirmado com o gestor) numa turma. Recusa se o aluno já "
        "estiver matriculado nessa turma."
    ),
    params={
        "aluno_token": "string (uuid) — token do aluno, devolvido por buscar_aluno",
        "turma_codigo": "string — código da turma",
        "status": "string, opcional (padrão 'ativa') — 'ativa' ou 'concluida'",
    },
    escopo="educacional:matricular_aluno",
)
def matricular_aluno(params, request):
    aluno_token = (params.get("aluno_token") or "").strip()
    turma_codigo = (params.get("turma_codigo") or "").strip()
    if not aluno_token or not turma_codigo:
        raise ErroAcao("Informe 'aluno_token' e 'turma_codigo'.")

    try:
        aluno = Aluno.objects.filter(token=aluno_token).first()
    except (ValidationError, ValueError):
        raise ErroAcao("'aluno_token' inválido — use o token devolvido por buscar_aluno.")
    if aluno is None:
        raise ErroAcao("Aluno não encontrado — confira o token (use buscar_aluno).")

    turma = Turma.objects.filter(codigo=turma_codigo).first()
    if turma is None:
        raise ErroAcao(f"Turma '{turma_codigo}' não encontrada.")

    status_valor = (params.get("status") or Matricula.Status.ATIVA).strip()
    if status_valor not in (Matricula.Status.ATIVA, Matricula.Status.CONCLUIDA):
        raise ErroAcao("'status' precisa ser 'ativa' ou 'concluida'.")

    if Matricula.objects.filter(aluno=aluno, turma=turma).exists():
        raise ErroAcao(f"{aluno.nome} já está matriculado na {turma.codigo}.")

    usuario = request.user if request.user.is_authenticated else None
    Matricula.objects.create(
        aluno=aluno, turma=turma, status=status_valor, enviado_por=usuario
    )

    return {
        "aluno_nome": aluno.nome,
        "turma_codigo": turma.codigo,
        "status": status_valor,
        "vagas_restantes": turma.vagas_restantes,
    }
