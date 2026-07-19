"""Testes de apps.avaliacoes (spec 001, T4) — convite público (magic-link),
fotos do carrossel (acervo × fallback, mesmo shape), envio da avaliação,
escopo turma×individual e painel. Ver specs/001-suite-de-testes/plan.md §T4
e docs/subsistemas/09-acervo-studio-postagem.md."""

import uuid
from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.avaliacoes.models import Avaliacao, ConviteAvaliacao
from apps.cursos.models import FotoCurso
from apps.nucleo.testing import (
    criar_curso_turma,
    criar_gestor,
    jpeg_em_memoria,
    jwt_headers,
)


def criar_convite(curso, turma=None, escopo=ConviteAvaliacao.Escopo.TURMA, **extra):
    return ConviteAvaliacao.objects.create(
        curso=curso, turma=turma, escopo=escopo, **extra
    )


class ConviteAvaliacaoGetTests(TestCase):
    def test_token_inexistente(self):
        resposta = self.client.get(
            reverse("avaliacoes-convite", args=[uuid.uuid4()])
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json(), {"valido": False, "motivo": "inexistente"})

    def test_convite_expirado(self):
        curso, turma = criar_curso_turma(slug="convite-expirado")
        convite = criar_convite(
            curso, turma, expira_em=timezone.now() - timedelta(days=1)
        )
        resposta = self.client.get(reverse("avaliacoes-convite", args=[convite.token]))
        self.assertEqual(resposta.json()["motivo"], "expirado")

    def test_convite_individual_ja_usado(self):
        curso, turma = criar_curso_turma(slug="convite-usado")
        convite = criar_convite(
            curso,
            turma,
            escopo=ConviteAvaliacao.Escopo.INDIVIDUAL,
            usado_em=timezone.now(),
        )
        resposta = self.client.get(reverse("avaliacoes-convite", args=[convite.token]))
        self.assertEqual(resposta.json()["motivo"], "usado")

    def test_fallback_fotos_curso_quando_turma_sem_acervo(self):
        curso, turma = criar_curso_turma(slug="convite-fallback")
        FotoCurso.objects.create(
            curso=curso, imagem=jpeg_em_memoria("generica.jpg"), legenda="Genérica"
        )
        convite = criar_convite(curso, turma)

        resposta = self.client.get(reverse("avaliacoes-convite", args=[convite.token]))
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertTrue(corpo["valido"])
        self.assertEqual(corpo["turma_codigo"], turma.codigo)
        self.assertEqual(len(corpo["fotos"]), 1)
        # mesmo shape do caminho de acervo (ver test abaixo)
        self.assertEqual(set(corpo["fotos"][0].keys()), {"ordem", "imagem", "legenda"})
        self.assertEqual(corpo["fotos"][0]["legenda"], "Genérica")

    def test_fotos_do_acervo_priorizam_capa_e_mesmo_shape_do_fallback(self):
        from apps.midia.models import Midia

        curso, turma = criar_curso_turma(slug="convite-acervo")
        # ordem alta mas tag "capa" — deve vir primeiro mesmo assim.
        capa = Midia.objects.create(
            camada=Midia.Camada.TURMA,
            turma=turma,
            tipo=Midia.Tipo.FOTO,
            arquivo=jpeg_em_memoria("capa.jpg"),
            legenda="Capa da turma",
            tags=["capa", "avaliacao"],
            ordem=5,
        )
        Midia.objects.create(
            camada=Midia.Camada.TURMA,
            turma=turma,
            tipo=Midia.Tipo.FOTO,
            arquivo=jpeg_em_memoria("normal.jpg"),
            legenda="Foto normal",
            tags=["avaliacao"],
            ordem=1,
        )
        # sem tag relevante — não deve aparecer.
        Midia.objects.create(
            camada=Midia.Camada.TURMA,
            turma=turma,
            tipo=Midia.Tipo.FOTO,
            arquivo=jpeg_em_memoria("fora.jpg"),
            tags=[],
        )
        convite = criar_convite(curso, turma)

        resposta = self.client.get(reverse("avaliacoes-convite", args=[convite.token]))
        corpo = resposta.json()
        self.assertEqual(len(corpo["fotos"]), 2)
        self.assertEqual(set(corpo["fotos"][0].keys()), {"ordem", "imagem", "legenda"})
        self.assertEqual(corpo["fotos"][0]["legenda"], capa.legenda)
        self.assertIn("media/", corpo["fotos"][0]["imagem"])


class ConviteAvaliacaoPostTests(TestCase):
    def test_envia_avaliacao_cria_registro_pendente(self):
        curso, turma = criar_curso_turma(slug="convite-post")
        convite = criar_convite(curso, turma)

        resposta = self.client.post(
            reverse("avaliacoes-convite", args=[convite.token]),
            data={
                "nome": "Aluna Teste",
                "estrelas": 5,
                "comentario": "Curso muito bom, prática de verdade.",
                "cargo_atual": "Técnica",
            },
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 201)
        avaliacao = Avaliacao.objects.get()
        self.assertEqual(avaliacao.status, Avaliacao.Status.PENDENTE)
        self.assertEqual(avaliacao.conteudo_origem, "editado")
        self.assertEqual(avaliacao.turma, turma)

    def test_reenvio_em_convite_individual_ja_usado_400(self):
        curso, turma = criar_curso_turma(slug="convite-individual-reenvio")
        convite = criar_convite(
            curso, turma, escopo=ConviteAvaliacao.Escopo.INDIVIDUAL
        )
        payload = {
            "nome": "Fulano",
            "estrelas": 4,
            "comentario": "Muito bom, recomendo o curso.",
        }
        primeira = self.client.post(
            reverse("avaliacoes-convite", args=[convite.token]),
            data=payload,
            content_type="application/json",
        )
        self.assertEqual(primeira.status_code, 201)
        convite.refresh_from_db()
        self.assertIsNotNone(convite.usado_em)

        segunda = self.client.post(
            reverse("avaliacoes-convite", args=[convite.token]),
            data=payload,
            content_type="application/json",
        )
        self.assertEqual(segunda.status_code, 400)
        self.assertIn("detail", segunda.json())

    def test_convite_de_turma_e_reutilizavel_por_varios_alunos(self):
        curso, turma = criar_curso_turma(slug="convite-turma-reuso")
        convite = criar_convite(curso, turma, escopo=ConviteAvaliacao.Escopo.TURMA)
        payload = {"nome": "Aluno 1", "estrelas": 5, "comentario": "Ótimo curso."}
        payload2 = {"nome": "Aluno 2", "estrelas": 4, "comentario": "Muito bom."}

        primeira = self.client.post(
            reverse("avaliacoes-convite", args=[convite.token]),
            data=payload,
            content_type="application/json",
        )
        segunda = self.client.post(
            reverse("avaliacoes-convite", args=[convite.token]),
            data=payload2,
            content_type="application/json",
        )
        self.assertEqual(primeira.status_code, 201)
        self.assertEqual(segunda.status_code, 201)
        self.assertEqual(Avaliacao.objects.count(), 2)
        convite.refresh_from_db()
        self.assertIsNone(convite.usado_em)  # nunca marca uso em escopo turma


class CriarConvitePainelViewTests(TestCase):
    """POST /api/painel/convites/ — IsGestor, sem authentication_classes
    própria (só JWT, ver jwt_headers)."""

    def test_gestor_cria_convite_individual(self):
        curso, turma = criar_curso_turma(slug="convite-painel-individual")
        gestor = criar_gestor()
        resposta = self.client.post(
            reverse("painel-convites"),
            data={
                "curso": curso.slug,
                "turma": turma.id,
                "escopo": ConviteAvaliacao.Escopo.INDIVIDUAL,
                "nome_aluno": "Aluna Convidada",
            },
            content_type="application/json",
            headers=jwt_headers(gestor),
        )
        self.assertEqual(resposta.status_code, 201)
        corpo = resposta.json()
        self.assertIn("url", corpo)
        self.assertIn("whatsapp_share", corpo)

    def test_individual_sem_nome_aluno_400(self):
        curso, turma = criar_curso_turma(slug="convite-painel-sem-nome")
        resposta = self.client.post(
            reverse("painel-convites"),
            data={
                "curso": curso.slug,
                "turma": turma.id,
                "escopo": ConviteAvaliacao.Escopo.INDIVIDUAL,
            },
            content_type="application/json",
            headers=jwt_headers(criar_gestor()),
        )
        self.assertEqual(resposta.status_code, 400)

    def test_anonimo_401_ou_403(self):
        resposta = self.client.get(reverse("painel-avaliacoes-list"))
        self.assertIn(resposta.status_code, (401, 403))


class AvaliacaoPainelViewSetTests(TestCase):
    """Moderação de avaliação (aprovar/rejeitar, peso, exibir_na_home) — o
    fluxo central do painel de avaliações, sem cobertura até aqui (só a
    criação do convite tinha teste). IsGestor, sem authentication_classes
    própria — só JWT (ver jwt_headers)."""

    def setUp(self):
        self.gestor = criar_gestor(username="moderadora")
        self.curso, self.turma = criar_curso_turma(slug="moderacao-teste")
        self.avaliacao = Avaliacao.objects.create(
            curso=self.curso,
            turma=self.turma,
            nome="Aluno X",
            estrelas=5,
            comentario="Muito bom, recomendo.",
            status=Avaliacao.Status.PENDENTE,
        )

    def test_lista_filtra_por_status(self):
        resposta = self.client.get(
            reverse("painel-avaliacoes-list"),
            {"status": "pendente"},
            headers=jwt_headers(self.gestor),
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(len(resposta.json()["results"]), 1)

    def test_aprovar_avaliacao_ajusta_peso_e_exibir_na_home(self):
        resposta = self.client.patch(
            reverse("painel-avaliacoes-detail", args=[self.avaliacao.id]),
            data={"status": "aprovada", "peso": 2, "exibir_na_home": True},
            content_type="application/json",
            headers=jwt_headers(self.gestor),
        )
        self.assertEqual(resposta.status_code, 200)
        self.avaliacao.refresh_from_db()
        self.assertEqual(self.avaliacao.status, Avaliacao.Status.APROVADA)
        self.assertEqual(self.avaliacao.peso, 2)
        self.assertTrue(self.avaliacao.exibir_na_home)

    def test_rejeitar_avaliacao(self):
        resposta = self.client.patch(
            reverse("painel-avaliacoes-detail", args=[self.avaliacao.id]),
            data={"status": "rejeitada"},
            content_type="application/json",
            headers=jwt_headers(self.gestor),
        )
        self.assertEqual(resposta.status_code, 200)
        self.avaliacao.refresh_from_db()
        self.assertEqual(self.avaliacao.status, Avaliacao.Status.REJEITADA)

    def test_campos_readonly_no_serializer_nao_mudam(self):
        # nome/comentario/estrelas são read_only no AvaliacaoPainelSerializer
        # — moderação nunca reescreve o depoimento do aluno.
        self.client.patch(
            reverse("painel-avaliacoes-detail", args=[self.avaliacao.id]),
            data={"nome": "Outro Nome", "comentario": "Trocado", "estrelas": 1},
            content_type="application/json",
            headers=jwt_headers(self.gestor),
        )
        self.avaliacao.refresh_from_db()
        self.assertEqual(self.avaliacao.nome, "Aluno X")
        self.assertEqual(self.avaliacao.comentario, "Muito bom, recomendo.")
        self.assertEqual(self.avaliacao.estrelas, 5)

    def test_instrutor_nao_acessa(self):
        from apps.nucleo.testing import criar_instrutor

        resposta = self.client.get(
            reverse("painel-avaliacoes-list"), headers=jwt_headers(criar_instrutor())
        )
        self.assertEqual(resposta.status_code, 403)
