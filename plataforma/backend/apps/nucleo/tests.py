"""Testes da camada de ações (spec 005-T1) — registry, catálogo, execução
com auth de agente/escopo e auditoria (LogAcao). Ver apps/nucleo/acoes.py,
apps/nucleo/views.py e specs/005-camada-de-acoes/spec.md."""

from django.test import TestCase
from django.urls import reverse

from apps.avaliacoes.models import ConviteAvaliacao
from apps.contas.models import Usuario
from apps.cursos.models import Curso, Turma
from apps.midia.models import Postagem
from apps.nucleo.models import LogAcao, TokenAgente


def criar_token_agente(nome="agente-teste", escopos=None):
    token_bruto, token_hash = TokenAgente.gerar_par()
    agente = TokenAgente.objects.create(
        nome=nome, token_hash=token_hash, escopos=escopos or []
    )
    return agente, token_bruto


class CamadaDeAcoesTests(TestCase):
    def setUp(self):
        self.gestor = Usuario.objects.create_user(
            username="gestora",
            password="senha-teste-123",
            papel=Usuario.Papel.GESTOR,
        )
        self.curso = Curso.objects.create(
            slug="socorrista-aph",
            nome="Socorrista APH",
            titulo_venda="Socorrista APH",
            subtitulo="Formação prática",
            carga_horaria=120,
        )
        self.turma = Turma.objects.create(curso=self.curso, codigo="T027")
        self.url_catalogo = reverse("acoes-catalogo")
        self.url_executar = reverse("acoes-executar")

    # ---- catálogo ------------------------------------------------------

    def test_catalogo_lista_acoes_registradas_e_descritivas_do_midia(self):
        self.client.force_login(self.gestor)
        resposta = self.client.get(self.url_catalogo)
        self.assertEqual(resposta.status_code, 200)

        nomes = {entrada["nome"] for entrada in resposta.json()}
        # Ações v1 do registry.
        self.assertIn("gerar_link_avaliacao", nomes)
        self.assertIn("status_turma", nomes)
        self.assertIn("listar_postagens_agendadas", nomes)
        # Catálogo descritivo do midia entra junto, sem quebrar o endpoint
        # antigo /api/midia/acoes/.
        self.assertIn("listar_acervo", nomes)

    def test_catalogo_exige_autenticacao(self):
        resposta = self.client.get(self.url_catalogo)
        self.assertIn(resposta.status_code, (401, 403))

    # ---- auth / escopo ---------------------------------------------------

    def test_executar_sem_auth_nega(self):
        resposta = self.client.post(
            self.url_executar,
            data={"acao": "status_turma", "params": {"turma_codigo": "T027"}},
            content_type="application/json",
        )
        self.assertIn(resposta.status_code, (401, 403))

    def test_executar_token_com_escopo_errado_403(self):
        _, token_bruto = criar_token_agente(
            nome="agente-so-midia", escopos=["midia:*"]
        )
        resposta = self.client.post(
            self.url_executar,
            data={"acao": "status_turma", "params": {"turma_codigo": "T027"}},
            content_type="application/json",
            headers={"X-Agente-Token": token_bruto},
        )
        self.assertEqual(resposta.status_code, 403)

    def test_executar_token_inativo_nega(self):
        agente, token_bruto = criar_token_agente(escopos=["*"])
        agente.ativo = False
        agente.save(update_fields=["ativo"])
        resposta = self.client.post(
            self.url_executar,
            data={"acao": "status_turma", "params": {"turma_codigo": "T027"}},
            content_type="application/json",
            headers={"X-Agente-Token": token_bruto},
        )
        self.assertIn(resposta.status_code, (401, 403))

    # ---- gerar_link_avaliacao --------------------------------------------

    def test_gerar_link_avaliacao_devolve_url_valida(self):
        _, token_bruto = criar_token_agente(
            escopos=["avaliacoes:gerar_link_avaliacao"]
        )
        resposta = self.client.post(
            self.url_executar,
            data={
                "acao": "gerar_link_avaliacao",
                "params": {"turma_codigo": "T027"},
            },
            content_type="application/json",
            headers={"X-Agente-Token": token_bruto},
        )
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertIn("resultado", corpo)
        url = corpo["resultado"]["url"]

        convite = ConviteAvaliacao.objects.get(turma=self.turma)
        self.assertIn(str(convite.token), url)
        self.assertEqual(convite.escopo, ConviteAvaliacao.Escopo.TURMA)

        # A URL pública resolve — mesma rota do convite manual.
        resposta_convite = self.client.get(
            reverse("avaliacoes-convite", args=[convite.token])
        )
        self.assertEqual(resposta_convite.status_code, 200)
        self.assertTrue(resposta_convite.json()["valido"])

    def test_gerar_link_avaliacao_reusa_convite_existente(self):
        _, token_bruto = criar_token_agente(escopos=["*"])
        headers = {"X-Agente-Token": token_bruto}
        payload = {
            "acao": "gerar_link_avaliacao",
            "params": {"turma_codigo": "T027"},
        }
        primeira = self.client.post(
            self.url_executar, data=payload, content_type="application/json", headers=headers
        )
        segunda = self.client.post(
            self.url_executar, data=payload, content_type="application/json", headers=headers
        )
        self.assertEqual(
            primeira.json()["resultado"]["url"], segunda.json()["resultado"]["url"]
        )
        self.assertEqual(ConviteAvaliacao.objects.filter(turma=self.turma).count(), 1)

    def test_gerar_link_avaliacao_turma_inexistente_400_e_loga_erro(self):
        _, token_bruto = criar_token_agente(escopos=["*"])
        resposta = self.client.post(
            self.url_executar,
            data={
                "acao": "gerar_link_avaliacao",
                "params": {"turma_codigo": "NAO-EXISTE"},
            },
            content_type="application/json",
            headers={"X-Agente-Token": token_bruto},
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("detail", resposta.json())

        log = LogAcao.objects.filter(acao="gerar_link_avaliacao").latest("criado_em")
        self.assertEqual(log.status, LogAcao.Status.ERRO)
        self.assertTrue(log.erro)

    # ---- status_turma / listar_postagens_agendadas ------------------------

    def test_status_turma_como_humano(self):
        self.client.force_login(self.gestor)
        resposta = self.client.post(
            self.url_executar,
            data={"acao": "status_turma", "params": {"turma_codigo": "T027"}},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 200)
        resultado = resposta.json()["resultado"]
        self.assertEqual(resultado["turma_codigo"], "T027")
        self.assertEqual(resultado["curso"], "Socorrista APH")

    def test_listar_postagens_agendadas(self):
        Postagem.objects.create(turma=self.turma, titulo="Sem agenda")
        agendada = Postagem.objects.create(
            turma=self.turma,
            titulo="Com agenda",
            agendada_para="2026-08-01T12:00:00Z",
        )
        _, token_bruto = criar_token_agente(escopos=["midia:*"])
        resposta = self.client.post(
            self.url_executar,
            data={"acao": "listar_postagens_agendadas", "params": {}},
            content_type="application/json",
            headers={"X-Agente-Token": token_bruto},
        )
        self.assertEqual(resposta.status_code, 200)
        resultado = resposta.json()["resultado"]
        self.assertEqual(len(resultado), 1)
        # Sem "id" (PK) no retorno — IDs públicos nunca são PK sequencial
        # (constituição §6/spec 005 critério 6); turma_codigo + agendada_para
        # já identificam a postagem sem ambiguidade.
        self.assertNotIn("id", resultado[0])
        self.assertEqual(resultado[0]["turma_codigo"], self.turma.codigo)
        self.assertEqual(resultado[0]["titulo"], agendada.titulo)
        self.assertEqual(resultado[0]["agendada_para"], "2026-08-01T12:00:00Z")

    # ---- LogAcao gravado sempre --------------------------------------------

    def test_logacao_gravado_em_sucesso(self):
        self.client.force_login(self.gestor)
        self.client.post(
            self.url_executar,
            data={"acao": "status_turma", "params": {"turma_codigo": "T027"}},
            content_type="application/json",
        )
        log = LogAcao.objects.filter(acao="status_turma").latest("criado_em")
        self.assertEqual(log.status, LogAcao.Status.OK)
        self.assertEqual(log.usuario, self.gestor)

    def test_logacao_gravado_acao_inexistente(self):
        self.client.force_login(self.gestor)
        resposta = self.client.post(
            self.url_executar,
            data={"acao": "acao_que_nao_existe", "params": {}},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 404)
        log = LogAcao.objects.filter(acao="acao_que_nao_existe").latest("criado_em")
        self.assertEqual(log.status, LogAcao.Status.ERRO)


class PatchAgendadaParaTests(TestCase):
    """PATCH postagens/<pk>/ — agendada_para (ver apps/midia/serializers.py)."""

    def setUp(self):
        self.gestor = Usuario.objects.create_user(
            username="gestora2",
            password="senha-teste-123",
            papel=Usuario.Papel.GESTOR,
        )
        curso = Curso.objects.create(
            slug="socorrista-aph-2",
            nome="Socorrista APH",
            titulo_venda="Socorrista APH",
            subtitulo="Formação prática",
            carga_horaria=120,
        )
        turma = Turma.objects.create(curso=curso, codigo="T028")
        self.postagem = Postagem.objects.create(turma=turma, titulo="Post teste")

    def test_patch_agendada_para(self):
        self.client.force_login(self.gestor)
        url = reverse("midia-postagem-detail", args=[self.postagem.id])
        resposta = self.client.patch(
            url,
            data={"agendada_para": "2026-08-05T15:30:00Z"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertIsNotNone(resposta.json()["agendada_para"])

        self.postagem.refresh_from_db()
        self.assertIsNotNone(self.postagem.agendada_para)
        self.assertEqual(self.postagem.agendada_para.isoformat(), "2026-08-05T15:30:00+00:00")
