"""Testes smoke do app `ia` (django test client, ver plan.md 004). Nunca
chamam API real — toda chamada de adaptador é mockada (`patch.object` no
método `executar`/`testar` da classe do adaptador)."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.ia.adapters.anthropic import AdaptadorAnthropic
from apps.ia.models import ExecucaoIA, ProvedorIA

Usuario = get_user_model()


def criar_provedor_texto_ativo_testado(provedor=ProvedorIA.Provedor.ANTHROPIC, modelo="claude-sonnet-5"):
    instancia = ProvedorIA(
        tipo=ProvedorIA.Tipo.TEXTO,
        provedor=provedor,
        modelo=modelo,
        ativo=True,
    )
    instancia.set_credencial("sk-ant-teste-123")
    instancia.testado_em = timezone.now()
    instancia.save()
    return instancia


class CapacidadesViewTests(TestCase):
    def setUp(self):
        self.gestor = Usuario.objects.create_user(
            username="gestora", password="senha-forte-123", papel=Usuario.Papel.GESTOR
        )
        self.client.force_login(self.gestor)

    def test_sem_provedor_todas_capacidades_ficam_falsas(self):
        resposta = self.client.get("/api/ia/capacidades/")
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertIn("texto.gerar", corpo)
        self.assertTrue(all(valor is False for valor in corpo.values()))

    def test_com_provedor_ativo_e_testado_capacidades_de_texto_ficam_verdadeiras(self):
        criar_provedor_texto_ativo_testado()
        resposta = self.client.get("/api/ia/capacidades/")
        corpo = resposta.json()
        self.assertTrue(corpo["texto.gerar"])
        self.assertTrue(corpo["texto.melhorar"])
        self.assertTrue(corpo["texto.variacoes"])
        # Sem provedor de imagem/vídeo configurado, essas continuam apagadas.
        self.assertFalse(corpo["imagem.gerar"])
        self.assertFalse(corpo["video.gerar"])

    def test_provedor_nao_testado_nao_acende_a_capacidade(self):
        ProvedorIA.objects.create(
            tipo=ProvedorIA.Tipo.TEXTO,
            provedor=ProvedorIA.Provedor.ANTHROPIC,
            modelo="claude-sonnet-5",
            ativo=True,
            # testado_em fica None de propósito.
        )
        resposta = self.client.get("/api/ia/capacidades/")
        self.assertFalse(resposta.json()["texto.gerar"])


class ExecutarViewTests(TestCase):
    def setUp(self):
        self.gestor = Usuario.objects.create_user(
            username="gestora", password="senha-forte-123", papel=Usuario.Papel.GESTOR
        )
        self.client.force_login(self.gestor)

    def test_executar_sem_provedor_retorna_400(self):
        resposta = self.client.post(
            "/api/ia/executar/",
            data={"capacidade": "texto.gerar", "contexto": {}},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("detail", resposta.json())
        self.assertEqual(ExecucaoIA.objects.count(), 0)

    def test_executar_capacidade_desconhecida_retorna_400(self):
        resposta = self.client.post(
            "/api/ia/executar/",
            data={"capacidade": "video.roteirizar", "contexto": {}},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 400)

    def test_executar_sem_capacidade_retorna_400(self):
        resposta = self.client.post(
            "/api/ia/executar/", data={}, content_type="application/json"
        )
        self.assertEqual(resposta.status_code, 400)

    @patch.object(AdaptadorAnthropic, "executar")
    def test_executar_com_adaptador_mockado_grava_execucao_ok(self, executar_mock):
        executar_mock.return_value = {
            "resultado": "Legenda de teste gerada.",
            "tokens_entrada": 42,
            "tokens_saida": 17,
        }
        provedor = criar_provedor_texto_ativo_testado()

        resposta = self.client.post(
            "/api/ia/executar/",
            data={
                "capacidade": "texto.gerar",
                "contexto": {"tipo_conteudo": "legenda", "turma": "APH-042"},
            },
            content_type="application/json",
        )

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json(), {"resultado": "Legenda de teste gerada."})
        executar_mock.assert_called_once()

        execucao = ExecucaoIA.objects.get()
        self.assertEqual(execucao.provedor_id, provedor.pk)
        self.assertEqual(execucao.status, ExecucaoIA.Status.OK)
        self.assertEqual(execucao.capacidade, "texto.gerar")
        self.assertEqual(execucao.tokens_entrada, 42)
        self.assertEqual(execucao.tokens_saida, 17)
        self.assertEqual(execucao.usuario, self.gestor)
        self.assertIn("legenda", execucao.contexto_resumo)

    @patch.object(AdaptadorAnthropic, "executar")
    def test_executar_com_erro_do_adaptador_grava_execucao_erro(self, executar_mock):
        from apps.ia.adapters.base import ErroAdaptadorIA

        executar_mock.side_effect = ErroAdaptadorIA("Anthropic recusou a chamada: chave inválida.")
        criar_provedor_texto_ativo_testado()

        resposta = self.client.post(
            "/api/ia/executar/",
            data={"capacidade": "texto.melhorar", "contexto": {"texto_atual": "oi"}},
            content_type="application/json",
        )

        self.assertEqual(resposta.status_code, 502)
        self.assertIn("chave inválida", resposta.json()["detail"])

        execucao = ExecucaoIA.objects.get()
        self.assertEqual(execucao.status, ExecucaoIA.Status.ERRO)
        self.assertIn("chave inválida", execucao.erro)


class ProvedorIACredencialTests(TestCase):
    def test_credencial_fica_cifrada_no_banco(self):
        provedor = ProvedorIA(
            tipo=ProvedorIA.Tipo.TEXTO,
            provedor=ProvedorIA.Provedor.ANTHROPIC,
            modelo="claude-sonnet-5",
        )
        chave_plana = "sk-ant-super-secreta"
        provedor.set_credencial(chave_plana)
        provedor.save()

        do_banco = ProvedorIA.objects.get(pk=provedor.pk)
        self.assertNotEqual(do_banco.credencial, chave_plana)
        self.assertNotIn(chave_plana, do_banco.credencial)
        self.assertEqual(do_banco.get_credencial(), chave_plana)

    def test_apenas_um_provedor_ativo_por_tipo(self):
        primeiro = ProvedorIA.objects.create(
            tipo=ProvedorIA.Tipo.TEXTO,
            provedor=ProvedorIA.Provedor.ANTHROPIC,
            modelo="claude-sonnet-5",
            ativo=True,
        )
        segundo = ProvedorIA.objects.create(
            tipo=ProvedorIA.Tipo.TEXTO,
            provedor=ProvedorIA.Provedor.OPENAI,
            modelo="gpt-4o-mini",
            ativo=True,
        )
        primeiro.refresh_from_db()
        self.assertFalse(primeiro.ativo)
        self.assertTrue(segundo.ativo)


class TestarProvedorViewTests(TestCase):
    def setUp(self):
        self.gestor = Usuario.objects.create_user(
            username="gestora", password="senha-forte-123", papel=Usuario.Papel.GESTOR
        )
        self.client.force_login(self.gestor)

    @patch.object(AdaptadorAnthropic, "testar")
    def test_testar_provedor_seta_testado_em(self, testar_mock):
        testar_mock.return_value = True
        provedor = ProvedorIA.objects.create(
            tipo=ProvedorIA.Tipo.TEXTO,
            provedor=ProvedorIA.Provedor.ANTHROPIC,
            modelo="claude-sonnet-5",
            ativo=True,
        )
        self.assertIsNone(provedor.testado_em)

        resposta = self.client.post(f"/api/ia/provedores/{provedor.pk}/testar/")
        self.assertEqual(resposta.status_code, 200)
        provedor.refresh_from_db()
        self.assertIsNotNone(provedor.testado_em)

    @patch.object(AdaptadorAnthropic, "testar")
    def test_testar_provedor_com_erro_nao_seta_testado_em(self, testar_mock):
        from apps.ia.adapters.base import ErroAdaptadorIA

        testar_mock.side_effect = ErroAdaptadorIA("Chave inválida.")
        provedor = ProvedorIA.objects.create(
            tipo=ProvedorIA.Tipo.TEXTO,
            provedor=ProvedorIA.Provedor.ANTHROPIC,
            modelo="claude-sonnet-5",
            ativo=True,
        )

        resposta = self.client.post(f"/api/ia/provedores/{provedor.pk}/testar/")
        self.assertEqual(resposta.status_code, 400)
        provedor.refresh_from_db()
        self.assertIsNone(provedor.testado_em)


class AcessoNegadoTests(TestCase):
    def test_usuario_nao_autenticado_nao_acessa_capacidades(self):
        resposta = self.client.get("/api/ia/capacidades/")
        self.assertIn(resposta.status_code, (401, 403))


class ProvedoresViewTests(TestCase):
    """CRUD que alimenta a página staff "Integrações de IA" (doc 10 §5.3,
    spec 004-T2) — nunca devolve a credencial em texto puro."""

    def setUp(self):
        self.gestor = Usuario.objects.create_user(
            username="gestora", password="senha-forte-123", papel=Usuario.Papel.GESTOR
        )
        self.client.force_login(self.gestor)

    def test_criar_provedor_cifra_credencial_e_nao_devolve_ela(self):
        resposta = self.client.post(
            "/api/ia/provedores/",
            data={
                "tipo": "texto",
                "provedor": "anthropic",
                "modelo": "claude-sonnet-5",
                "credencial_nova": "sk-ant-nova-chave",
            },
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 201)
        corpo = resposta.json()
        self.assertNotIn("credencial", corpo)
        self.assertNotIn("credencial_nova", corpo)
        self.assertTrue(corpo["tem_credencial"])
        self.assertTrue(corpo["ativo"])

        provedor = ProvedorIA.objects.get(pk=corpo["id"])
        self.assertEqual(provedor.get_credencial(), "sk-ant-nova-chave")

    def test_criar_provedor_sem_credencial_retorna_400(self):
        resposta = self.client.post(
            "/api/ia/provedores/",
            data={"tipo": "texto", "provedor": "anthropic", "modelo": "claude-sonnet-5"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 400)

    def test_listar_provedores_nao_expoe_credencial(self):
        criar_provedor_texto_ativo_testado()
        resposta = self.client.get("/api/ia/provedores/")
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertEqual(len(corpo), 1)
        self.assertNotIn("credencial", corpo[0])
        self.assertTrue(corpo[0]["tem_credencial"])

    def test_editar_provedor_em_branco_mantem_credencial_salva(self):
        provedor = criar_provedor_texto_ativo_testado()
        resposta = self.client.patch(
            f"/api/ia/provedores/{provedor.pk}/",
            data={"modelo": "claude-haiku-4-5"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 200)
        provedor.refresh_from_db()
        self.assertEqual(provedor.modelo, "claude-haiku-4-5")
        self.assertEqual(provedor.get_credencial(), "sk-ant-teste-123")

    def test_editar_provedor_com_credencial_nova_rotaciona_a_chave(self):
        provedor = criar_provedor_texto_ativo_testado()
        resposta = self.client.patch(
            f"/api/ia/provedores/{provedor.pk}/",
            data={"credencial_nova": "sk-ant-outra-chave"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 200)
        provedor.refresh_from_db()
        self.assertEqual(provedor.get_credencial(), "sk-ant-outra-chave")

    def test_desativar_provedor_via_ativo_false(self):
        provedor = criar_provedor_texto_ativo_testado()
        resposta = self.client.patch(
            f"/api/ia/provedores/{provedor.pk}/",
            data={"ativo": False},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertFalse(resposta.json()["ativo"])
        # Capacidade acende só com provedor ativo E testado — desativar apaga.
        self.assertFalse(self.client.get("/api/ia/capacidades/").json()["texto.gerar"])


class UsoMensalViewTests(TestCase):
    """Card de uso da página staff — contagem de execuções/tokens do mês
    corrente via `ExecucaoIA` (doc 10 §5.3, "sem surpresa na fatura")."""

    def setUp(self):
        self.gestor = Usuario.objects.create_user(
            username="gestora", password="senha-forte-123", papel=Usuario.Papel.GESTOR
        )
        self.client.force_login(self.gestor)

    def test_sem_execucoes_retorna_zerado(self):
        resposta = self.client.get("/api/ia/uso/")
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertEqual(corpo["execucoes"], 0)
        self.assertEqual(corpo["tokens_entrada"], 0)

    def test_soma_execucoes_e_tokens_do_mes(self):
        provedor = criar_provedor_texto_ativo_testado()
        ExecucaoIA.objects.create(
            provedor=provedor,
            capacidade="texto.gerar",
            status=ExecucaoIA.Status.OK,
            tokens_entrada=10,
            tokens_saida=20,
        )
        ExecucaoIA.objects.create(
            provedor=provedor,
            capacidade="texto.melhorar",
            status=ExecucaoIA.Status.ERRO,
            erro="falhou",
        )
        resposta = self.client.get("/api/ia/uso/")
        corpo = resposta.json()
        self.assertEqual(corpo["execucoes"], 2)
        self.assertEqual(corpo["execucoes_ok"], 1)
        self.assertEqual(corpo["execucoes_erro"], 1)
        self.assertEqual(corpo["tokens_entrada"], 10)
        self.assertEqual(corpo["tokens_saida"], 20)


class IntegracoesPaginaStaffTests(TestCase):
    """Página staff "Integrações de IA" (doc 10 §5.3) — mesmo padrão de
    auth das páginas staff do `midia` (Mesa de Luz/Studio): só quem tem
    `is_staff` entra, via `admin_site.admin_view`."""

    def setUp(self):
        self.staff = Usuario.objects.create_user(
            username="staffzinha",
            password="senha-forte-123",
            papel=Usuario.Papel.GESTOR,
            is_staff=True,
        )

    def test_staff_acessa_a_pagina(self):
        self.client.force_login(self.staff)
        resposta = self.client.get("/dj-admin/ia/provedoria/integracoes/")
        self.assertEqual(resposta.status_code, 200)
        self.assertContains(resposta, "Integrações de IA")

    def test_anonimo_e_redirecionado_pro_login(self):
        resposta = self.client.get("/dj-admin/ia/provedoria/integracoes/")
        self.assertEqual(resposta.status_code, 302)
