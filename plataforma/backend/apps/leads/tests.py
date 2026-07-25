"""Testes de apps.leads (spec 001, T3) — captação pública e painel. Ver
specs/001-suite-de-testes/plan.md §T3."""

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.avaliacoes.models import Avaliacao
from apps.contas.models import Usuario
from apps.conversas.models import Conversa
from apps.cursos.models import Curso, Turma
from apps.leads.models import Lead
from apps.nucleo.models import ConfiguracaoSite, ContatoEscalado
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


class ResolverCursoSlugTests(TestCase):
    """Spec 023 — a MAG mandou `curso_slug='socorrista-aph-120h'` (inventado
    a partir do nome exibido) e o lead nascia sem curso, em silêncio."""

    def criar(self, **dados):
        return self.client.post(
            reverse("leads-criar"), data=dados, content_type="application/json"
        )

    def test_slugs_que_a_mag_realmente_inventou_resolvem_o_curso(self):
        """Os três valores abaixo saíram de execuções reais em dev — a MAG
        nunca acertou o slug, sempre montou a partir do nome exibido."""
        curso, _turma = criar_curso_turma(slug="socorrista-aph")

        for i, inventado in enumerate(
            ["socorrista-aph-120h", "aph-120h", "socorrista-aph-atendimento"]
        ):
            with self.subTest(curso_slug=inventado):
                Lead.objects.all().delete()
                self.criar(
                    nome="Daniel",
                    whatsapp=f"552199192033{i}",
                    curso_slug=inventado,
                )
                self.assertEqual(Lead.objects.get().curso, curso)

    def test_resolve_pelo_nome_do_curso_e_nao_so_pelo_slug(self):
        curso, _turma = criar_curso_turma(slug="socorrista-aph")

        self.criar(
            nome="Daniel", whatsapp="5521991920338", curso_slug="Socorrista APH"
        )

        self.assertEqual(Lead.objects.get().curso, curso)

    def test_slug_encurtado_tambem_resolve(self):
        curso = Curso.objects.create(
            slug="primeiros-socorros-lei-lucas",
            nome="Primeiros Socorros — Lei Lucas",
            titulo_venda="Primeiros Socorros",
            subtitulo="Lei 13.722/2018",
            carga_horaria=4,
        )

        self.criar(
            nome="Daniel", whatsapp="5521991920338", curso_slug="primeiros-socorros"
        )

        self.assertEqual(Lead.objects.get().curso, curso)

    def test_empate_nao_chuta_curso(self):
        """Entre dois candidatos igualmente parecidos, melhor lead sem curso
        que lead com o curso errado."""
        criar_curso_turma(slug="socorrista-aph")
        Curso.objects.create(
            slug="socorrista-aph-avancado",
            nome="Socorrista APH",
            titulo_venda="Socorrista APH avançado",
            subtitulo="Avançado",
            carga_horaria=40,
        )

        self.criar(nome="Daniel", whatsapp="5521991920338", curso_slug="socorrista-aph-x")

        self.assertIsNone(Lead.objects.get().curso)

    def test_slug_sem_relacao_nenhuma_nao_quebra_a_captacao(self):
        criar_curso_turma(slug="socorrista-aph")

        resposta = self.criar(
            nome="Daniel", whatsapp="5521991920338", curso_slug="curso-de-violao"
        )

        self.assertEqual(resposta.status_code, 201, "nunca perder o lead")
        self.assertIsNone(Lead.objects.get().curso)


class LeadDedupPorWhatsappTests(TestCase):
    """Spec 023 — o agente MAG chamou `registrar_lead` 2× na mesma conversa
    e criou 2 leads pra mesma pessoa (mesmo com o prompt pedindo "uma vez
    só"). Quem garante a integridade da base é o backend, não o prompt."""

    def criar(self, **dados):
        resposta = self.client.post(
            reverse("leads-criar"), data=dados, content_type="application/json"
        )
        self.assertEqual(resposta.status_code, 201, resposta.content)
        return resposta

    def test_mesmo_whatsapp_nao_vira_dois_leads(self):
        self.criar(nome="Daniel", whatsapp="5521991920338")
        self.criar(nome="Daniel", whatsapp="5521991920338")

        self.assertEqual(Lead.objects.count(), 1)

    def test_segunda_chamada_completa_o_que_faltava(self):
        curso, _turma = criar_curso_turma(slug="aph-dedup")
        self.criar(nome="Daniel", whatsapp="5521991920338")
        self.criar(
            nome="Daniel",
            whatsapp="5521991920338",
            curso_slug=curso.slug,
            quando_pretende="agosto",
        )

        lead = Lead.objects.get()
        self.assertEqual(lead.curso, curso)
        self.assertEqual(lead.quando_pretende, "agosto")

    def test_valor_vazio_na_segunda_chamada_nao_apaga_o_da_primeira(self):
        curso, _turma = criar_curso_turma(slug="aph-preserva")
        self.criar(
            nome="Daniel",
            whatsapp="5521991920338",
            curso_slug=curso.slug,
            quando_pretende="agosto",
            utm_source="instagram",
        )
        self.criar(nome="Daniel", whatsapp="5521991920338", quando_pretende="")

        lead = Lead.objects.get()
        self.assertEqual(lead.curso, curso, "curso não pode sumir por vir vazio")
        self.assertEqual(lead.quando_pretende, "agosto")
        self.assertEqual(lead.utm_source, "instagram")

    def test_leads_sem_whatsapp_continuam_distintos(self):
        """Sem essa guarda, TODO lead sem número colapsaria num só."""
        self.criar(nome="Anônimo Um")
        self.criar(nome="Anônimo Dois")

        self.assertEqual(Lead.objects.count(), 2)

    def test_reencontro_preserva_criado_em_e_estado_da_nutridora(self):
        """Reencontrar um lead não pode reiniciar a régua (spec 020) nem
        inflar 'leads das últimas 24h' do Radar (spec 019)."""
        self.criar(nome="Daniel", whatsapp="5521991920338")
        lead = Lead.objects.get()
        antigo = timezone.now() - timedelta(days=10)
        Lead.objects.filter(pk=lead.pk).update(
            criado_em=antigo, nutridora_ultimo_toque=Lead.ToqueNutridora.T3
        )

        self.criar(nome="Daniel", whatsapp="5521991920338", quando_pretende="setembro")

        lead.refresh_from_db()
        self.assertEqual(lead.nutridora_ultimo_toque, Lead.ToqueNutridora.T3)
        self.assertLess(
            (lead.criado_em - antigo).total_seconds(),
            1,
            "criado_em do lead original não pode ser atualizado no reencontro",
        )

    def test_whatsapps_diferentes_continuam_sendo_leads_diferentes(self):
        self.criar(nome="Daniel", whatsapp="5521991920338")
        self.criar(nome="Outra Pessoa", whatsapp="5521888887777")

        self.assertEqual(Lead.objects.count(), 2)


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

    # --- 028-T20: a régua olha ATIVIDADE, não origem -------------------
    # Antes destes testes a ação fazia `.exclude(utm_source="whatsapp")`, e
    # como o `registrar_lead` do SDR carimba esse valor fixo no workflow,
    # NENHUM lead nascido de conversa entrava na régua. A campanha do Meta
    # é Click-to-WhatsApp, então isso deixava todo o lead pago sem nutrição.

    def _conversar(self, numero, dias_atras=0):
        return Conversa.objects.create(
            numero=numero, ultima_atividade_em=timezone.now() - timedelta(days=dias_atras)
        )

    def test_lead_de_whatsapp_sem_conversa_recente_entra_na_regua(self):
        lead = self._criar_lead(dias_atras=2, curso=self.curso, utm_source="whatsapp")

        resultado = self._executar()
        self.assertEqual(resultado["total"], 1)
        lead.refresh_from_db()
        self.assertEqual(lead.nutridora_ultimo_toque, Lead.ToqueNutridora.T1)

    def test_exclui_quem_falou_com_a_mag_agora(self):
        lead = self._criar_lead(dias_atras=2, curso=self.curso, utm_source="whatsapp")
        self._conversar(lead.whatsapp, dias_atras=0)

        resultado = self._executar()
        self.assertEqual(resultado["total"], 0)
        lead.refresh_from_db()
        self.assertEqual(lead.nutridora_ultimo_toque, "")

    def test_conversa_mais_velha_que_o_silencio_nao_exclui(self):
        lead = self._criar_lead(dias_atras=4, curso=self.curso, utm_source="whatsapp")
        self._conversar(lead.whatsapp, dias_atras=3)  # padrão do silêncio: 2 dias

        resultado = self._executar()
        self.assertEqual(resultado["total"], 1)

    def test_silencio_zero_desliga_a_checagem_de_conversa(self):
        config = ConfiguracaoSite.obter()
        config.nutridora_silencio_dias = 0
        config.save(update_fields=["nutridora_silencio_dias"])
        lead = self._criar_lead(dias_atras=2, curso=self.curso)
        self._conversar(lead.whatsapp, dias_atras=0)

        resultado = self._executar()
        self.assertEqual(resultado["total"], 1)

    def test_conversa_de_outro_numero_nao_exclui(self):
        lead = self._criar_lead(dias_atras=2, curso=self.curso)
        self._conversar("5521900000000", dias_atras=0)

        resultado = self._executar()
        self.assertEqual(resultado["total"], 1)
        self.assertEqual(resultado["processados"][0]["numero"], lead.whatsapp)

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
