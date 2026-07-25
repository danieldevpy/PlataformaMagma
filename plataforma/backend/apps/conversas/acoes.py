"""Ações de registro e análise das conversas do agente (ver
apps/nucleo/acoes.py e specs/021-registro-conversas-agente).

Três ações, três consumidores diferentes:
- `registrar_turnos`  → chamada pelo n8n DEPOIS de responder ao contato;
- `exportar_conversas` → chamada por quem vai analisar (o Daniel, ou uma
  LLM numa sessão de trabalho);
- `purgar_conversas`  → chamada pelo Radar diário, respeitando a
  retenção configurada no admin.
"""

from datetime import timedelta

from django.utils import timezone

from apps.conversas.models import JANELA_SESSAO_HORAS, Conversa, Turno
from apps.nucleo.acoes import ErroAcao, registrar_acao
from apps.nucleo.models import ConfiguracaoSite

# Ferramenta chamada pelo agente → desfecho que ela comprova. O dado já
# está no `intermediateSteps`; derivar daqui é exato e de graça (pedir pra
# um modelo classificar seria caro, lento e sujeito a erro — mesma lógica
# do Radar da spec 019 não ter AI Agent).
FERRAMENTA_DESFECHO = {
    "registrar_lead": Conversa.Desfecho.LEAD,
    "escalar_contato": Conversa.Desfecho.HANDOFF,
    "matricular_aluno": Conversa.Desfecho.MATRICULA,
    "gerar_cobranca": Conversa.Desfecho.COBRANCA,
}

# Quanto mais alto, mais fundo no funil. A conversa guarda o ponto mais
# avançado que alcançou — quem gerou cobrança não "volta" pra lead só
# porque trocou mais duas mensagens depois.
AVANCO_DESFECHO = {
    Conversa.Desfecho.NENHUM: 0,
    Conversa.Desfecho.LEAD: 1,
    Conversa.Desfecho.HANDOFF: 2,
    Conversa.Desfecho.MATRICULA: 3,
    Conversa.Desfecho.COBRANCA: 4,
}

LIMITE_EXPORTACAO_PADRAO = 50
LIMITE_EXPORTACAO_MAXIMO = 200


def _normalizar_ferramentas(bruto):
    """Aceita o que o n8n mandar: lista de strings, lista de dicts com
    `nome`/`name`/`action`, ou nada. Nunca estoura — registro de conversa
    não pode derrubar o fluxo por causa de formato inesperado."""
    if not bruto:
        return []
    if isinstance(bruto, dict):
        bruto = [bruto]
    if not isinstance(bruto, list):
        return []

    ferramentas = []
    for item in bruto:
        if isinstance(item, str):
            ferramentas.append({"nome": item, "params": {}})
            continue
        if not isinstance(item, dict):
            continue
        nome = item.get("nome") or item.get("name") or item.get("action") or ""
        params = item.get("params") or item.get("input") or item.get("arguments") or {}
        if not isinstance(params, dict):
            params = {"valor": params}
        ferramentas.append({"nome": str(nome), "params": params})
    return ferramentas


def _vincular_contato(conversa, papel):
    """Liga a conversa ao Lead ou Usuario dono do número, quando existe.
    Best-effort: conversa de desconhecido vive sem vínculo nenhum."""
    from apps.contas.models import Usuario
    from apps.leads.models import Lead

    if papel in ("gestor", "instrutor"):
        conversa.usuario = Usuario.objects.filter(
            whatsapp=conversa.numero, is_active=True
        ).first()
    else:
        conversa.lead = Lead.objects.filter(whatsapp=conversa.numero).first()


@registrar_acao(
    nome="registrar_turnos",
    descricao=(
        "Registra na plataforma o que foi dito numa troca de mensagens com "
        "o agente (fala do contato, resposta do agente e ferramentas que ele "
        "chamou). Agrupa por conversa: mensagens do mesmo número dentro de "
        f"{JANELA_SESSAO_HORAS}h entram na mesma conversa; depois disso abre "
        "uma nova."
    ),
    params={
        "numero": "string, só dígitos com DDI (obrigatório)",
        "texto_contato": "string, o que o contato disse (opcional em toque proativo)",
        "texto_agente": "string, o que o agente respondeu",
        "agente": "string: sdr, operadora, nutridora ou radar",
        "papel": "string: gestor, instrutor, lead ou desconhecido",
        "nome": "string, nome do contato se já souber",
        "ferramentas": "lista de {nome, params} das tools que o agente chamou",
        "execucao_n8n": "string, id da execução do n8n (rastreio)",
        "proativo": "bool, true quando é toque automático (Nutridora), sem fala do contato",
    },
    escopo="conversas:registrar_turnos",
)
def registrar_turnos(params, request):
    numero = (params.get("numero") or "").strip()
    if not numero:
        raise ErroAcao("Informe 'numero'.")

    texto_contato = (params.get("texto_contato") or "").strip()
    texto_agente = (params.get("texto_agente") or "").strip()
    if not texto_contato and not texto_agente:
        raise ErroAcao("Informe ao menos 'texto_contato' ou 'texto_agente'.")

    agente = (params.get("agente") or "").strip()
    papel = (params.get("papel") or "").strip()
    nome = (params.get("nome") or "").strip()
    execucao = str(params.get("execucao_n8n") or "").strip()[:40]
    proativo = bool(params.get("proativo"))
    ferramentas = _normalizar_ferramentas(params.get("ferramentas"))

    agora = timezone.now()
    corte = agora - timedelta(hours=JANELA_SESSAO_HORAS)

    conversa = (
        Conversa.objects.filter(numero=numero, ultima_atividade_em__gte=corte)
        .order_by("-ultima_atividade_em")
        .first()
    )
    nova = conversa is None
    if nova:
        conversa = Conversa(numero=numero, ultima_atividade_em=agora)

    # Dado que só melhora: nome/papel/agente descobertos depois preenchem
    # o que estava em branco, mas não apagam o que já se sabia.
    if nome:
        conversa.nome_contato = nome
    if papel:
        conversa.papel = papel
    if agente:
        conversa.agente = agente
    conversa.ultima_atividade_em = agora

    if nova or not (conversa.lead_id or conversa.usuario_id):
        _vincular_contato(conversa, papel or conversa.papel)

    for ferramenta in ferramentas:
        desfecho = FERRAMENTA_DESFECHO.get(ferramenta["nome"])
        if desfecho is None:
            continue
        if desfecho == Conversa.Desfecho.HANDOFF:
            conversa.escalada = True
        atual = AVANCO_DESFECHO.get(conversa.desfecho, 0)
        if AVANCO_DESFECHO[desfecho] > atual:
            conversa.desfecho = desfecho

    conversa.save()

    turnos = []
    if texto_contato:
        turnos.append(
            Turno(
                conversa=conversa,
                papel=Turno.Papel.CONTATO,
                texto=texto_contato,
                execucao_n8n=execucao,
            )
        )
    if texto_agente:
        turnos.append(
            Turno(
                conversa=conversa,
                papel=Turno.Papel.SISTEMA if proativo else Turno.Papel.AGENTE,
                texto=texto_agente,
                agente=agente,
                ferramentas=ferramentas,
                execucao_n8n=execucao,
            )
        )
    Turno.objects.bulk_create(turnos)

    return {
        "conversa_id": conversa.id,
        "conversa_nova": nova,
        "turnos_gravados": len(turnos),
        "desfecho": conversa.desfecho,
    }


@registrar_acao(
    nome="exportar_conversas",
    descricao=(
        "Devolve as conversas de um período com a transcrição já formatada "
        "em texto corrido, pra análise em bloco (quantas converteram, onde a "
        "MAG trava, se inventou informação)."
    ),
    params={
        "dias": "int, período em dias corridos (padrão 7)",
        "agente": "string opcional: sdr, operadora, nutridora",
        "desfecho": "string opcional: lead_registrado, handoff, matricula, cobranca",
        "numero": "string opcional, filtra um contato específico",
        "limite": (
            f"int, máximo de conversas (padrão {LIMITE_EXPORTACAO_PADRAO}, "
            f"teto {LIMITE_EXPORTACAO_MAXIMO})"
        ),
    },
    escopo="conversas:exportar_conversas",
)
def exportar_conversas(params, request):
    # `or` aqui trataria 0 como "não informado" e silenciosamente usaria o
    # padrão — pra um parâmetro de período, engolir um valor inválido é
    # pior que recusar.
    dias_bruto = params.get("dias")
    try:
        dias = 7 if dias_bruto in (None, "") else int(dias_bruto)
    except (TypeError, ValueError):
        raise ErroAcao("'dias' precisa ser um número.")
    if dias < 1:
        raise ErroAcao("'dias' precisa ser pelo menos 1.")

    limite_bruto = params.get("limite")
    try:
        limite = (
            LIMITE_EXPORTACAO_PADRAO
            if limite_bruto in (None, "")
            else int(limite_bruto)
        )
    except (TypeError, ValueError):
        raise ErroAcao("'limite' precisa ser um número.")
    limite = max(1, min(limite, LIMITE_EXPORTACAO_MAXIMO))

    desde = timezone.now() - timedelta(days=dias)
    consulta = Conversa.objects.filter(ultima_atividade_em__gte=desde)

    agente = (params.get("agente") or "").strip()
    if agente:
        consulta = consulta.filter(agente=agente)
    desfecho = (params.get("desfecho") or "").strip()
    if desfecho:
        consulta = consulta.filter(desfecho=desfecho)
    numero = (params.get("numero") or "").strip()
    if numero:
        consulta = consulta.filter(numero=numero)

    total = consulta.count()
    conversas = consulta.prefetch_related("turnos")[:limite]

    return {
        "periodo_dias": dias,
        "total": total,
        "devolvidas": len(conversas),
        "conversas": [
            {
                "id": conversa.id,
                "numero": conversa.numero,
                "nome": conversa.nome_contato,
                "papel": conversa.papel,
                "agente": conversa.agente,
                "escalada": conversa.escalada,
                "desfecho": conversa.desfecho,
                "iniciada_em": conversa.criado_em.isoformat(),
                "ultima_atividade_em": conversa.ultima_atividade_em.isoformat(),
                "turnos": conversa.turnos.count(),
                "transcricao": conversa.transcricao(),
            }
            for conversa in conversas
        ],
    }


@registrar_acao(
    nome="purgar_conversas",
    descricao=(
        "Apaga conversas mais antigas que a retenção configurada em "
        "Configuração do site (padrão 15 dias; 0 = nunca apagar). Chamada "
        "uma vez por dia pelo Radar."
    ),
    params={},
    escopo="conversas:purgar_conversas",
)
def purgar_conversas(params, request):
    retencao = ConfiguracaoSite.obter().conversas_retencao_dias

    if not retencao:
        return {
            "apagadas": 0,
            "retencao_dias": 0,
            "purga_desativada": True,
        }

    corte = timezone.now() - timedelta(days=retencao)
    vencidas = Conversa.objects.filter(ultima_atividade_em__lt=corte)
    # Conta antes de apagar: `.delete()` devolve o total de linhas de
    # TODOS os models afetados (conversas + turnos em cascata), não o
    # número de conversas.
    apagadas = vencidas.count()
    vencidas.delete()

    return {
        "apagadas": apagadas,
        "retencao_dias": retencao,
        "purga_desativada": False,
    }
