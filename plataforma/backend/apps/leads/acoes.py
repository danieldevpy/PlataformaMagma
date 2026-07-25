"""Ações expostas via `POST /api/acoes/executar/` (ver apps/nucleo/acoes.py)."""

from datetime import timedelta

from django.utils import timezone

from apps.avaliacoes.models import Avaliacao
from apps.conversas.models import Conversa
from apps.cursos.serializers import turma_destaque_de
from apps.leads.models import Lead
from apps.nucleo.acoes import ErroAcao, registrar_acao
from apps.nucleo.models import ConfiguracaoSite, ContatoEscalado
from apps.nucleo.numeros import numero_de_pessoa


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


def _texto_t1(lead):
    """T+1 — conteúdo real do curso (habilidades) se houver; genérico
    senão. Sempre tem conteúdo válido (não fica esperando)."""
    if lead.curso_id:
        habilidades = list(lead.curso.habilidades.order_by("ordem")[:3])
        if habilidades:
            itens = "\n".join(f"✅ {h.titulo}" for h in habilidades)
            return (
                f"Oi, {lead.nome}! Aqui é a MAG de novo 🚑\n\n"
                f"Separei um gostinho do que você vai aprender no "
                f"{lead.curso.nome}:\n\n{itens}\n\n"
                "Quer que eu tire alguma dúvida sobre o curso?"
            )
        return (
            f"Oi, {lead.nome}! Aqui é a MAG 🚑\n\n"
            f"Vi que você se interessou pelo {lead.curso.nome} — quer que "
            "eu te conte mais sobre como funciona a formação?"
        )
    return (
        f"Oi, {lead.nome}! Aqui é a MAG, da Magma Cursos 🚑\n\n"
        "Ainda dá tempo de me contar qual curso te interessou — assim já "
        "te mando os detalhes certos."
    )


def _texto_t3(lead):
    """T+3 — prova social com avaliação real aprovada (do curso de
    interesse, senão qualquer uma aprovada). Devolve None se ainda não
    existir nenhuma — nunca inventa depoimento."""
    aprovadas = Avaliacao.objects.filter(status=Avaliacao.Status.APROVADA)
    avaliacao = None
    if lead.curso_id:
        avaliacao = aprovadas.filter(curso=lead.curso).order_by("-criado_em").first()
    if avaliacao is None:
        avaliacao = aprovadas.order_by("-criado_em").first()
    if avaliacao is None:
        return None

    estrelas = "⭐" * avaliacao.estrelas
    return (
        f"Oi, {lead.nome}! Olha o que quem já se formou com a gente diz:\n\n"
        f"{estrelas}\n\"{avaliacao.comentario}\" — {avaliacao.nome}\n\n"
        "Se quiser, te ajudo a garantir sua vaga também. É só responder "
        "aqui."
    )


def _texto_t7(lead):
    """T+7 — urgência com vagas reais se `exibir_vagas` estiver ligado;
    genérico senão. Sempre tem conteúdo válido (não fica esperando)."""
    if lead.curso_id:
        turma = turma_destaque_de(lead.curso)
        if turma and turma.exibir_vagas and turma.vagas_restantes is not None:
            return (
                f"Oi, {lead.nome}! Passando pra avisar: restam "
                f"{turma.vagas_restantes} vaga(s) na turma de "
                f"{lead.curso.nome} com inscrições abertas. Se ainda tiver "
                "interesse, responde aqui que eu te ajudo a garantir a sua."
            )
        return (
            f"Oi, {lead.nome}! As vagas do {lead.curso.nome} são "
            "limitadas — se ainda tiver interesse, responde aqui que eu "
            "vejo a disponibilidade certinha pra você."
        )
    return (
        f"Oi, {lead.nome}! Ainda dá tempo de garantir sua vaga na Magma — "
        "responde aqui que eu te ajudo a encontrar o curso certo."
    )


@registrar_acao(
    nome="processar_nutridora",
    descricao=(
        "Processa a régua de nutrição automática (T+1/T+3/T+7): busca "
        "leads elegíveis pra cada janela, monta o texto com dado real, "
        "marca o toque no Lead e devolve {numero, texto} de cada um pra "
        "mandar pelo WhatsApp. Sem parâmetros — chamada pelo Schedule "
        "Trigger do n8n, não pelo AI Agent."
    ),
    params={},
    escopo="leads:processar_nutridora",
)
def processar_nutridora(params, request):
    agora = timezone.now()
    # Só os handoffs ATIVOS excluem da régua (spec 025). Antes, qualquer
    # registro em `ContatoEscalado` excluía pra sempre — então quem foi
    # escalado uma vez e já tinha sido atendido nunca mais era nutrido.
    numeros_escalados = ContatoEscalado.numeros_ativos()
    # 028-T20: quem está conversando com a MAG AGORA não recebe toque
    # agendado. Antes isso era `.exclude(utm_source="whatsapp")` — a origem
    # do lead usada como proxy da atividade dele. Só que o `registrar_lead`
    # do SDR carimba `utm_source="whatsapp"` fixo no workflow, e origem não
    # muda nunca: o efeito real era NENHUM lead nascido de conversa entrar
    # na régua, pra sempre. Como a campanha do Meta é Click-to-WhatsApp,
    # isso deixava 100% do lead pago fora da nutrição.
    numeros_em_conversa = Conversa.numeros_ativos_desde(
        ConfiguracaoSite.obter().nutridora_silencio_dias
    )

    base = (
        Lead.objects.exclude(whatsapp="")
        .exclude(whatsapp__in=numeros_escalados)
        .exclude(whatsapp__in=numeros_em_conversa)
        .select_related("curso")
    )

    processados = []
    ja_processados_nesta_rodada = set()

    def _processar(queryset, novo_toque, montar_texto):
        for lead in queryset:
            if lead.pk in ja_processados_nesta_rodada:
                continue
            # Último cadeado antes de a mensagem sair: nada é enviado pra
            # um "número" que não é de gente. Leads assim não deveriam mais
            # nascer (o serializer barra), mas os que já estão na base de
            # antes da correção não podem receber toque automático.
            if not numero_de_pessoa(lead.whatsapp):
                continue
            texto = montar_texto(lead)
            if texto is None:
                continue
            processados.append({"numero": lead.whatsapp, "texto": texto})
            lead.nutridora_ultimo_toque = novo_toque
            lead.save(update_fields=["nutridora_ultimo_toque"])
            ja_processados_nesta_rodada.add(lead.pk)

    _processar(
        base.filter(
            criado_em__lte=agora - timedelta(days=1), nutridora_ultimo_toque=""
        ),
        Lead.ToqueNutridora.T1,
        _texto_t1,
    )
    _processar(
        base.filter(
            criado_em__lte=agora - timedelta(days=3),
            nutridora_ultimo_toque=Lead.ToqueNutridora.T1,
        ),
        Lead.ToqueNutridora.T3,
        _texto_t3,
    )
    _processar(
        base.filter(
            criado_em__lte=agora - timedelta(days=7),
            nutridora_ultimo_toque=Lead.ToqueNutridora.T3,
        ),
        Lead.ToqueNutridora.T7,
        _texto_t7,
    )

    return {"processados": processados, "total": len(processados)}
