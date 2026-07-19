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

    def test_acao_postagens_agendadas_contexto_curso(self):
        """Complementa test_acao_postagens_agendadas_com_contexto (turma×
        marca) com o branch de CURSO — nenhum teste cobria curso_slug."""
        from django.utils import timezone

        from apps.midia.acoes import listar_postagens_agendadas
        from apps.midia.models import Postagem

        Postagem.objects.create(
            curso=self.curso, titulo="Divulgação do curso", agendada_para=timezone.now()
        )
        fila = listar_postagens_agendadas({}, None)
        entrada = next(p for p in fila if p["titulo"] == "Divulgação do curso")
        self.assertEqual(entrada["contexto"], "curso")
        self.assertEqual(entrada["curso_slug"], self.curso.slug)
        self.assertIsNone(entrada["turma_codigo"])


# ---------------------------------------------------------------------------
# spec 001, T5 — smoke pesado do subsistema 09 (EXIF/thumb, dedup completo,
# curadoria, consentimento, postagem→ZIP→publicada_em, 403 exaustivo,
# páginas staff da turma). MEDIA_ROOT já isolado globalmente por
# config/settings/test.py — as classes abaixo não precisam de
# override_settings próprio (diferente de AcervoEmCamadasTests, criada antes
# do settings/test.py existir).
# ---------------------------------------------------------------------------

import zipfile as _zipfile
from io import BytesIO as _BytesIO

from django.urls import reverse as _reverse
from PIL import Image as _Image

from apps.nucleo.testing import (
    criar_curso_turma,
    criar_gestor,
    jpeg_em_memoria,
    png_em_memoria,
)


class UploadExifThumbTests(TestCase):
    """Upload com correção de orientação EXIF (ver apps/midia/utils.py)."""

    def setUp(self):
        self.gestor = criar_gestor(username="gestor-exif")
        _curso, self.turma = criar_curso_turma(slug="exif-teste")
        self.client.force_login(self.gestor)

    def test_exif_orientation_6_corrige_thumb_para_retrato(self):
        from apps.midia.models import Midia

        # Paisagem (40x20) fotografada "em pé" — EXIF Orientation=6 diz pra
        # girar 90° na exibição; gerar_thumbnail precisa aplicar isso nos
        # PIXELS do thumb (não só deixar a tag pro navegador interpretar).
        arquivo = jpeg_em_memoria("paisagem.jpg", tamanho=(40, 20), exif_orientation=6)
        resposta = self.client.post(
            _reverse("midia-enviar", args=[self.turma.id]), {"arquivo": arquivo}
        )
        self.assertEqual(resposta.status_code, 201)

        midia = Midia.objects.get(pk=resposta.json()["id"])
        self.assertTrue(midia.thumb)
        with midia.thumb.open("rb") as arquivo_thumb:
            largura, altura = _Image.open(arquivo_thumb).size
        self.assertLess(largura, altura)  # virou retrato


class DedupTurmaRotaTests(TestCase):
    """Dedup 409/forcar/case-insensitive/tamanho — via rota por turma
    (enviar_midia), complementando test_dedup_por_escopo_de_camada (rota
    geral) já existente em AcervoEmCamadasTests."""

    def setUp(self):
        self.gestor = criar_gestor(username="gestor-dedup")
        _curso, self.turma = criar_curso_turma(slug="dedup-turma-teste")
        self.client.force_login(self.gestor)
        self.url = _reverse("midia-enviar", args=[self.turma.id])

    def test_mesmo_nome_e_tamanho_409(self):
        primeiro = self.client.post(
            self.url, {"arquivo": jpeg_em_memoria("foto.jpg", tamanho=(10, 10))}
        )
        self.assertEqual(primeiro.status_code, 201)
        repetido = self.client.post(
            self.url, {"arquivo": jpeg_em_memoria("foto.jpg", tamanho=(10, 10))}
        )
        self.assertEqual(repetido.status_code, 409)
        corpo = repetido.json()
        self.assertTrue(corpo["duplicado"])
        self.assertIn("item_existente", corpo)

    def test_forcar_ignora_a_checagem(self):
        self.client.post(
            self.url, {"arquivo": jpeg_em_memoria("foto2.jpg", tamanho=(10, 10))}
        )
        resposta = self.client.post(
            self.url,
            {
                "arquivo": jpeg_em_memoria("foto2.jpg", tamanho=(10, 10)),
                "forcar": "1",
            },
        )
        self.assertEqual(resposta.status_code, 201)

    def test_case_insensitive_no_nome(self):
        self.client.post(
            self.url, {"arquivo": jpeg_em_memoria("Nome.jpg", tamanho=(10, 10))}
        )
        resposta = self.client.post(
            self.url, {"arquivo": jpeg_em_memoria("nome.jpg", tamanho=(10, 10))}
        )
        self.assertEqual(resposta.status_code, 409)

    def test_mesmo_nome_tamanho_diferente_nao_e_falso_positivo(self):
        self.client.post(
            self.url, {"arquivo": jpeg_em_memoria("foto3.jpg", tamanho=(10, 10))}
        )
        resposta = self.client.post(
            self.url, {"arquivo": jpeg_em_memoria("foto3.jpg", tamanho=(60, 60))}
        )
        self.assertEqual(resposta.status_code, 201)


class CuradoriaEReordenarTests(TestCase):
    """PATCH itens/<pk>/ (tags D/C/A) + POST reordenar/."""

    def setUp(self):
        self.gestor = criar_gestor(username="gestor-curadoria")
        _curso, self.turma = criar_curso_turma(slug="curadoria-teste")
        self.client.force_login(self.gestor)
        self.item1 = self._upload("um.jpg")
        self.item2 = self._upload("dois.jpg")

    def _upload(self, nome):
        resposta = self.client.post(
            _reverse("midia-enviar", args=[self.turma.id]),
            {"arquivo": jpeg_em_memoria(nome, tamanho=(10, 10))},
        )
        return resposta.json()["id"]

    def test_patch_edita_tags_legenda_e_credito(self):
        resposta = self.client.patch(
            _reverse("midia-item", args=[self.item1]),
            data={"tags": ["destaque", "capa"], "legenda": "Formatura"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertEqual(set(corpo["tags"]), {"destaque", "capa"})
        self.assertEqual(corpo["legenda"], "Formatura")

    def test_reordenar_persiste_ordem(self):
        resposta = self.client.post(
            _reverse("midia-reordenar", args=[self.turma.id]),
            data={"ids": [self.item2, self.item1]},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 200)

        from apps.midia.models import Midia

        self.assertEqual(Midia.objects.get(pk=self.item2).ordem, 0)
        self.assertEqual(Midia.objects.get(pk=self.item1).ordem, 1)

    def test_remover_item(self):
        from apps.midia.models import Midia

        resposta = self.client.delete(_reverse("midia-item", args=[self.item1]))
        self.assertEqual(resposta.status_code, 204)
        self.assertFalse(Midia.objects.filter(pk=self.item1).exists())


class ConsentimentoTests(TestCase):
    def setUp(self):
        self.gestor = criar_gestor(username="gestor-consentimento")
        _curso, self.turma = criar_curso_turma(slug="consentimento-teste")
        self.client.force_login(self.gestor)

    def test_liga_e_desliga_consentimento(self):
        url = _reverse("midia-consentimento", args=[self.turma.id])

        ligar = self.client.post(
            url, data={"ativo": True}, content_type="application/json"
        )
        self.assertEqual(ligar.status_code, 200)
        self.turma.refresh_from_db()
        self.assertTrue(self.turma.consentimento_midia)
        self.assertIsNotNone(self.turma.consentimento_midia_em)

        desligar = self.client.post(
            url, data={"ativo": False}, content_type="application/json"
        )
        self.assertEqual(desligar.status_code, 200)
        self.turma.refresh_from_db()
        self.assertFalse(self.turma.consentimento_midia)
        self.assertIsNone(self.turma.consentimento_midia_em)

    def test_valor_nao_booleano_400(self):
        resposta = self.client.post(
            _reverse("midia-consentimento", args=[self.turma.id]),
            data={"ativo": "sim"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 400)


class PostagemZipEPublicadaEmTests(TestCase):
    def setUp(self):
        self.gestor = criar_gestor(username="gestor-postagem-zip")
        _curso, self.turma = criar_curso_turma(slug="postagem-zip-teste")
        self.client.force_login(self.gestor)

    def test_zip_contem_as_artes_e_patch_publicada_seta_publicada_em(self):
        criacao = self.client.post(
            _reverse("midia-postagens", args=[self.turma.id]),
            {
                "titulo": "Carrossel de formatura",
                "legenda": "x",
                "artes": [png_em_memoria("a.png"), png_em_memoria("b.png")],
            },
        )
        self.assertEqual(criacao.status_code, 201)
        postagem_id = criacao.json()["id"]
        self.assertEqual(len(criacao.json()["artes"]), 2)

        zip_resposta = self.client.get(
            _reverse("midia-postagem-zip", args=[postagem_id])
        )
        self.assertEqual(zip_resposta.status_code, 200)
        self.assertEqual(zip_resposta["Content-Type"], "application/zip")
        arquivo_zip = _zipfile.ZipFile(_BytesIO(zip_resposta.content))
        self.assertIsNone(arquivo_zip.testzip())
        self.assertEqual(len(arquivo_zip.namelist()), 2)

        self.assertIsNone(criacao.json().get("publicada_em"))
        publicar = self.client.patch(
            _reverse("midia-postagem-detail", args=[postagem_id]),
            data={"status": "publicada"},
            content_type="application/json",
        )
        self.assertEqual(publicar.status_code, 200)
        self.assertIsNotNone(publicar.json()["publicada_em"])


class SegurancaTodasRotasMidiaTests(TestCase):
    """Toda rota /api/midia/ sem login → 403 (constituição/plan §T5). IDs
    fictícios são seguros: DRF checa permissão ANTES de resolver o objeto
    (APIView.dispatch → initial() → check_permissions, antes do handler)."""

    ROTAS = [
        ("midia-acoes", "get", []),
        ("midia-acervo-geral", "get", []),
        ("midia-camadas", "get", []),
        ("midia-acervo-enviar", "post", []),
        ("midia-postagens-geral", "get", []),
        ("midia-acervo", "get", [1]),
        ("midia-enviar", "post", [1]),
        ("midia-avaliacoes", "get", [1]),
        ("midia-reordenar", "post", [1]),
        ("midia-consentimento", "post", [1]),
        ("midia-postagens", "get", [1]),
        ("midia-item", "patch", [1]),
        ("midia-postagem-detail", "patch", [1]),
        ("midia-postagem-zip", "get", [1]),
    ]

    def test_todas_as_rotas_exigem_login(self):
        for nome, metodo, args in self.ROTAS:
            with self.subTest(rota=nome):
                url = _reverse(nome, args=args)
                resposta = getattr(self.client, metodo)(url)
                self.assertEqual(resposta.status_code, 403, f"{nome} não exigiu login")

    def test_instrutor_autorizado_no_catalogo(self):
        from apps.contas.models import Usuario

        instrutor = Usuario.objects.create_user(
            username="instrutor-midia-seguranca",
            password="senha-teste-123",
            papel=Usuario.Papel.INSTRUTOR,
        )
        self.client.force_login(instrutor)
        resposta = self.client.get(_reverse("midia-acoes"))
        self.assertEqual(resposta.status_code, 200)


class PaginasStaffTurmaTests(TestCase):
    """Mesa de Luz/Studio por TURMA (/dj-admin/cursos/turma/<id>/…) —
    complementa test_paginas_da_marca_renderizam (já existente acima)."""

    def setUp(self):
        self.gestor = criar_gestor(username="gestor-staff-turma", is_staff=True)
        _curso, self.turma = criar_curso_turma(slug="staff-turma-teste")

    def test_logado_acessa_acervo_e_studio(self):
        self.client.force_login(self.gestor)
        acervo = self.client.get(f"/dj-admin/cursos/turma/{self.turma.id}/acervo/")
        self.assertEqual(acervo.status_code, 200)
        self.assertContains(acervo, "MAGMA_CONTEXTO")

        studio = self.client.get(f"/dj-admin/cursos/turma/{self.turma.id}/studio/")
        self.assertEqual(studio.status_code, 200)

    def test_deslogado_e_redirecionado(self):
        acervo = self.client.get(f"/dj-admin/cursos/turma/{self.turma.id}/acervo/")
        self.assertEqual(acervo.status_code, 302)
