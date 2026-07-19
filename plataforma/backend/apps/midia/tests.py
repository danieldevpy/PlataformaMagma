"""Testes de apps.midia. Mínimo por enquanto — cobre o endpoint novo de
avaliações da turma (spec 003, T1); os demais endpoints ainda não têm
suíte (adicionar conforme for mexendo)."""

from django.test import TestCase
from django.urls import reverse

from apps.avaliacoes.models import Avaliacao
from apps.contas.models import Usuario
from apps.cursos.models import Curso, Turma


class AvaliacoesTurmaViewTests(TestCase):
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
        self.turma = Turma.objects.create(curso=self.curso, codigo="T1")
        self.outra_turma = Turma.objects.create(curso=self.curso, codigo="T2")

        self.aprovada_5 = Avaliacao.objects.create(
            curso=self.curso,
            turma=self.turma,
            nome="Maria Souza",
            cargo_atual="Técnica de enfermagem",
            estrelas=5,
            comentario="Curso excelente, prática de verdade.",
            status=Avaliacao.Status.APROVADA,
            peso=1,
        )
        self.aprovada_4 = Avaliacao.objects.create(
            curso=self.curso,
            turma=self.turma,
            nome="João Lima",
            cargo_atual="",
            estrelas=4,
            comentario="Muito bom, recomendo.",
            status=Avaliacao.Status.APROVADA,
            peso=0,
        )
        # Não deve aparecer: pendente.
        Avaliacao.objects.create(
            curso=self.curso,
            turma=self.turma,
            nome="Pendente",
            estrelas=5,
            comentario="Ainda não revisado.",
            status=Avaliacao.Status.PENDENTE,
        )
        # Não deve aparecer: outra turma.
        Avaliacao.objects.create(
            curso=self.curso,
            turma=self.outra_turma,
            nome="Outra Turma",
            estrelas=5,
            comentario="De outra turma.",
            status=Avaliacao.Status.APROVADA,
        )

    def test_exige_autenticacao(self):
        url = reverse("midia-avaliacoes", args=[self.turma.id])
        resposta = self.client.get(url)
        self.assertEqual(resposta.status_code, 403)

    def test_lista_so_aprovadas_da_turma_ordenadas(self):
        self.client.force_login(self.gestor)
        url = reverse("midia-avaliacoes", args=[self.turma.id])
        resposta = self.client.get(url)

        self.assertEqual(resposta.status_code, 200)
        dados = resposta.json()
        self.assertEqual(len(dados), 2)
        self.assertEqual(dados[0]["id"], self.aprovada_5.id)
        self.assertEqual(dados[1]["id"], self.aprovada_4.id)
        self.assertEqual(
            set(dados[0].keys()),
            {"id", "nome", "cargo_atual", "estrelas", "comentario", "criado_em"},
        )
        self.assertEqual(dados[0]["nome"], "Maria Souza")
        self.assertEqual(dados[0]["estrelas"], 5)

    def test_turma_inexistente_404(self):
        self.client.force_login(self.gestor)
        url = reverse("midia-avaliacoes", args=[99999])
        resposta = self.client.get(url)
        self.assertEqual(resposta.status_code, 404)


class AcervoEmCamadasTests(TestCase):
    """Spec 008 — invariantes de camada, upload geral, dedup por escopo,
    resumo de camadas e postagens multi-contexto."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        import tempfile

        from django.test import override_settings

        cls._media_tmp = tempfile.TemporaryDirectory()
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_tmp.name)
        cls._media_override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._media_override.disable()
        cls._media_tmp.cleanup()
        super().tearDownClass()

    def setUp(self):
        self.gestor = Usuario.objects.create_user(
            username="gestor-camadas",
            password="senha-teste-123",
            papel=Usuario.Papel.GESTOR,
            is_staff=True,  # páginas staff vivem sob /dj-admin/ (admin_view)
        )
        self.curso = Curso.objects.create(
            slug="socorrista-aph",
            nome="Socorrista APH",
            titulo_venda="Socorrista APH",
            subtitulo="Formação prática",
            carga_horaria=120,
        )
        self.turma = Turma.objects.create(curso=self.curso, codigo="027")
        self.client.force_login(self.gestor)

    def _png(self, nome="foto.png"):
        import io as _io

        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image

        buffer = _io.BytesIO()
        Image.new("RGB", (4, 4), "#c8102e").save(buffer, format="PNG")
        return SimpleUploadedFile(nome, buffer.getvalue(), content_type="image/png")

    # ---- upload geral / invariantes ----

    def test_upload_camada_geral(self):
        resp = self.client.post(
            reverse("midia-acervo-enviar"),
            {"arquivo": self._png(), "camada": "geral", "legenda": "estande"},
        )
        self.assertEqual(resp.status_code, 201)
        dados = resp.json()
        self.assertEqual(dados["camada"], "geral")
        from apps.midia.models import Midia

        item = Midia.objects.get(pk=dados["id"])
        self.assertIsNone(item.turma)
        self.assertIsNone(item.curso)
        self.assertTrue(item.arquivo.name.startswith("acervo/geral/foto/"))

    def test_upload_camada_curso(self):
        resp = self.client.post(
            reverse("midia-acervo-enviar"),
            {"arquivo": self._png(), "camada": "curso", "curso_id": self.curso.id},
        )
        self.assertEqual(resp.status_code, 201)
        from apps.midia.models import Midia

        item = Midia.objects.get(pk=resp.json()["id"])
        self.assertEqual(item.curso, self.curso)
        self.assertTrue(
            item.arquivo.name.startswith(f"acervo/cursos/{self.curso.id}/foto/")
        )

    def test_upload_camada_turma_mantem_caminho_historico(self):
        resp = self.client.post(
            reverse("midia-enviar", args=[self.turma.id]), {"arquivo": self._png()}
        )
        self.assertEqual(resp.status_code, 201)
        from apps.midia.models import Midia

        item = Midia.objects.get(pk=resp.json()["id"])
        self.assertEqual(item.camada, Midia.Camada.TURMA)
        self.assertTrue(item.arquivo.name.startswith(f"turmas/{self.turma.id}/foto/"))

    def test_camada_invalida_e_invariantes(self):
        url = reverse("midia-acervo-enviar")
        casos = [
            {"arquivo": self._png(), "camada": "album"},
            {"arquivo": self._png(), "camada": "turma"},  # sem turma_id
            {"arquivo": self._png(), "camada": "curso"},  # sem curso_id
            {"arquivo": self._png(), "camada": "geral", "curso_id": self.curso.id},
        ]
        for dados in casos:
            resp = self.client.post(url, dados)
            self.assertEqual(resp.status_code, 400, dados)

    def test_dedup_por_escopo_de_camada(self):
        url = reverse("midia-acervo-enviar")
        primeiro = self.client.post(
            url, {"arquivo": self._png("mesma.png"), "camada": "geral"}
        )
        self.assertEqual(primeiro.status_code, 201)
        repetido = self.client.post(
            url, {"arquivo": self._png("mesma.png"), "camada": "geral"}
        )
        self.assertEqual(repetido.status_code, 409)
        self.assertTrue(repetido.json()["duplicado"])
        # mesmo nome+tamanho em OUTRA camada não é duplicata
        outra_camada = self.client.post(
            url, {"arquivo": self._png("mesma.png"), "camada": "estrutura"}
        )
        self.assertEqual(outra_camada.status_code, 201)

    # ---- listagem / camadas ----

    def test_listar_acervo_geral_com_filtros(self):
        self.client.post(
            reverse("midia-acervo-enviar"),
            {"arquivo": self._png("a.png"), "camada": "geral"},
        )
        self.client.post(
            reverse("midia-acervo-enviar"),
            {"arquivo": self._png("b.png"), "camada": "instrutores"},
        )
        tudo = self.client.get(reverse("midia-acervo-geral")).json()
        self.assertEqual(len(tudo["itens"]), 2)
        so_instrutores = self.client.get(
            reverse("midia-acervo-geral"), {"camada": "instrutores"}
        ).json()
        self.assertEqual(len(so_instrutores["itens"]), 1)
        self.assertEqual(so_instrutores["itens"][0]["camada"], "instrutores")
        self.assertEqual(so_instrutores["contagens"]["fotos"], 1)

    def test_resumo_de_camadas(self):
        self.client.post(
            reverse("midia-acervo-enviar"),
            {"arquivo": self._png(), "camada": "geral"},
        )
        resp = self.client.get(reverse("midia-camadas"))
        self.assertEqual(resp.status_code, 200)
        dados = resp.json()
        gerais = {c["camada"]: c for c in dados["gerais"]}
        self.assertEqual(
            set(gerais), {"geral", "instrutores", "estrutura", "externa"}
        )
        self.assertEqual(gerais["geral"]["contagens"]["fotos"], 1)
        self.assertEqual(dados["cursos"][0]["nome"], "Socorrista APH")
        self.assertEqual(dados["turmas"][0]["codigo"], "027")

    # ---- postagens multi-contexto ----

    def test_postagem_da_marca(self):
        resp = self.client.post(
            reverse("midia-postagens-geral"),
            {"titulo": "Educativo", "legenda": "x", "artes": self._png("arte.png")},
        )
        self.assertEqual(resp.status_code, 201)
        dados = resp.json()
        self.assertEqual(dados["contexto"], "Marca")
        self.assertEqual(dados["artes"][0]["camada"], "geral")

        lista = self.client.get(
            reverse("midia-postagens-geral"), {"contexto": "marca"}
        ).json()
        self.assertEqual(len(lista), 1)

    def test_postagem_turma_e_curso_juntos_400(self):
        resp = self.client.post(
            reverse("midia-postagens-geral"),
            {
                "titulo": "X",
                "artes": self._png(),
                "turma_id": self.turma.id,
                "curso_id": self.curso.id,
            },
        )
        self.assertEqual(resp.status_code, 400)

    def test_acao_postagens_agendadas_com_contexto(self):
        from django.utils import timezone

        from apps.midia.acoes import listar_postagens_agendadas
        from apps.midia.models import Postagem

        Postagem.objects.create(
            titulo="Da marca", agendada_para=timezone.now()
        )
        Postagem.objects.create(
            titulo="Da turma", turma=self.turma, agendada_para=timezone.now()
        )
        fila = listar_postagens_agendadas({}, None)
        por_titulo = {p["titulo"]: p for p in fila}
        self.assertEqual(por_titulo["Da marca"]["contexto"], "marca")
        self.assertIsNone(por_titulo["Da marca"]["turma_codigo"])
        self.assertEqual(por_titulo["Da turma"]["contexto"], "turma")
        self.assertEqual(por_titulo["Da turma"]["turma_codigo"], "027")

    # ---- páginas staff da marca ----

    def test_paginas_da_marca_renderizam(self):
        acervo = self.client.get("/dj-admin/midia/midia/acervo/")
        self.assertEqual(acervo.status_code, 200)
        self.assertContains(acervo, "Acervo da Marca")
        self.assertContains(acervo, '"marca"')
        studio = self.client.get("/dj-admin/midia/midia/studio/")
        self.assertEqual(studio.status_code, 200)
        self.assertContains(studio, "MAGMA_CONTEXTO")
