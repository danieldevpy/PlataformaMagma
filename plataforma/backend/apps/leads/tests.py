"""Testes de apps.leads (spec 001, T3) — captação pública e painel. Ver
specs/001-suite-de-testes/plan.md §T3."""

from django.test import TestCase
from django.urls import reverse

from apps.leads.models import Lead
from apps.nucleo.testing import criar_curso_turma, criar_gestor, criar_instrutor, jwt_headers


class CriarLeadPublicoViewTests(TestCase):
    def test_cria_lead_201_com_whatsapp_url(self):
        curso, _turma = criar_curso_turma(slug="lead-teste")
        resposta = self.client.post(
            reverse("leads-criar"),
            data={
                "nome": "Fulano de Tal",
                "whatsapp": "21999998888",
                "curso_slug": curso.slug,
                "utm_source": "instagram",
            },
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 201)
        corpo = resposta.json()
        self.assertTrue(corpo["ok"])
        self.assertTrue(corpo["whatsapp_url"].startswith("https://wa.me/"))

        lead = Lead.objects.get()
        self.assertEqual(lead.nome, "Fulano de Tal")
        self.assertEqual(lead.curso, curso)

    def test_sem_nome_retorna_400(self):
        resposta = self.client.post(
            reverse("leads-criar"),
            data={"whatsapp": "21999998888"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 400)

    def test_curso_slug_inexistente_nao_quebra_cria_lead_sem_curso(self):
        resposta = self.client.post(
            reverse("leads-criar"),
            data={"nome": "Sem Curso", "curso_slug": "nao-existe"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 201)
        self.assertIsNone(Lead.objects.get().curso)


class LeadPainelViewSetTests(TestCase):
    """LeadPainelViewSet usa IsGestor (não IsGestorOuInstrutor) e não
    declara authentication_classes — só JWT (ver jwt_headers)."""

    def setUp(self):
        self.gestor = criar_gestor()
        self.lead = Lead.objects.create(nome="Ciclana", status="novo")

    def test_gestor_lista_e_edita_status(self):
        headers = jwt_headers(self.gestor)
        listagem = self.client.get(reverse("painel-leads-list"), headers=headers)
        self.assertEqual(listagem.status_code, 200)
        self.assertEqual(len(listagem.json()["results"]), 1)

        edicao = self.client.patch(
            reverse("painel-leads-detail", args=[self.lead.id]),
            data={"status": "contatado"},
            content_type="application/json",
            headers=headers,
        )
        self.assertEqual(edicao.status_code, 200)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, "contatado")

    def test_instrutor_nao_acessa(self):
        resposta = self.client.get(
            reverse("painel-leads-list"), headers=jwt_headers(criar_instrutor())
        )
        self.assertEqual(resposta.status_code, 403)

    def test_anonimo_401_ou_403(self):
        resposta = self.client.get(reverse("painel-leads-list"))
        self.assertIn(resposta.status_code, (401, 403))
