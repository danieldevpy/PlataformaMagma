"""Testes de apps.nucleo: camada de ações (spec 005-T1 — registry, catálogo,
execução com auth de agente/escopo e auditoria/LogAcao) e config do site
público/painel (spec 001-T2). Ver apps/nucleo/acoes.py, apps/nucleo/views.py
e specs/005-camada-de-acoes/spec.md."""

from django.test import TestCase
from django.urls import reverse

from apps.avaliacoes.models import ConviteAvaliacao
from apps.contas.models import Usuario
from apps.cursos.models import Curso, Turma
from apps.midia.models import Postagem
from apps.nucleo.models import ConfiguracaoSite, LogAcao, TokenAgente
from apps.nucleo.serializers import CAMPOS_CONFIG
from apps.nucleo.testing import criar_gestor, criar_instrutor, jpeg_em_memoria, jwt_headers


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

    def test_status_turma_inclui_contagens(self):
        """status_turma (apps/cursos/acoes.py) soma mídias/postagens/
        avaliações da turma — o teste acima só checava turma_codigo/curso."""
        from apps.avaliacoes.models import Avaliacao
        from apps.midia.models import Midia

        Postagem.objects.create(turma=self.turma, titulo="Post 1")
        Midia.objects.create(
            camada=Midia.Camada.TURMA,
            turma=self.turma,
            tipo=Midia.Tipo.FOTO,
            arquivo=jpeg_em_memoria(),
        )
        Avaliacao.objects.create(
            curso=self.curso,
            turma=self.turma,
            nome="Fulana",
            estrelas=5,
            comentario="Muito bom.",
            status=Avaliacao.Status.APROVADA,
        )

        self.client.force_login(self.gestor)
        resposta = self.client.post(
            self.url_executar,
            data={"acao": "status_turma", "params": {"turma_codigo": "T027"}},
            content_type="application/json",
        )
        resultado = resposta.json()["resultado"]
        self.assertEqual(resultado["midias"], 1)
        self.assertEqual(resultado["postagens"], 1)
        self.assertEqual(resultado["avaliacoes"], 1)

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


class SiteConfigPublicaViewTests(TestCase):
    """GET /api/site/config/ — spec 001, T2. Singleton (get_or_create(pk=1)),
    shape = CAMPOS_CONFIG (ver apps/nucleo/serializers.py)."""

    def test_responde_200_com_shape_do_contrato(self):
        resposta = self.client.get(reverse("site-config"))
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(set(resposta.json().keys()), set(CAMPOS_CONFIG))

    def test_reflete_valores_salvos(self):
        config = ConfiguracaoSite.obter()
        config.instagram = "@teste_magma"
        config.exibir_nota_google = True
        config.nota_google = "4.9"
        config.save()

        resposta = self.client.get(reverse("site-config"))
        corpo = resposta.json()
        self.assertEqual(corpo["instagram"], "@teste_magma")
        self.assertTrue(corpo["exibir_nota_google"])


class ConfigPainelViewTests(TestCase):
    """GET/PATCH /api/painel/config/ — só gestor; PATCH marca
    conteudo_origem="editado" (MarcarEditadoMixin). ConfigPainelView não
    declara authentication_classes — só JWT (default global) vale aqui,
    ver `jwt_headers` em apps/nucleo/testing.py."""

    def setUp(self):
        self.gestor = criar_gestor()

    def test_gestor_edita_e_marca_editado(self):
        resposta = self.client.patch(
            reverse("painel-config"),
            data={"instagram": "@magma_editado"},
            content_type="application/json",
            headers=jwt_headers(self.gestor),
        )
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertEqual(corpo["instagram"], "@magma_editado")
        self.assertEqual(corpo["conteudo_origem"], "editado")

    def test_instrutor_nao_acessa(self):
        resposta = self.client.get(
            reverse("painel-config"), headers=jwt_headers(criar_instrutor())
        )
        self.assertEqual(resposta.status_code, 403)

    def test_anonimo_401_ou_403(self):
        resposta = self.client.get(reverse("painel-config"))
        self.assertIn(resposta.status_code, (401, 403))


class TokenAgenteAdminTests(TestCase):
    """POST /dj-admin/nucleo/tokenagente/add/ — TokenAgenteAdmin.save_model
    gera o par (bruto/hash) e mostra o bruto uma única vez na mensagem
    (ver apps/nucleo/admin.py); a lógica de hash em si já é coberta por
    TokenAgente.gerar_par via criar_token_agente, isto testa a "cola" do
    admin em volta dela."""

    def setUp(self):
        self.superusuario = Usuario.objects.create_user(
            username="super-token-admin",
            password="senha-teste-123",
            papel=Usuario.Papel.GESTOR,
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_login(self.superusuario)

    def test_criar_via_admin_gera_hash_e_mostra_bruto_uma_vez(self):
        resposta = self.client.post(
            "/dj-admin/nucleo/tokenagente/add/",
            data={"nome": "agente-admin-teste", "escopos": "[]", "ativo": "on"},
            follow=True,
        )
        self.assertEqual(resposta.status_code, 200)

        agente = TokenAgente.objects.get(nome="agente-admin-teste")
        self.assertTrue(agente.token_hash)
        self.assertEqual(len(agente.token_hash), 64)  # sha256 hex

        mensagens = [str(m) for m in resposta.context["messages"]]
        self.assertTrue(any("copie AGORA" in m for m in mensagens))
