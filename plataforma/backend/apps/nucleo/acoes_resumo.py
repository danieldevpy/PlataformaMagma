"""Ação do Radar diário pro agente WhatsApp (ver apps/nucleo/acoes.py e
specs/018-agente-whatsapp-radar-diario) — resumo factual do funil (leads,
vagas, avaliações pendentes, postagens do dia, uso de IA do mês), pra
formatar e mandar pro gestor sem precisar de LLM (dado exato, não geração)."""

from datetime import timedelta

from django.utils import timezone

from apps.cursos.models import Turma
from apps.leads.models import Lead
from apps.nucleo.acoes import registrar_acao


@registrar_acao(
    nome="resumo_diario",
    descricao=(
        "Resumo factual do funil pro Radar diário: leads das últimas 24h, "
        "vagas restantes das turmas com inscrições abertas, avaliações "
        "pendentes de aprovação, postagens agendadas pra hoje e uso de IA "
        "do mês corrente."
    ),
    params={},
    escopo="nucleo:resumo_diario",
)
def resumo_diario(params, request):
    desde = timezone.now() - timedelta(hours=24)
    leads_24h = Lead.objects.filter(criado_em__gte=desde).count()

    turmas_abertas = [
        {
            "turma_codigo": turma.codigo,
            "curso": turma.curso.nome,
            "vagas_restantes": turma.vagas_restantes,
        }
        for turma in Turma.objects.filter(
            status=Turma.Status.INSCRICOES
        ).select_related("curso")
    ]

    avaliacoes_pendentes = None
    try:
        from apps.avaliacoes.models import Avaliacao

        avaliacoes_pendentes = Avaliacao.objects.filter(
            status=Avaliacao.Status.PENDENTE
        ).count()
    except ImportError:
        pass

    postagens_hoje = None
    try:
        from apps.midia.models import Postagem

        hoje = timezone.localdate()
        postagens_hoje = (
            Postagem.objects.exclude(status=Postagem.Status.PUBLICADA)
            .filter(agendada_para__date=hoje)
            .count()
        )
    except ImportError:
        pass

    uso_ia_mes = None
    try:
        from django.db.models import Count, Q, Sum

        from apps.ia.models import ExecucaoIA

        inicio_mes = timezone.now().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        agregados = ExecucaoIA.objects.filter(criado_em__gte=inicio_mes).aggregate(
            execucoes_ok=Count("id", filter=Q(status=ExecucaoIA.Status.OK)),
            execucoes_erro=Count("id", filter=Q(status=ExecucaoIA.Status.ERRO)),
            tokens_entrada=Sum("tokens_entrada"),
            tokens_saida=Sum("tokens_saida"),
        )
        uso_ia_mes = {
            "execucoes_ok": agregados["execucoes_ok"] or 0,
            "execucoes_erro": agregados["execucoes_erro"] or 0,
            "tokens_entrada": agregados["tokens_entrada"] or 0,
            "tokens_saida": agregados["tokens_saida"] or 0,
        }
    except ImportError:
        pass

    return {
        "leads_24h": leads_24h,
        "turmas_abertas": turmas_abertas,
        "avaliacoes_pendentes": avaliacoes_pendentes,
        "postagens_hoje": postagens_hoje,
        "uso_ia_mes": uso_ia_mes,
    }
