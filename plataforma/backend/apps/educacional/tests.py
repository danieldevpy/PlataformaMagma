"""Testes de apps.educacional — cadastro público de aluno novo (spec 014):
o link estável vive na Turma (`token_cadastro`) e o card digital no Aluno
(`token`). Ver specs/014-aluno-duravel-matricula-whatsapp/plan.md, Fase A."""

import uuid

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse

from apps.cursos.models import Turma
from apps.educacional.models import Aluno, Matricula
from apps.nucleo.testing import criar_curso_turma


class CarteirinhaAlunoGetTests(TestCase):
    def test_token_inexistente(self):
        resposta = self.client.get(reverse("carteirinha-aluno", args=[uuid.uuid4()]))
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json(), {"valido": False, "motivo": "inexistente"})

    def test_card_do_aluno_mostra_carteirinha_e_matriculas(self):
        _curso, turma = criar_curso_turma(
            slug="card-aluno", status=Turma.Status.INSCRICOES
        )
        aluno = Aluno.objects.create(nome="Fulano de Tal", cpf="111.222.333-44")
        Matricula.objects.create(
            aluno=aluno, turma=turma, status=Matricula.Status.ATIVA
        )

        resposta = self.client.get(reverse("carteirinha-aluno", args=[aluno.token]))
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertTrue(corpo["valido"])
        self.assertEqual(corpo["nome"], "Fulano de Tal")
        self.assertTrue(corpo["codigo_carteirinha"])
        self.assertEqual(corpo["token"], str(aluno.token))
        self.assertEqual(len(corpo["matriculas"]), 1)
        self.assertEqual(corpo["matriculas"][0]["turma_codigo"], turma.codigo)


class CadastroTurmaGetTests(TestCase):
    def test_turma_aberta_devolve_dados(self):
        _curso, turma = criar_curso_turma(
            slug="cad-aberta", status=Turma.Status.INSCRICOES
        )
        resposta = self.client.get(
            reverse("carteirinha-cadastro", args=[turma.token_cadastro])
        )
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertTrue(corpo["valido"])
        self.assertEqual(corpo["turma_codigo"], turma.codigo)
        self.assertEqual(corpo["curso"], "Socorrista APH")

    def test_turma_inexistente(self):
        resposta = self.client.get(
            reverse("carteirinha-cadastro", args=[uuid.uuid4()])
        )
        self.assertEqual(resposta.json(), {"valido": False, "motivo": "inexistente"})

    def test_turma_fechada(self):
        # Rascunho não aceita cadastro (só inscricoes/em_andamento).
        _curso, turma = criar_curso_turma(
            slug="cad-fechada", status=Turma.Status.RASCUNHO
        )
        resposta = self.client.get(
            reverse("carteirinha-cadastro", args=[turma.token_cadastro])
        )
        self.assertFalse(resposta.json()["valido"])
        self.assertEqual(resposta.json()["motivo"], "fechada")


class CadastroTurmaPostTests(TestCase):
    def _payload(self, nome="Aluno Teste", cpf="111.222.333-44"):
        return {"nome": nome, "cpf": cpf, "data_nascimento": "2000-01-01"}

    def test_cria_aluno_e_matricula_ativa(self):
        _curso, turma = criar_curso_turma(
            slug="cad-post", status=Turma.Status.INSCRICOES
        )
        resposta = self.client.post(
            reverse("carteirinha-cadastro", args=[turma.token_cadastro]),
            data=self._payload(),
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 201)

        aluno = Aluno.objects.get(cpf="11122233344")  # normalizado (só dígitos)
        self.assertEqual(aluno.nome, "Aluno Teste")
        matricula = Matricula.objects.get(aluno=aluno, turma=turma)
        # ATIVA explícito — CONVIDADO (default do model) não conta vaga.
        self.assertEqual(matricula.status, Matricula.Status.ATIVA)
        # a resposta é o card do aluno, com o token pro front redirecionar.
        self.assertEqual(resposta.json()["token"], str(aluno.token))

    def test_reabrir_link_mesmo_cpf_nao_duplica(self):
        # Idempotência do cadastro (requisito T5): reabrir o mesmo link com
        # o mesmo CPF não cria 2º Aluno nem estoura a unicidade (aluno,turma).
        _curso, turma = criar_curso_turma(
            slug="cad-dedup", status=Turma.Status.INSCRICOES
        )
        for _ in range(2):
            resposta = self.client.post(
                reverse("carteirinha-cadastro", args=[turma.token_cadastro]),
                data=self._payload(),
                content_type="application/json",
            )
            self.assertEqual(resposta.status_code, 201)

        self.assertEqual(Aluno.objects.filter(cpf="11122233344").count(), 1)
        self.assertEqual(Matricula.objects.filter(turma=turma).count(), 1)

    def test_turma_fechada_recusa_400(self):
        _curso, turma = criar_curso_turma(
            slug="cad-post-fechada", status=Turma.Status.ENCERRADA
        )
        resposta = self.client.post(
            reverse("carteirinha-cadastro", args=[turma.token_cadastro]),
            data=self._payload(),
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("detail", resposta.json())
        self.assertFalse(Aluno.objects.exists())

    def test_cpf_invalido_400(self):
        _curso, turma = criar_curso_turma(
            slug="cad-cpf-invalido", status=Turma.Status.INSCRICOES
        )
        resposta = self.client.post(
            reverse("carteirinha-cadastro", args=[turma.token_cadastro]),
            data={"nome": "Aluno", "cpf": "123", "data_nascimento": "2000-01-01"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 400)


class BuscarOuCriarPorCpfTests(TestCase):
    """`Aluno.buscar_ou_criar_por_cpf` (spec 014) — dedup central: é o que a
    migração de dados também fez em lote no legado (fundir duplicados), e
    o que roda pra cada cadastro novo daqui pra frente."""

    def test_cpf_novo_cria_aluno(self):
        aluno, criado = Aluno.buscar_ou_criar_por_cpf(
            "111.222.333-44", defaults={"nome": "Fulano"}
        )
        self.assertTrue(criado)
        self.assertEqual(aluno.cpf, "11122233344")

    def test_cpf_existente_nao_duplica_e_completa_campos_vazios(self):
        original = Aluno.objects.create(nome="Fulano", cpf="11122233344")
        aluno, criado = Aluno.buscar_ou_criar_por_cpf(
            "111.222.333-44",
            defaults={"nome": "Fulano", "whatsapp": "5521999998888"},
        )
        self.assertFalse(criado)
        self.assertEqual(aluno.pk, original.pk)
        self.assertEqual(Aluno.objects.filter(cpf="11122233344").count(), 1)
        # campo que estava vazio (whatsapp) é preenchido; nome não muda.
        aluno.refresh_from_db()
        self.assertEqual(aluno.whatsapp, "5521999998888")

    def test_sem_cpf_sempre_cria_novo(self):
        _um, _ = Aluno.buscar_ou_criar_por_cpf("", defaults={"nome": "A"})
        _dois, _ = Aluno.buscar_ou_criar_por_cpf("", defaults={"nome": "B"})
        self.assertNotEqual(_um.pk, _dois.pk)
        self.assertIsNone(_um.cpf)
        self.assertIsNone(_dois.cpf)


class MatriculaUnicidadeTests(TestCase):
    """`Matricula` — `UniqueConstraint(aluno, turma)` (spec 014): um mesmo
    aluno não pode ter duas matrículas na mesma turma."""

    def test_nao_permite_duas_matriculas_do_mesmo_aluno_na_mesma_turma(self):
        _curso, turma = criar_curso_turma(slug="matricula-unica")
        aluno = Aluno.objects.create(nome="Fulano", cpf="11122233344")
        Matricula.objects.create(aluno=aluno, turma=turma)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Matricula.objects.create(aluno=aluno, turma=turma)
