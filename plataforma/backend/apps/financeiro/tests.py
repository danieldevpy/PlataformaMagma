"""Testes de apps.financeiro: credencial cifrada (ConfiguracaoAsaas),
adapter Asaas (nunca chama API real — toda chamada é mockada, mesma regra
de apps/ia/tests.py), service de orquestração e webhook. Testes das 2
ações do agente (`gerar_cobranca`/`consultar_pagamento`) ficam em
apps/nucleo/tests.py, junto das demais ações da Camada de Ações."""

from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.cursos.models import Curso, Turma
from apps.educacional.models import Aluno, Matricula
from apps.financeiro.adapters.asaas import ErroAsaas
from apps.financeiro.models import Cobranca, ConfiguracaoAsaas, EventoWebhookAsaas
from apps.financeiro.services import ErroFinanceiro, criar_cobranca_para_matricula

Usuario = get_user_model()


def criar_config_ativa(ambiente=ConfiguracaoAsaas.Ambiente.SANDBOX, chave="chave-sandbox-teste"):
    config = ConfiguracaoAsaas(ambiente=ambiente, ativo=True)
    config.set_credencial(chave)
    config.set_webhook_token("token-webhook-teste")
    config.save()
    return config


def criar_matricula(cpf="11122233344"):
    curso = Curso.objects.create(
        slug="socorrista-aph-financeiro",
        nome="Socorrista APH",
        titulo_venda="Socorrista APH",
        subtitulo="Formação prática",
        carga_horaria=120,
    )
    turma = Turma.objects.create(curso=curso, codigo="T-FIN-1", capacidade=10)
    aluno = Aluno.objects.create(nome="Daniel Fernandes", cpf=cpf)
    return Matricula.objects.create(aluno=aluno, turma=turma, status=Matricula.Status.ATIVA)


class ConfiguracaoAsaasTests(TestCase):
    def test_credencial_e_webhook_token_ficam_cifrados_no_banco(self):
        config = criar_config_ativa()
        self.assertNotEqual(config.api_key, "chave-sandbox-teste")
        self.assertNotEqual(config.webhook_token, "token-webhook-teste")
        self.assertEqual(config.get_credencial(), "chave-sandbox-teste")
        self.assertEqual(config.get_webhook_token(), "token-webhook-teste")

    def test_so_uma_configuracao_fica_ativa(self):
        sandbox = criar_config_ativa(ConfiguracaoAsaas.Ambiente.SANDBOX)
        producao = criar_config_ativa(ConfiguracaoAsaas.Ambiente.PRODUCAO)
        sandbox.refresh_from_db()
        producao.refresh_from_db()
        self.assertFalse(sandbox.ativo)
        self.assertTrue(producao.ativo)
        self.assertEqual(ConfiguracaoAsaas.obter_ativa(), producao)


class AdapterAsaasTests(TestCase):
    def setUp(self):
        self.config = criar_config_ativa()
        self.aluno = Aluno.objects.create(nome="Daniel Fernandes", cpf="11122233344")

    @patch("apps.financeiro.adapters.asaas.requests.request")
    def test_buscar_cliente_existente_nao_cria_outro(self, request_mock):
        request_mock.return_value.status_code = 200
        request_mock.return_value.json.return_value = {"data": [{"id": "cus_existente"}]}

        from apps.financeiro.adapters import asaas

        cliente_id = asaas.buscar_ou_criar_cliente(self.config, self.aluno)

        self.assertEqual(cliente_id, "cus_existente")
        metodo, _url = request_mock.call_args[0]
        self.assertEqual(metodo, "GET")

    @patch("apps.financeiro.adapters.asaas.requests.request")
    def test_cria_cliente_quando_nao_encontra(self, request_mock):
        request_mock.return_value.status_code = 200
        request_mock.return_value.json.side_effect = [
            {"data": []},
            {"id": "cus_novo"},
        ]

        from apps.financeiro.adapters import asaas

        cliente_id = asaas.buscar_ou_criar_cliente(self.config, self.aluno)

        self.assertEqual(cliente_id, "cus_novo")
        self.assertEqual(request_mock.call_count, 2)

    @patch("apps.financeiro.adapters.asaas.requests.request")
    def test_erro_http_vira_erro_asaas(self, request_mock):
        request_mock.return_value.status_code = 400
        request_mock.return_value.json.return_value = {
            "errors": [{"description": "cpfCnpj inválido"}]
        }

        from apps.financeiro.adapters import asaas

        with self.assertRaises(ErroAsaas):
            asaas.buscar_ou_criar_cliente(self.config, self.aluno)

    @patch("apps.financeiro.adapters.asaas.requests.request")
    def test_falha_de_rede_vira_erro_asaas(self, request_mock):
        import requests

        request_mock.side_effect = requests.ConnectionError("fora do ar")

        from apps.financeiro.adapters import asaas

        with self.assertRaises(ErroAsaas):
            asaas.buscar_ou_criar_cliente(self.config, self.aluno)

    def test_sem_credencial_nunca_chama_a_api(self):
        config_sem_chave = ConfiguracaoAsaas.objects.create(
            ambiente=ConfiguracaoAsaas.Ambiente.PRODUCAO, ativo=False
        )
        from apps.financeiro.adapters import asaas

        with self.assertRaises(ErroAsaas):
            asaas.buscar_ou_criar_cliente(config_sem_chave, self.aluno)


class CriarCobrancaParaMatriculaTests(TestCase):
    def setUp(self):
        self.config = criar_config_ativa()

    def test_aluno_sem_cpf_recusa_antes_de_chamar_o_asaas(self):
        matricula = criar_matricula(cpf=None)
        with self.assertRaises(ErroFinanceiro):
            criar_cobranca_para_matricula(matricula, 100, Cobranca.FormaPagamento.PIX)

    def test_sem_configuracao_ativa_recusa(self):
        self.config.delete()
        matricula = criar_matricula()
        with self.assertRaises(ErroFinanceiro):
            criar_cobranca_para_matricula(matricula, 100, Cobranca.FormaPagamento.PIX)

    @patch("apps.financeiro.services.asaas.criar_cobranca")
    @patch("apps.financeiro.services.asaas.buscar_ou_criar_cliente")
    def test_sucesso_persiste_cobranca_com_dados_do_asaas(self, criar_cliente_mock, criar_cobranca_mock):
        criar_cliente_mock.return_value = "cus_123"
        criar_cobranca_mock.return_value = {
            "id": "pay_123",
            "link_pagamento": "https://sandbox.asaas.com/i/pay_123",
            "status": "PENDING",
        }
        matricula = criar_matricula()

        cobranca = criar_cobranca_para_matricula(
            matricula, "150.50", Cobranca.FormaPagamento.PIX, vencimento=date(2026, 8, 1)
        )

        self.assertEqual(cobranca.valor, Decimal("150.50"))
        self.assertEqual(cobranca.asaas_id, "pay_123")
        self.assertEqual(cobranca.link_pagamento, "https://sandbox.asaas.com/i/pay_123")
        self.assertEqual(cobranca.ambiente, ConfiguracaoAsaas.Ambiente.SANDBOX)
        self.assertEqual(cobranca.status, Cobranca.Status.PENDENTE)

    @patch("apps.financeiro.services.asaas.buscar_ou_criar_cliente")
    def test_erro_asaas_vira_erro_financeiro(self, criar_cliente_mock):
        criar_cliente_mock.side_effect = ErroAsaas("Asaas fora do ar")
        matricula = criar_matricula()

        with self.assertRaises(ErroFinanceiro):
            criar_cobranca_para_matricula(matricula, 100, Cobranca.FormaPagamento.PIX)


class WebhookAsaasTests(TestCase):
    def setUp(self):
        self.config = criar_config_ativa()
        self.url = reverse("financeiro-webhook-asaas")
        self.matricula = criar_matricula()
        self.cobranca = Cobranca.objects.create(
            matricula=self.matricula,
            valor=Decimal("100"),
            forma_pagamento=Cobranca.FormaPagamento.PIX,
            status=Cobranca.Status.PENDENTE,
            vencimento=date(2026, 8, 1),
            link_pagamento="https://sandbox.asaas.com/i/pay_1",
            asaas_id="pay_1",
            ambiente=ConfiguracaoAsaas.Ambiente.SANDBOX,
        )

    def _postar(self, payload, token="token-webhook-teste"):
        headers = {"asaas-access-token": token} if token else {}
        return self.client.post(
            self.url, data=payload, content_type="application/json", headers=headers
        )

    def test_sem_token_401(self):
        resposta = self._postar({"event": "PAYMENT_RECEIVED"}, token=None)
        self.assertEqual(resposta.status_code, 401)

    def test_token_invalido_401(self):
        resposta = self._postar({"event": "PAYMENT_RECEIVED"}, token="token-errado")
        self.assertEqual(resposta.status_code, 401)

    def test_token_valido_atualiza_status_para_paga(self):
        resposta = self._postar(
            {
                "event": "PAYMENT_RECEIVED",
                "payment": {"id": "pay_1", "status": "RECEIVED"},
            }
        )
        self.assertEqual(resposta.status_code, 200)
        self.cobranca.refresh_from_db()
        self.assertEqual(self.cobranca.status, Cobranca.Status.PAGA)
        evento = EventoWebhookAsaas.objects.get()
        self.assertEqual(evento.status_processamento, EventoWebhookAsaas.StatusProcessamento.PROCESSADO)
        self.assertEqual(evento.cobranca, self.cobranca)

    def test_cobranca_desconhecida_200_e_fica_ignorada(self):
        resposta = self._postar(
            {"event": "PAYMENT_RECEIVED", "payment": {"id": "pay_nao_existe", "status": "RECEIVED"}}
        )
        self.assertEqual(resposta.status_code, 200)
        self.cobranca.refresh_from_db()
        self.assertEqual(self.cobranca.status, Cobranca.Status.PENDENTE)
        evento = EventoWebhookAsaas.objects.get()
        self.assertEqual(evento.status_processamento, EventoWebhookAsaas.StatusProcessamento.IGNORADO)

    def test_status_vencido_e_cancelado(self):
        self._postar({"event": "PAYMENT_OVERDUE", "payment": {"id": "pay_1", "status": "OVERDUE"}})
        self.cobranca.refresh_from_db()
        self.assertEqual(self.cobranca.status, Cobranca.Status.VENCIDA)

        self._postar({"event": "PAYMENT_DELETED", "payment": {"id": "pay_1", "status": "DELETED"}})
        self.cobranca.refresh_from_db()
        self.assertEqual(self.cobranca.status, Cobranca.Status.CANCELADA)


class AdminSmokeTests(TestCase):
    """Django Admin (`/dj-admin/`) é o caminho de fallback pra criar
    cobrança sem WhatsApp (ver plan.md) — smoke test garante que as telas
    carregam e que criar pelo Admin passa pelo mesmo service."""

    def setUp(self):
        self.superuser = Usuario.objects.create_superuser(
            username="daniel-admin", password="senha-teste-123", email="d@teste.com"
        )
        self.client.force_login(self.superuser)
        criar_config_ativa()

    def test_tela_de_configuracao_asaas_add_carrega(self):
        resposta = self.client.get("/dj-admin/financeiro/configuracaoasaas/add/")
        self.assertEqual(resposta.status_code, 200)

    def test_tela_de_cobranca_add_carrega(self):
        resposta = self.client.get("/dj-admin/financeiro/cobranca/add/")
        self.assertEqual(resposta.status_code, 200)

    @patch("apps.financeiro.admin.criar_cobranca_para_matricula")
    def test_criar_cobranca_pelo_admin_chama_o_service(self, criar_cobranca_mock):
        matricula = criar_matricula()
        criar_cobranca_mock.return_value = Cobranca(
            pk=1,
            matricula=matricula,
            valor=Decimal("100"),
            forma_pagamento=Cobranca.FormaPagamento.PIX,
            status=Cobranca.Status.PENDENTE,
            vencimento=date(2026, 8, 1),
            link_pagamento="https://sandbox.asaas.com/i/pay_1",
            asaas_id="pay_1",
            ambiente=ConfiguracaoAsaas.Ambiente.SANDBOX,
        )
        resposta = self.client.post(
            "/dj-admin/financeiro/cobranca/add/",
            data={
                "matricula": matricula.pk,
                "valor": "100",
                "forma_pagamento": Cobranca.FormaPagamento.PIX,
                "vencimento": "2026-08-01",
            },
        )
        self.assertEqual(criar_cobranca_mock.call_count, 1)
        self.assertEqual(resposta.status_code, 302)  # redirect pós-save = sucesso

    def test_erro_do_service_mostra_mensagem_no_form_sem_500(self):
        matricula = criar_matricula(cpf=None)
        resposta = self.client.post(
            "/dj-admin/financeiro/cobranca/add/",
            data={
                "matricula": matricula.pk,
                "valor": "100",
                "forma_pagamento": Cobranca.FormaPagamento.PIX,
                "vencimento": "2026-08-01",
            },
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertContains(resposta, "CPF")
