"""Testes de apps.nucleo: camada de ações (spec 005-T1 — registry, catálogo,
execução com auth de agente/escopo e auditoria/LogAcao) e config do site
público/painel (spec 001-T2). Ver apps/nucleo/acoes.py, apps/nucleo/views.py
e specs/005-camada-de-acoes/spec.md."""

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

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
        """status_turma (apps/cursos/acoes.py) soma matrículas/mídias/
        postagens/avaliações da turma — o teste acima só checava
        turma_codigo/curso."""
        from apps.avaliacoes.models import Avaliacao
        from apps.educacional.models import Aluno, Matricula
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
        aluno_ativo = Aluno.objects.create(nome="Aluno Ativo", cpf="11111111111")
        Matricula.objects.create(
            aluno=aluno_ativo, turma=self.turma, status=Matricula.Status.ATIVA
        )
        # matrícula ainda em CONVIDADO — não conta como matrícula de fato
        # (só ativa/concluída contam vaga).
        aluno_convidado = Aluno.objects.create(
            nome="Aluno Convidado", cpf="22222222222"
        )
        Matricula.objects.create(aluno=aluno_convidado, turma=self.turma)

        self.client.force_login(self.gestor)
        resposta = self.client.post(
            self.url_executar,
            data={"acao": "status_turma", "params": {"turma_codigo": "T027"}},
            content_type="application/json",
        )
        resultado = resposta.json()["resultado"]
        self.assertEqual(resultado["matriculas"], 1)
        self.assertEqual(resultado["midias"], 1)
        self.assertEqual(resultado["postagens"], 1)
        self.assertEqual(resultado["avaliacoes"], 1)

    def test_listar_turmas(self):
        """listar_turmas (apps/cursos/acoes.py) — spec 013, achado do
        Daniel: precisa achar o código da turma sem lembrar de cabeça."""
        outra_turma = Turma.objects.create(
            curso=self.curso, codigo="T028", status=Turma.Status.ENCERRADA
        )

        self.client.force_login(self.gestor)
        resposta = self.client.post(
            self.url_executar,
            data={"acao": "listar_turmas", "params": {}},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 200)
        resultado = resposta.json()["resultado"]
        codigos = {item["turma_codigo"] for item in resultado}
        self.assertEqual(codigos, {"T027", "T028"})
        self.assertNotIn("id", resultado[0])

        resposta_filtrada = self.client.post(
            self.url_executar,
            data={"acao": "listar_turmas", "params": {"status": "encerrada"}},
            content_type="application/json",
        )
        resultado_filtrado = resposta_filtrada.json()["resultado"]
        self.assertEqual(len(resultado_filtrado), 1)
        self.assertEqual(resultado_filtrado[0]["turma_codigo"], outra_turma.codigo)

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


class IdentificarContatoTests(TestCase):
    """apps/nucleo/acoes_contato.py — ação `identificar_contato`, usada pelo
    roteador do agente WhatsApp (specs/009-agente-whatsapp-fundacao). Resolve
    via Usuario.whatsapp/papel (sem modelo novo — ver Log da spec) → Lead →
    desconhecido."""

    def setUp(self):
        self.url_executar = reverse("acoes-executar")
        _, self.token_bruto = criar_token_agente(
            nome="agente-recepcionista-mag",
            escopos=["nucleo:identificar_contato"],
        )

    def _identificar(self, numero):
        return self.client.post(
            self.url_executar,
            data={"acao": "identificar_contato", "params": {"numero": numero}},
            content_type="application/json",
            headers={"X-Agente-Token": self.token_bruto},
        )

    def test_identifica_gestor_por_whatsapp(self):
        Usuario.objects.create_user(
            username="daniel",
            password="senha-teste-123",
            first_name="Daniel",
            papel=Usuario.Papel.GESTOR,
            whatsapp="5521999990001",
        )
        resposta = self._identificar("5521999990001")
        self.assertEqual(resposta.status_code, 200)
        resultado = resposta.json()["resultado"]
        self.assertEqual(resultado["papel"], "gestor")
        self.assertEqual(resultado["nome"], "Daniel")

    def test_identifica_instrutor_por_whatsapp(self):
        Usuario.objects.create_user(
            username="professora",
            password="senha-teste-123",
            first_name="Fulana",
            papel=Usuario.Papel.INSTRUTOR,
            whatsapp="5521999990002",
        )
        resultado = self._identificar("5521999990002").json()["resultado"]
        self.assertEqual(resultado["papel"], "instrutor")
        self.assertEqual(resultado["nome"], "Fulana")

    def test_identifica_lead_por_whatsapp(self):
        from apps.leads.models import Lead

        Lead.objects.create(nome="Maria Interessada", whatsapp="5521999990003")
        resultado = self._identificar("5521999990003").json()["resultado"]
        self.assertEqual(resultado["papel"], "lead")
        self.assertEqual(resultado["nome"], "Maria Interessada")

    def test_usuario_tem_prioridade_sobre_lead_no_mesmo_numero(self):
        from apps.leads.models import Lead

        Usuario.objects.create_user(
            username="ambos",
            password="senha-teste-123",
            first_name="Operador",
            papel=Usuario.Papel.GESTOR,
            whatsapp="5521999990004",
        )
        Lead.objects.create(nome="Mesmo Número", whatsapp="5521999990004")
        resultado = self._identificar("5521999990004").json()["resultado"]
        self.assertEqual(resultado["papel"], "gestor")

    def test_desconhecido_quando_nao_encontra(self):
        resultado = self._identificar("5521999999999").json()["resultado"]
        self.assertEqual(resultado["papel"], "desconhecido")
        self.assertIsNone(resultado["nome"])

    def test_numero_vazio_400(self):
        resposta = self._identificar("")
        self.assertEqual(resposta.status_code, 400)

    def test_logacao_gravado(self):
        self._identificar("5521999999999")
        log = LogAcao.objects.filter(acao="identificar_contato").latest("criado_em")
        self.assertEqual(log.status, LogAcao.Status.OK)

    def test_escalado_false_por_padrao(self):
        resultado = self._identificar("5521999999999").json()["resultado"]
        self.assertFalse(resultado["escalado"])

    def test_escalado_true_quando_ha_registro(self):
        from apps.nucleo.models import ContatoEscalado

        ContatoEscalado.objects.create(
            numero="5521999990005", motivo="quer fechar matrícula"
        )
        resultado = self._identificar("5521999990005").json()["resultado"]
        self.assertTrue(resultado["escalado"])


class EscalarContatoTests(TestCase):
    """apps/nucleo/acoes_contato.py — ação `escalar_contato`
    (specs/012-agente-whatsapp-handoff)."""

    def setUp(self):
        self.url_executar = reverse("acoes-executar")
        _, self.token_bruto = criar_token_agente(
            nome="agente-recepcionista-mag",
            escopos=["nucleo:escalar_contato"],
        )

    def _escalar(self, numero, motivo):
        return self.client.post(
            self.url_executar,
            data={
                "acao": "escalar_contato",
                "params": {"numero": numero, "motivo": motivo},
            },
            content_type="application/json",
            headers={"X-Agente-Token": self.token_bruto},
        )

    def test_escalar_cria_registro(self):
        from apps.nucleo.models import ContatoEscalado

        resposta = self._escalar("5521999990006", "reclamação")
        self.assertEqual(resposta.status_code, 200)
        self.assertTrue(
            ContatoEscalado.objects.filter(numero="5521999990006").exists()
        )

    def test_escalar_de_novo_atualiza_motivo_sem_duplicar(self):
        from apps.nucleo.models import ContatoEscalado

        self._escalar("5521999990007", "motivo 1")
        self._escalar("5521999990007", "motivo 2")
        self.assertEqual(
            ContatoEscalado.objects.filter(numero="5521999990007").count(), 1
        )
        self.assertEqual(
            ContatoEscalado.objects.get(numero="5521999990007").motivo, "motivo 2"
        )

    def test_sem_motivo_400(self):
        resposta = self._escalar("5521999990008", "")
        self.assertEqual(resposta.status_code, 400)

    def test_sem_numero_400(self):
        resposta = self._escalar("", "motivo")
        self.assertEqual(resposta.status_code, 400)


class ListarLeadsTests(TestCase):
    """apps/leads/acoes.py — ação `listar_leads` (specs/013-agente-whatsapp-
    operadora-leitura, tool de leitura da Operadora/B1)."""

    def setUp(self):
        self.url_executar = reverse("acoes-executar")
        _, self.token_bruto = criar_token_agente(
            nome="agente-recepcionista-mag",
            escopos=["leads:listar_leads"],
        )
        self.curso = Curso.objects.create(
            slug="socorrista-aph-listar-leads",
            nome="Socorrista APH",
            titulo_venda="Socorrista APH",
            subtitulo="Formação prática",
            carga_horaria=120,
        )

    def _listar(self, **params):
        return self.client.post(
            self.url_executar,
            data={"acao": "listar_leads", "params": params},
            content_type="application/json",
            headers={"X-Agente-Token": self.token_bruto},
        )

    def _criar_lead(self, nome, dias_atras=0, **extra):
        from apps.leads.models import Lead

        lead = Lead.objects.create(nome=nome, curso=self.curso, **extra)
        if dias_atras:
            criado_em = timezone.now() - timedelta(days=dias_atras)
            Lead.objects.filter(pk=lead.pk).update(criado_em=criado_em)
        return lead

    def test_lista_leads_de_hoje_por_padrao(self):
        self._criar_lead("Maria")
        self._criar_lead("João", dias_atras=3)

        resposta = self._listar()
        self.assertEqual(resposta.status_code, 200)
        resultado = resposta.json()["resultado"]
        nomes = {item["nome"] for item in resultado}
        self.assertEqual(nomes, {"Maria"})

    def test_dias_amplia_a_janela(self):
        self._criar_lead("Maria")
        self._criar_lead("João", dias_atras=3)

        resposta = self._listar(dias=5)
        resultado = resposta.json()["resultado"]
        nomes = {item["nome"] for item in resultado}
        self.assertEqual(nomes, {"Maria", "João"})

    def test_filtra_por_status(self):
        self._criar_lead("Maria", status="novo")
        self._criar_lead("João", status="contatado")

        resposta = self._listar(status="contatado")
        resultado = resposta.json()["resultado"]
        nomes = {item["nome"] for item in resultado}
        self.assertEqual(nomes, {"João"})

    def test_retorno_nao_inclui_pk(self):
        self._criar_lead("Maria")
        resposta = self._listar()
        resultado = resposta.json()["resultado"]
        self.assertNotIn("id", resultado[0])
        self.assertEqual(resultado[0]["curso"], self.curso.nome)

    def test_dias_invalido_400(self):
        resposta = self._listar(dias="abc")
        self.assertEqual(resposta.status_code, 400)


class GerarLinkMatriculaTests(TestCase):
    """apps/educacional/acoes.py — ação `gerar_link_matricula` (spec 013,
    achado do Daniel: a Operadora não tinha como gerar link de matrícula
    nem informar quantas matrículas a turma já tem)."""

    def setUp(self):
        self.url_executar = reverse("acoes-executar")
        self.curso = Curso.objects.create(
            slug="socorrista-aph-matricula",
            nome="Socorrista APH",
            titulo_venda="Socorrista APH",
            subtitulo="Formação prática",
            carga_horaria=120,
        )
        self.turma = Turma.objects.create(curso=self.curso, codigo="T-MAT-1")
        _, self.token_bruto = criar_token_agente(
            escopos=["educacional:gerar_link_matricula"]
        )

    def _gerar(self, turma_codigo):
        return self.client.post(
            self.url_executar,
            data={
                "acao": "gerar_link_matricula",
                "params": {"turma_codigo": turma_codigo},
            },
            content_type="application/json",
            headers={"X-Agente-Token": self.token_bruto},
        )

    def test_devolve_link_de_cadastro_da_turma(self):
        # spec 014: o link agora é o token_cadastro estável da própria
        # Turma (não cria mais Matrícula-fantasma).
        resposta = self._gerar("T-MAT-1")
        self.assertEqual(resposta.status_code, 200)
        resultado = resposta.json()["resultado"]

        self.turma.refresh_from_db()
        self.assertIn(str(self.turma.token_cadastro), resultado["url"])
        self.assertIn("/carteirinha/nova/", resultado["url"])
        self.assertEqual(resultado["turma_codigo"], "T-MAT-1")
        self.assertNotIn("expira_em", resultado)

    def test_link_estavel_entre_chamadas(self):
        # o mesmo token_cadastro sempre — link estável e reutilizável.
        from apps.educacional.models import Matricula

        primeira = self._gerar("T-MAT-1")
        segunda = self._gerar("T-MAT-1")
        self.assertEqual(
            primeira.json()["resultado"]["url"], segunda.json()["resultado"]["url"]
        )
        # não cria Matrícula nenhuma (acabou a fantasma).
        self.assertEqual(Matricula.objects.filter(turma=self.turma).count(), 0)

    def test_turma_inexistente_400_e_loga_erro(self):
        resposta = self._gerar("NAO-EXISTE")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("detail", resposta.json())

        log = LogAcao.objects.filter(acao="gerar_link_matricula").latest("criado_em")
        self.assertEqual(log.status, LogAcao.Status.ERRO)


class ListarMatriculasTurmaTests(TestCase):
    """apps/educacional/acoes.py — ação `listar_matriculas_turma` (achado
    do Daniel testando a spec 014: precisa ver quem está matriculado numa
    turma específica, não só a contagem)."""

    def setUp(self):
        from apps.educacional.models import Aluno, Matricula

        self.Aluno = Aluno
        self.Matricula = Matricula
        self.url_executar = reverse("acoes-executar")
        self.curso = Curso.objects.create(
            slug="socorrista-aph-listar-matriculas",
            nome="Socorrista APH",
            titulo_venda="Socorrista APH",
            subtitulo="Formação prática",
            carga_horaria=120,
        )
        self.turma = Turma.objects.create(curso=self.curso, codigo="T-LISTA-1")
        _, self.token_bruto = criar_token_agente(
            escopos=["educacional:listar_matriculas_turma"]
        )

    def _listar(self, turma_codigo):
        return self.client.post(
            self.url_executar,
            data={
                "acao": "listar_matriculas_turma",
                "params": {"turma_codigo": turma_codigo},
            },
            content_type="application/json",
            headers={"X-Agente-Token": self.token_bruto},
        )

    def test_lista_alunos_ordenados_por_nome_sem_pk_nem_cpf(self):
        zeca = self.Aluno.objects.create(nome="Zeca", cpf="11122233344")
        ana = self.Aluno.objects.create(nome="Ana", cpf="22233344455")
        self.Matricula.objects.create(
            aluno=zeca, turma=self.turma, status=self.Matricula.Status.ATIVA
        )
        self.Matricula.objects.create(
            aluno=ana, turma=self.turma, status=self.Matricula.Status.CONCLUIDA
        )

        resposta = self._listar("T-LISTA-1")
        self.assertEqual(resposta.status_code, 200)
        resultado = resposta.json()["resultado"]
        self.assertEqual(resultado["turma_codigo"], "T-LISTA-1")
        nomes = [a["nome"] for a in resultado["alunos"]]
        self.assertEqual(nomes, ["Ana", "Zeca"])  # ordem alfabética
        self.assertEqual(resultado["alunos"][0]["status"], "concluida")
        self.assertNotIn("cpf", resultado["alunos"][0])
        self.assertNotIn("id", resultado["alunos"][0])
        self.assertEqual(resultado["alunos"][0]["aluno_token"], str(ana.token))

    def test_turma_sem_matricula_devolve_lista_vazia(self):
        resposta = self._listar("T-LISTA-1")
        self.assertEqual(resposta.json()["resultado"]["alunos"], [])

    def test_turma_inexistente_400(self):
        resposta = self._listar("NAO-EXISTE")
        self.assertEqual(resposta.status_code, 400)


class BuscarAlunoTests(TestCase):
    """apps/educacional/acoes.py — ação `buscar_aluno` (spec 014, Fase B):
    passo 1 do fluxo buscar → confirmar → matricular pelo WhatsApp."""

    def setUp(self):
        from apps.educacional.models import Aluno

        self.url_executar = reverse("acoes-executar")
        _, self.token_bruto = criar_token_agente(
            escopos=["educacional:buscar_aluno"]
        )
        self.daniel = Aluno.objects.create(
            nome="Daniel Fernandes", cpf="11122233344", whatsapp="5521999998888"
        )
        self.ana = Aluno.objects.create(nome="Ana Fernandes", cpf="22233344455")

    def _buscar(self, termo):
        return self.client.post(
            self.url_executar,
            data={"acao": "buscar_aluno", "params": {"termo": termo}},
            content_type="application/json",
            headers={"X-Agente-Token": self.token_bruto},
        )

    def test_por_nome_parcial_varios_resultados(self):
        resposta = self._buscar("Fernandes")
        self.assertEqual(resposta.status_code, 200)
        nomes = {c["nome"] for c in resposta.json()["resultado"]}
        self.assertEqual(nomes, {"Daniel Fernandes", "Ana Fernandes"})

    def test_por_nome_um_resultado_cpf_mascarado_sem_pk(self):
        resposta = self._buscar("Daniel")
        candidatos = resposta.json()["resultado"]
        self.assertEqual(len(candidatos), 1)
        candidato = candidatos[0]
        self.assertEqual(candidato["token"], str(self.daniel.token))
        self.assertEqual(candidato["cpf_mascarado"], "111.***")
        self.assertNotIn("111.***", "")  # sanity: garante que não é o CPF cru
        self.assertNotIn("cpf", candidato)
        self.assertNotIn("id", candidato)
        self.assertNotIn("pk", candidato)
        self.assertEqual(candidato["whatsapp"], "5521999998888")
        self.assertEqual(candidato["matriculas"], 0)

    def test_por_cpf_formatado(self):
        resposta = self._buscar("111.222.333-44")
        candidatos = resposta.json()["resultado"]
        self.assertEqual(len(candidatos), 1)
        self.assertEqual(candidatos[0]["token"], str(self.daniel.token))

    def test_por_whatsapp(self):
        resposta = self._buscar("21999998888")
        candidatos = resposta.json()["resultado"]
        self.assertEqual(len(candidatos), 1)
        self.assertEqual(candidatos[0]["token"], str(self.daniel.token))

    def test_nenhum_resultado(self):
        resposta = self._buscar("Alguém Que Não Existe")
        self.assertEqual(resposta.json()["resultado"], [])

    def test_termo_vazio_400(self):
        resposta = self._buscar("")
        self.assertEqual(resposta.status_code, 400)


class MatricularAlunoTests(TestCase):
    """apps/educacional/acoes.py — ação `matricular_aluno` (spec 014, Fase
    B): passo final do fluxo, só depois de buscar + confirmar."""

    def setUp(self):
        from apps.educacional.models import Aluno, Matricula

        self.Matricula = Matricula
        self.url_executar = reverse("acoes-executar")
        self.curso = Curso.objects.create(
            slug="socorrista-aph-matricular",
            nome="Socorrista APH",
            titulo_venda="Socorrista APH",
            subtitulo="Formação prática",
            carga_horaria=120,
        )
        self.turma = Turma.objects.create(
            curso=self.curso, codigo="T-MATRIC-1", capacidade=10
        )
        self.aluno = Aluno.objects.create(nome="Daniel Fernandes", cpf="11122233344")
        _, self.token_bruto = criar_token_agente(
            escopos=["educacional:matricular_aluno"]
        )

    def _matricular(self, aluno_token, turma_codigo, status=None):
        params = {"aluno_token": aluno_token, "turma_codigo": turma_codigo}
        if status:
            params["status"] = status
        return self.client.post(
            self.url_executar,
            data={"acao": "matricular_aluno", "params": params},
            content_type="application/json",
            headers={"X-Agente-Token": self.token_bruto},
        )

    def test_matricula_com_sucesso_e_conta_vaga(self):
        resposta = self._matricular(str(self.aluno.token), "T-MATRIC-1")
        self.assertEqual(resposta.status_code, 200)
        resultado = resposta.json()["resultado"]
        self.assertEqual(resultado["aluno_nome"], "Daniel Fernandes")
        self.assertEqual(resultado["turma_codigo"], "T-MATRIC-1")
        self.assertEqual(resultado["status"], "ativa")
        self.assertEqual(resultado["vagas_restantes"], 9)

        matricula = self.Matricula.objects.get(aluno=self.aluno, turma=self.turma)
        self.assertEqual(matricula.status, self.Matricula.Status.ATIVA)

    def test_duplicata_400(self):
        self.Matricula.objects.create(
            aluno=self.aluno, turma=self.turma, status=self.Matricula.Status.ATIVA
        )
        resposta = self._matricular(str(self.aluno.token), "T-MATRIC-1")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("já está matriculado", resposta.json()["detail"])

    def test_aluno_token_inexistente_400(self):
        import uuid

        resposta = self._matricular(str(uuid.uuid4()), "T-MATRIC-1")
        self.assertEqual(resposta.status_code, 400)

    def test_aluno_token_invalido_400(self):
        resposta = self._matricular("nao-e-um-uuid", "T-MATRIC-1")
        self.assertEqual(resposta.status_code, 400)

    def test_turma_inexistente_400(self):
        resposta = self._matricular(str(self.aluno.token), "NAO-EXISTE")
        self.assertEqual(resposta.status_code, 400)

    def test_status_invalido_400(self):
        resposta = self._matricular(str(self.aluno.token), "T-MATRIC-1", status="lixo")
        self.assertEqual(resposta.status_code, 400)


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
