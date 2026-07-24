"""Orquestra a criação de cobrança: valida a matrícula/aluno, resolve ou
cria o cliente Asaas, chama a API e persiste `Cobranca` — usado tanto pela
ação do agente (apps/financeiro/acoes.py) quanto pela criação manual de
fallback no Admin (apps/financeiro/admin.py). Único ponto de entrada pra
gerar cobrança — nunca duplicar essa orquestração."""

from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from apps.financeiro.adapters import asaas
from apps.financeiro.adapters.asaas import ErroAsaas
from apps.financeiro.models import Cobranca, ConfiguracaoAsaas

VENCIMENTO_PADRAO_DIAS = 3


class ErroFinanceiro(Exception):
    """Erro de negócio ao gerar cobrança — mensagem já em linguagem humana."""


def criar_cobranca_para_matricula(matricula, valor, forma_pagamento, vencimento=None, usuario=None):
    aluno = matricula.aluno
    if not aluno.cpf:
        raise ErroFinanceiro(f"{aluno.nome} não tem CPF cadastrado — obrigatório pro Asaas.")

    config = ConfiguracaoAsaas.obter_ativa()
    if config is None or not config.get_credencial():
        raise ErroFinanceiro("Nenhum ambiente Asaas ativo com chave de API cadastrada.")

    valor = Decimal(str(valor))
    vencimento = vencimento or (timezone.now().date() + timedelta(days=VENCIMENTO_PADRAO_DIAS))

    try:
        customer_id = asaas.buscar_ou_criar_cliente(config, aluno)
        resultado = asaas.criar_cobranca(
            config,
            customer_id,
            valor,
            vencimento,
            forma_pagamento,
            external_reference=f"matricula:{matricula.pk}",
        )
    except ErroAsaas as erro:
        raise ErroFinanceiro(str(erro)) from erro

    return Cobranca.objects.create(
        matricula=matricula,
        valor=valor,
        forma_pagamento=forma_pagamento,
        vencimento=vencimento,
        link_pagamento=resultado["link_pagamento"],
        asaas_id=resultado["id"],
        ambiente=config.ambiente,
        criado_por=usuario,
    )
