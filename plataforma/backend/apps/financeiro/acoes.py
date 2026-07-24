"""Ações expostas via `POST /api/acoes/executar/` (ver apps/nucleo/acoes.py)
— geração de cobrança e consulta de pagamento pelo agente MAG (spec 015).
Identificação de matrícula segue o mesmo padrão de
`apps/educacional/acoes.py::matricular_aluno`: `aluno_token` (uuid, de
`buscar_aluno`) + `turma_codigo` — Matrícula não tem token próprio."""

from apps.cursos.models import Turma
from apps.educacional.models import Aluno, Matricula
from apps.financeiro.models import Cobranca
from apps.financeiro.services import ErroFinanceiro, criar_cobranca_para_matricula
from apps.nucleo.acoes import ErroAcao, registrar_acao

FORMAS_VALIDAS = dict(Cobranca.FormaPagamento.choices)


def _resolver_matricula(aluno_token, turma_codigo):
    aluno = Aluno.objects.filter(token=aluno_token).first()
    if aluno is None:
        raise ErroAcao("Aluno não encontrado — confira o token (use buscar_aluno).")

    turma = Turma.objects.filter(codigo=turma_codigo).first()
    if turma is None:
        raise ErroAcao(f"Turma '{turma_codigo}' não encontrada.")

    matricula = Matricula.objects.filter(aluno=aluno, turma=turma).first()
    if matricula is None:
        raise ErroAcao(f"{aluno.nome} não está matriculado na {turma.codigo}.")
    return matricula


@registrar_acao(
    nome="gerar_cobranca",
    descricao=(
        "Gera uma cobrança real no Asaas (PIX, boleto, cartão ou o aluno "
        "escolhe) pra uma matrícula existente e devolve o link de "
        "pagamento pra mandar pelo WhatsApp. NUNCA chame sem o gestor "
        "confirmar valor e destinatário antes."
    ),
    params={
        "aluno_token": "string (uuid) — token do aluno, devolvido por buscar_aluno",
        "turma_codigo": "string — código da turma da matrícula",
        "valor": "number — valor da cobrança em reais",
        "forma_pagamento": (
            "string, opcional (padrão 'UNDEFINED' = aluno escolhe) — "
            "'PIX', 'BOLETO' ou 'CREDIT_CARD'"
        ),
    },
    escopo="financeiro:gerar_cobranca",
)
def gerar_cobranca(params, request):
    aluno_token = (params.get("aluno_token") or "").strip()
    turma_codigo = (params.get("turma_codigo") or "").strip()
    valor = params.get("valor")
    forma_pagamento = (
        params.get("forma_pagamento") or Cobranca.FormaPagamento.INDEFINIDO
    ).strip()

    if not aluno_token or not turma_codigo or valor in (None, ""):
        raise ErroAcao("Informe 'aluno_token', 'turma_codigo' e 'valor'.")
    if forma_pagamento not in FORMAS_VALIDAS:
        raise ErroAcao(f"'forma_pagamento' precisa ser uma de: {', '.join(FORMAS_VALIDAS)}.")

    try:
        valor = float(valor)
    except (TypeError, ValueError):
        raise ErroAcao("'valor' precisa ser um número.")
    if valor <= 0:
        raise ErroAcao("'valor' precisa ser maior que zero.")

    matricula = _resolver_matricula(aluno_token, turma_codigo)

    usuario = request.user if request.user and request.user.is_authenticated else None
    try:
        cobranca = criar_cobranca_para_matricula(
            matricula, valor, forma_pagamento, usuario=usuario
        )
    except ErroFinanceiro as erro:
        raise ErroAcao(str(erro))

    return {
        "aluno_nome": matricula.aluno.nome,
        "turma_codigo": matricula.turma.codigo,
        "valor": str(cobranca.valor),
        "forma_pagamento": cobranca.forma_pagamento,
        "vencimento": cobranca.vencimento,
        "link_pagamento": cobranca.link_pagamento,
    }


@registrar_acao(
    nome="consultar_pagamento",
    descricao=(
        "Consulta o status de pagamento de um aluno numa turma — lista as "
        "cobranças (valor, forma, status, vencimento) da matrícula. Use "
        "quando o gestor perguntar se alguém já pagou."
    ),
    params={
        "aluno_token": "string (uuid) — token do aluno, devolvido por buscar_aluno",
        "turma_codigo": "string, opcional — obrigatório se o aluno tiver mais de uma matrícula",
    },
    escopo="financeiro:consultar_pagamento",
)
def consultar_pagamento(params, request):
    aluno_token = (params.get("aluno_token") or "").strip()
    if not aluno_token:
        raise ErroAcao("Informe 'aluno_token'.")

    aluno = Aluno.objects.filter(token=aluno_token).first()
    if aluno is None:
        raise ErroAcao("Aluno não encontrado — confira o token (use buscar_aluno).")

    turma_codigo = (params.get("turma_codigo") or "").strip()
    matriculas = aluno.matriculas.all()
    if turma_codigo:
        matriculas = matriculas.filter(turma__codigo=turma_codigo)

    if not matriculas.exists():
        sufixo = f" na {turma_codigo}." if turma_codigo else "."
        raise ErroAcao(f"{aluno.nome} não tem matrícula{sufixo}")
    if matriculas.count() > 1:
        raise ErroAcao(
            f"{aluno.nome} tem mais de uma matrícula — informe 'turma_codigo' pra desambiguar."
        )

    matricula = matriculas.first()
    cobrancas = matricula.cobrancas.order_by("-criado_em")

    return {
        "aluno_nome": aluno.nome,
        "turma_codigo": matricula.turma.codigo,
        "cobrancas": [
            {
                "valor": str(cobranca.valor),
                "forma_pagamento": cobranca.forma_pagamento,
                "status": cobranca.status,
                "vencimento": cobranca.vencimento,
                "criado_em": cobranca.criado_em,
            }
            for cobranca in cobrancas
        ],
    }
