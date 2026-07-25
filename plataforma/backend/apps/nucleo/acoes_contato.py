"""Identificação de contato e handoff pro agente de WhatsApp (ver
apps/nucleo/acoes.py, specs/009-agente-whatsapp-fundacao,
specs/012-agente-whatsapp-handoff e docs/subsistemas/02b-agente-whatsapp-n8n.md §3-4).
"""

from datetime import timedelta

from django.utils import timezone

from apps.contas.models import Usuario
from apps.leads.models import Lead
from apps.leads.serializers import garantir_lead, resolver_curso
from apps.nucleo.acoes import ErroAcao, registrar_acao
from apps.nucleo.models import ConfiguracaoSite, ContatoEscalado
from apps.nucleo.numeros import numero_de_pessoa

# Mensagem única pros dois pontos de entrada — o que o agente lê quando o
# "número" não é de gente (id de grupo, canal, status). Ver
# apps/nucleo/numeros.py pro incidente que originou a checagem.
ERRO_NAO_E_PESSOA = (
    "Este identificador não é o WhatsApp de uma pessoa (parece um grupo, "
    "canal ou transmissão). A MAG só atende conversa individual."
)

# Status do lead que está sendo atendido por gente (spec 025). `Lead.status`
# é CharField livre, sem `choices`, então isto é constante aqui e não enum
# no model — e não precisa de migração. Status próprio em vez de `novo`
# porque é o lead mais quente da base: misturado com os outros, some.
STATUS_EM_ATENDIMENTO = "em_atendimento"


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
    # Falha ALTO de propósito: esta é a primeira ação de toda conversa, e
    # errar aqui derruba a execução no n8n antes de qualquer mensagem sair.
    # Devolver "desconhecido" faria a MAG responder normalmente — que é
    # exatamente o incidente dos grupos.
    if not numero_de_pessoa(numero):
        raise ErroAcao(ERRO_NAO_E_PESSOA)

    # Só o handoff ATIVO silencia (spec 025) — resolvido ou expirado
    # devolve o contato pro atendimento automático.
    escalado = ContatoEscalado.ativo_para(numero) is not None

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
        "automaticamente esse contato até a equipe resolver no admin ou o "
        "prazo expirar. Garante também que o contato exista na base de "
        "leads, mesmo que ainda não se saiba o nome nem o curso."
    ),
    params={
        "numero": "string, só dígitos com DDI",
        "motivo": "string, por que está escalando (ex.: 'quer fechar matrícula')",
        "nome": "string, opcional — nome do contato, se a conversa já revelou",
        "curso_slug": "string, opcional — curso de interesse, se já se sabe",
    },
    escopo="nucleo:escalar_contato",
)
def escalar_contato(params, request):
    """Escala pro humano E garante o lead (spec 025).

    Antes desta spec o handoff só criava `ContatoEscalado`. Na bateria de
    conversas simuladas, 3 dos 6 contatos escalados **não existiam em
    `leads_lead`** — inclusive a pessoa que disse "quero garantir minha
    vaga". A regra de handoff manda parar de qualificar, e a MAG parava
    antes de registrar; quem fica fora da tabela de leads some do Radar
    (spec 019) e da Nutridora (spec 020), então se o humano não responder
    não há segunda rede embaixo.

    O lead nasce mesmo sem nome e sem curso. Lead magro ainda é um número
    pra ligar, e ele já está silenciado pro automático — não vira spam.
    Perder quem estava pronto pra comprar não tem conserto.
    """
    numero = (params.get("numero") or "").strip()
    motivo = (params.get("motivo") or "").strip()
    if not numero:
        raise ErroAcao("Informe 'numero'.")
    if not numero_de_pessoa(numero):
        raise ErroAcao(ERRO_NAO_E_PESSOA)
    if not motivo:
        raise ErroAcao("Informe 'motivo'.")

    horas = ConfiguracaoSite.obter().handoff_expira_horas
    expira_em = timezone.now() + timedelta(hours=horas) if horas else None

    escalado = ContatoEscalado.ativo_para(numero)
    if escalado is None:
        escalado = ContatoEscalado.objects.create(
            numero=numero, motivo=motivo, expira_em=expira_em
        )
    else:
        # Já estava escalado: atualiza o motivo e renova o prazo, em vez de
        # abrir um segundo registro ativo pro mesmo número.
        escalado.motivo = motivo
        escalado.expira_em = expira_em
        escalado.save(update_fields=["motivo", "expira_em", "atualizado_em"])

    lead = garantir_lead(
        numero,
        curso=resolver_curso(params.get("curso_slug")),
        nome=(params.get("nome") or "").strip(),
        status=STATUS_EM_ATENDIMENTO,
        utm_source="whatsapp",
        pagina_origem="whatsapp",
    )

    return {
        "ok": True,
        "expira_em": expira_em.isoformat() if expira_em else None,
        "lead_id": lead.id,
    }
