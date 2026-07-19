"""Testes de apps.educacional (spec 001, T4) — convite público de
carteirinha (magic-link, mesmo padrão de avaliações), escopo
turma×individual. Ver specs/001-suite-de-testes/plan.md §T4."""

import uuid
from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.educacional.models import Matricula
from apps.nucleo.testing import criar_curso_turma


class MatriculaConvitePublicoGetTests(TestCase):
    def test_token_inexistente(self):
        resposta = self.client.get(
            reverse("carteirinha-convite", args=[uuid.uuid4()])
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json(), {"valido": False, "motivo": "inexistente"})

    def test_token_expirado_sem_preenchimento(self):
        _curso, turma = criar_curso_turma(slug="carteirinha-expirada")
        matricula = Matricula.objects.create(
            turma=turma, expira_em=timezone.now() - timedelta(days=1)
        )
        resposta = self.client.get(
            reverse("carteirinha-convite", args=[matricula.token])
        )
        self.assertEqual(resposta.json()["motivo"], "expirado")

    def test_token_valido_devolve_codigo_carteirinha(self):
        _curso, turma = criar_curso_turma(slug="carteirinha-valida")
        matricula = Matricula.objects.create(turma=turma)
        resposta = self.client.get(
            reverse("carteirinha-convite", args=[matricula.token])
        )
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertTrue(corpo["valido"])
        self.assertEqual(corpo["turma_codigo"], turma.codigo)
        self.assertTrue(corpo["codigo_carteirinha"])
        self.assertFalse(corpo["preenchida"])
        self.assertIsNone(corpo["aluno"])

    def test_preenchida_nunca_expira(self):
        _curso, turma = criar_curso_turma(slug="carteirinha-preenchida")
        matricula = Matricula.objects.create(
            turma=turma,
            expira_em=timezone.now() - timedelta(days=1),
            preenchida_em=timezone.now(),
        )
        resposta = self.client.get(
            reverse("carteirinha-convite", args=[matricula.token])
        )
        self.assertTrue(resposta.json()["valido"])


class MatriculaConvitePublicoPostTests(TestCase):
    def _payload(self, nome="Aluno Teste"):
        return {"nome": nome, "cpf": "111.222.333-44", "data_nascimento": "2000-01-01"}

    def test_escopo_individual_preenche_a_propria_matricula(self):
        _curso, turma = criar_curso_turma(slug="carteirinha-individual")
        matricula = Matricula.objects.create(
            turma=turma, escopo=Matricula.Escopo.INDIVIDUAL
        )

        resposta = self.client.post(
            reverse("carteirinha-convite", args=[matricula.token]),
            data=self._payload(),
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 201)
        matricula.refresh_from_db()
        self.assertEqual(matricula.status, Matricula.Status.ATIVA)
        self.assertIsNotNone(matricula.preenchida_em)
        self.assertEqual(matricula.aluno.nome, "Aluno Teste")

    def test_escopo_turma_gera_matricula_nova_e_mantem_link_reutilizavel(self):
        _curso, turma = criar_curso_turma(slug="carteirinha-turma-reuso")
        convite_turma = Matricula.objects.create(
            turma=turma, escopo=Matricula.Escopo.TURMA
        )

        primeira = self.client.post(
            reverse("carteirinha-convite", args=[convite_turma.token]),
            data=self._payload("Aluno 1"),
            content_type="application/json",
        )
        segunda = self.client.post(
            reverse("carteirinha-convite", args=[convite_turma.token]),
            data=self._payload("Aluno 2"),
            content_type="application/json",
        )
        self.assertEqual(primeira.status_code, 201)
        self.assertEqual(segunda.status_code, 201)
        self.assertNotEqual(
            primeira.json()["token"], segunda.json()["token"]
        )

        convite_turma.refresh_from_db()
        self.assertIsNone(convite_turma.aluno)
        self.assertIsNone(convite_turma.preenchida_em)
        self.assertEqual(Matricula.objects.filter(turma=turma).count(), 3)  # convite + 2 gerados

    def test_cpf_invalido_400(self):
        _curso, turma = criar_curso_turma(slug="carteirinha-cpf-invalido")
        matricula = Matricula.objects.create(turma=turma)
        resposta = self.client.post(
            reverse("carteirinha-convite", args=[matricula.token]),
            data={"nome": "Aluno", "cpf": "123", "data_nascimento": "2000-01-01"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 400)
