"""Ação institucional pro agente WhatsApp (ver apps/nucleo/acoes.py e
specs/017-agente-whatsapp-info-institucional) — endereço, contato e prova
social (nota Google/total formados) pra SDR responder sem inventar."""

from apps.nucleo.acoes import registrar_acao
from apps.nucleo.models import ConfiguracaoSite


@registrar_acao(
    nome="info_institucional",
    descricao=(
        "Devolve dados institucionais da Magma (endereço, WhatsApp "
        "principal, Instagram, e-mail) pra responder perguntas gerais tipo "
        "'onde fica a escola?' ou 'tem Instagram?'. Nota do Google e total "
        "de alunos formados só vêm preenchidos quando a escola liga a "
        "exibição desse dado (senão vêm nulos — nesse caso, não mencione)."
    ),
    params={},
    escopo="nucleo:info_institucional",
)
def info_institucional(params, request):
    config = ConfiguracaoSite.obter()
    return {
        "endereco": config.endereco,
        "whatsapp_principal": config.whatsapp_principal,
        "instagram": config.instagram,
        "email": config.email,
        "nota_google": config.nota_google if config.exibir_nota_google else None,
        "total_alunos_formados": (
            config.total_alunos_formados if config.exibir_total_formados else None
        ),
    }
