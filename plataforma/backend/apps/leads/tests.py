"""Testes de apps.leads (spec 001, T3) — captação pública e painel. Ver
specs/001-suite-de-testes/plan.md §T3."""

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.avaliacoes.models import Avaliacao
from apps.contas.models import Usuario
from apps.cursos.models import Turma
from apps.leads.models import Lead
from apps.nucleo.models import ContatoEscalado
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


class ProcessarNutridoraTests(TestCase):
    """apps/leads/acoes.py — ação `processar_nutridora`, usada pelo
    workflow `MAG - Nutridora (T+1/3/7)` (Schedule Trigger, sem AI Agent)
    pra mandar os toques automáticos com dado real
    (specs/020-agente-whatsapp-nutridora-t1-t3-t7)."""

    def setUp(self):
        self.url_executar = reverse("acoes-executar")
        self.gestor = Usuario.objects.create_user(
            username="gestora-nutridora",
            password="senha-teste-123",
            papel=Usuario.Papel.GESTOR,
        )
        self.curso, self.turma = criar_curso_turma(slug="nutridora-teste")

    def _executar(self):
        self.client.force_login(self.gestor)
        resposta = self.client.post(
            self.url_executar,
            data={"acao": "processar_nutridora", "params": {}},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 200)
        return resposta.json()["resultado"]

    def _criar_lead(self, dias_atras, **extra):
        lead = Lead.objects.create(
            nome="Lead Nutridora", whatsapp="5521988887777", **extra
        )
        Lead.objects.filter(pk=lead.pk).update(
            criado_em=timezone.now() - timedelta(days=dias_atras)
        )
        lead.refresh_from_db()
        return lead

    def test_t1_usa_habilidades_reais_do_curso(self):
        self.curso.habilidades.create(titulo="RCP e DEA", descricao="...")
        lead = self._criar_lead(dias_atras=2, curso=self.curso)

        resultado = self._executar()
        self.assertEqual(resultado["total"], 1)
        self.assertEqual(resultado["processados"][0]["numero"], lead.whatsapp)
        self.assertIn("RCP e DEA", resultado["processados"][0]["texto"])
        lead.refresh_from_db()
        self.assertEqual(lead.nutridora_ultimo_toque, Lead.ToqueNutridora.T1)

    def test_t1_generico_quando_lead_sem_curso(self):
        lead = self._criar_lead(dias_atras=2, curso=None)

        resultado = self._executar()
        self.assertEqual(resultado["total"], 1)
        lead.refresh_from_db()
        self.assertEqual(lead.nutridora_ultimo_toque, Lead.ToqueNutridora.T1)

    def test_nao_processa_lead_com_menos_de_1_dia(self):
        lead = self._criar_lead(dias_atras=0, curso=self.curso)

        resultado = self._executar()
        self.assertEqual(resultado["total"], 0)
        lead.refresh_from_db()
        self.assertEqual(lead.nutridora_ultimo_toque, "")

    def test_exclui_lead_nascido_de_conversa_whatsapp(self):
        self._criar_lead(dias_atras=2, curso=self.curso, utm_source="whatsapp")

        resultado = self._executar()
        self.assertEqual(resultado["total"], 0)

    def test_exclui_lead_escalado(self):
        lead = self._criar_lead(dias_atras=2, curso=self.curso)
        ContatoEscalado.objects.create(numero=lead.whatsapp, motivo="teste")

        resultado = self._executar()
        self.assertEqual(resultado["total"], 0)
        lead.refresh_from_db()
        self.assertEqual(lead.nutridora_ultimo_toque, "")

    def test_t3_usa_avaliacao_aprovada_do_curso(self):
        Avaliacao.objects.create(
            curso=self.curso,
            nome="Fulana Formada",
            estrelas=5,
            comentario="Mudou minha vida profissional.",
            status=Avaliacao.Status.APROVADA,
        )
        lead = self._criar_lead(
            dias_atras=4, curso=self.curso, nutridora_ultimo_toque=Lead.ToqueNutridora.T1
        )

        resultado = self._executar()
        self.assertEqual(resultado["total"], 1)
        self.assertIn("Mudou minha vida profissional.", resultado["processados"][0]["texto"])
        lead.refresh_from_db()
        self.assertEqual(lead.nutridora_ultimo_toque, Lead.ToqueNutridora.T3)

    def test_t3_sem_avaliacao_aprovada_nao_avanca(self):
        lead = self._criar_lead(
            dias_atras=4, curso=self.curso, nutridora_ultimo_toque=Lead.ToqueNutridora.T1
        )

        resultado = self._executar()
        self.assertEqual(resultado["total"], 0)
        lead.refresh_from_db()
        self.assertEqual(lead.nutridora_ultimo_toque, Lead.ToqueNutridora.T1)

    def test_t7_usa_vagas_reais_quando_exibir_vagas_ligado(self):
        Turma.objects.filter(pk=self.turma.pk).update(
            status=Turma.Status.INSCRICOES, capacidade=10, exibir_vagas=True
        )
        lead = self._criar_lead(
            dias_atras=8, curso=self.curso, nutridora_ultimo_toque=Lead.ToqueNutridora.T3
        )

        resultado = self._executar()
        self.assertEqual(resultado["total"], 1)
        self.assertIn("10 vaga", resultado["processados"][0]["texto"])
        lead.refresh_from_db()
        self.assertEqual(lead.nutridora_ultimo_toque, Lead.ToqueNutridora.T7)

    def test_t7_generico_quando_exibir_vagas_desligado(self):
        Turma.objects.filter(pk=self.turma.pk).update(
            status=Turma.Status.INSCRICOES, capacidade=10, exibir_vagas=False
        )
        lead = self._criar_lead(
            dias_atras=8, curso=self.curso, nutridora_ultimo_toque=Lead.ToqueNutridora.T3
        )

        resultado = self._executar()
        self.assertEqual(resultado["total"], 1)
        self.assertNotIn("10 vaga", resultado["processados"][0]["texto"])
        lead.refresh_from_db()
        self.assertEqual(lead.nutridora_ultimo_toque, Lead.ToqueNutridora.T7)

    def test_processa_no_maximo_um_toque_por_rodada(self):
        lead = self._criar_lead(dias_atras=10, curso=self.curso)

        resultado = self._executar()
        self.assertEqual(resultado["total"], 1)
        lead.refresh_from_db()
        self.assertEqual(lead.nutridora_ultimo_toque, Lead.ToqueNutridora.T1)
