"""Testes de apps.cursos (spec 001, T2) — LP pública (lista/detalhe de
curso, toggles de Turma) e painel (cursos/turmas/habilidades/faqs). Ver
specs/001-suite-de-testes/plan.md §T2."""

from django.test import TestCase
from django.urls import reverse

from apps.cursos.models import Curso, Habilidade, PerguntaFrequente, Turma
from apps.nucleo.testing import criar_curso_turma, criar_gestor, criar_instrutor, jwt_headers


class CursoListaPublicaViewTests(TestCase):
    def test_lista_so_publicados_identificados_por_slug(self):
        criar_curso_turma(slug="publicado-teste")
        criar_curso_turma(slug="rascunho-teste", curso_status=Curso.Status.RASCUNHO)

        resposta = self.client.get(reverse("cursos-lista"))
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        slugs = {item["slug"] for item in corpo}
        self.assertEqual(slugs, {"publicado-teste"})
        # ID público é o slug — nunca a PK sequencial (constituição §6).
        self.assertNotIn("id", corpo[0])


class CursoDetalhePublicoViewTests(TestCase):
    def test_detalhe_traz_campos_que_a_lp_consome(self):
        curso, turma = criar_curso_turma(
            slug="detalhe-teste", status=Turma.Status.INSCRICOES
        )
        Habilidade.objects.create(curso=curso, titulo="Suporte básico", descricao="x")
        PerguntaFrequente.objects.create(
            curso=curso, pergunta="Tem certificado?", resposta="Sim."
        )

        resposta = self.client.get(reverse("cursos-detalhe", args=[curso.slug]))
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertEqual(corpo["slug"], "detalhe-teste")
        self.assertEqual(len(corpo["habilidades"]), 1)
        self.assertEqual(len(corpo["faqs"]), 1)
        self.assertEqual(corpo["turma_destaque"]["codigo"], turma.codigo)
        self.assertIn("seo", corpo)

    def test_detalhe_inclui_instrutores_sem_pk(self):
        from apps.cursos.models import Instrutor

        curso, _turma = criar_curso_turma(slug="instrutor-teste")
        instrutor = Instrutor.objects.create(
            nome="Dra. Fulana", registro="COREN 12345", especializacao="Emergência"
        )
        instrutor.cursos.add(curso)

        resposta = self.client.get(reverse("cursos-detalhe", args=[curso.slug]))
        corpo = resposta.json()
        self.assertEqual(len(corpo["instrutores"]), 1)
        self.assertEqual(corpo["instrutores"][0]["nome"], "Dra. Fulana")
        # ID público seria slug/uuid — Instrutor nem expõe PK na LP.
        self.assertNotIn("id", corpo["instrutores"][0])

    def test_slug_inexistente_404(self):
        resposta = self.client.get(reverse("cursos-detalhe", args=["nao-existe"]))
        self.assertEqual(resposta.status_code, 404)
        self.assertIn("detail", resposta.json())

    def test_curso_rascunho_nao_aparece_no_detalhe_publico(self):
        curso, _turma = criar_curso_turma(
            slug="rascunho-detalhe", curso_status=Curso.Status.RASCUNHO
        )
        resposta = self.client.get(reverse("cursos-detalhe", args=[curso.slug]))
        self.assertEqual(resposta.status_code, 404)


class ToggleExibirTests(TestCase):
    """Constituição §3: toggle `exibir_*` desligado → campo vem `null` na
    resposta pública, sem mudar o front. Em Turma, só `preco` e `countdown`
    passam por essa regra (vagas_restantes/exibir_vagas são passthrough —
    a UI decide exibir, ver TurmaDestaquePublicaSerializer)."""

    def _turma_destaque(self, **campos_turma):
        curso, turma = criar_curso_turma(
            slug="toggle-teste", status=Turma.Status.INSCRICOES, **campos_turma
        )
        resposta = self.client.get(reverse("cursos-detalhe", args=[curso.slug]))
        return resposta.json()["turma_destaque"]

    def test_preco_desligado_vem_null(self):
        destaque = self._turma_destaque(exibir_preco=False, preco_cheio="600.00")
        self.assertIsNone(destaque["preco"])

    def test_preco_ligado_vem_preenchido(self):
        destaque = self._turma_destaque(
            exibir_preco=True, preco_cheio="600.00", preco_avista="500.00"
        )
        self.assertIsNotNone(destaque["preco"])
        # COERCE_DECIMAL_TO_STRING=False (config/settings/base.py) — Decimal
        # sai como número JSON, não string.
        self.assertEqual(destaque["preco"]["cheio"], 600.0)

    def test_countdown_desligado_vem_null(self):
        destaque = self._turma_destaque(exibir_countdown=False)
        self.assertIsNone(destaque["countdown"])


class PainelCursosViewSetTests(TestCase):
    """CursoPainelViewSet não declara `authentication_classes` — só o
    DEFAULT_AUTHENTICATION_CLASSES global (JWTAuthentication) vale aqui;
    `force_login` (sessão) não autentica. Ver `jwt_headers` em
    apps/nucleo/testing.py."""

    def setUp(self):
        self.gestor = criar_gestor()

    def test_ciclo_criar_editar_listar(self):
        headers = jwt_headers(self.gestor)
        resposta = self.client.post(
            reverse("painel-cursos-list"),
            data={
                "slug": "painel-teste",
                "nome": "Curso Painel",
                "titulo_venda": "Curso Painel",
                "subtitulo": "Subtítulo de teste",
                "carga_horaria": 80,
            },
            content_type="application/json",
            headers=headers,
        )
        self.assertEqual(resposta.status_code, 201)
        corpo = resposta.json()
        self.assertEqual(corpo["conteudo_origem"], "template")

        edicao = self.client.patch(
            reverse("painel-cursos-detail", args=["painel-teste"]),
            data={"nome": "Curso Painel Editado"},
            content_type="application/json",
            headers=headers,
        )
        self.assertEqual(edicao.status_code, 200)
        self.assertEqual(edicao.json()["conteudo_origem"], "editado")

        listagem = self.client.get(reverse("painel-cursos-list"), headers=headers)
        self.assertEqual(listagem.status_code, 200)
        self.assertEqual(len(listagem.json()), 1)

    def test_instrutor_tambem_acessa(self):
        resposta = self.client.get(
            reverse("painel-cursos-list"), headers=jwt_headers(criar_instrutor())
        )
        self.assertEqual(resposta.status_code, 200)

    def test_anonimo_403(self):
        resposta = self.client.get(reverse("painel-cursos-list"))
        self.assertIn(resposta.status_code, (401, 403))


class PainelTurmasViewSetTests(TestCase):
    def setUp(self):
        self.gestor = criar_gestor()
        self.curso, _turma = criar_curso_turma(slug="turmas-painel-teste")

    def test_ciclo_criar_editar_listar(self):
        headers = jwt_headers(self.gestor)
        resposta = self.client.post(
            reverse("painel-turmas-list"),
            data={"curso": self.curso.slug, "codigo": "T099"},
            content_type="application/json",
            headers=headers,
        )
        self.assertEqual(resposta.status_code, 201)
        turma_id = resposta.json()["id"]
        self.assertEqual(resposta.json()["conteudo_origem"], "template")

        edicao = self.client.patch(
            reverse("painel-turmas-detail", args=[turma_id]),
            data={"status": Turma.Status.INSCRICOES},
            content_type="application/json",
            headers=headers,
        )
        self.assertEqual(edicao.status_code, 200)
        self.assertEqual(edicao.json()["conteudo_origem"], "editado")

        listagem = self.client.get(
            reverse("painel-turmas-list"), {"curso": self.curso.slug}, headers=headers
        )
        self.assertEqual(listagem.status_code, 200)
        self.assertEqual(len(listagem.json()), 2)  # a do helper + a criada agora

    def test_anonimo_403(self):
        resposta = self.client.get(reverse("painel-turmas-list"))
        self.assertIn(resposta.status_code, (401, 403))


class PainelHabilidadesFaqsAninhadasTests(TestCase):
    def setUp(self):
        self.gestor = criar_gestor()
        self.curso, _turma = criar_curso_turma(slug="aninhadas-teste")
        self.headers = jwt_headers(self.gestor)

    def test_habilidades_ciclo_criar_editar_listar(self):
        url_lista = reverse(
            "painel-habilidades-lista", kwargs={"curso_slug": self.curso.slug}
        )
        criacao = self.client.post(
            url_lista,
            data={"titulo": "RCP", "descricao": "Ressuscitação cardiopulmonar"},
            content_type="application/json",
            headers=self.headers,
        )
        self.assertEqual(criacao.status_code, 201)
        self.assertEqual(criacao.json()["conteudo_origem"], "template")
        habilidade_id = criacao.json()["id"]

        edicao = self.client.patch(
            reverse(
                "painel-habilidades-detalhe",
                kwargs={"curso_slug": self.curso.slug, "pk": habilidade_id},
            ),
            data={"titulo": "RCP avançado"},
            content_type="application/json",
            headers=self.headers,
        )
        self.assertEqual(edicao.status_code, 200)
        self.assertEqual(edicao.json()["conteudo_origem"], "editado")

        listagem = self.client.get(url_lista, headers=self.headers)
        self.assertEqual(len(listagem.json()), 1)
        self.assertEqual(Habilidade.objects.get(pk=habilidade_id).curso, self.curso)

    def test_faqs_ciclo_criar_editar_listar(self):
        url_lista = reverse("painel-faqs-lista", kwargs={"curso_slug": self.curso.slug})
        criacao = self.client.post(
            url_lista,
            data={"pergunta": "Tem estágio?", "resposta": "Sim, prático."},
            content_type="application/json",
            headers=self.headers,
        )
        self.assertEqual(criacao.status_code, 201)
        faq_id = criacao.json()["id"]

        edicao = self.client.patch(
            reverse(
                "painel-faqs-detalhe", kwargs={"curso_slug": self.curso.slug, "pk": faq_id}
            ),
            data={"resposta": "Sim, prático e supervisionado."},
            content_type="application/json",
            headers=self.headers,
        )
        self.assertEqual(edicao.status_code, 200)
        self.assertEqual(edicao.json()["conteudo_origem"], "editado")

        listagem = self.client.get(url_lista, headers=self.headers)
        self.assertEqual(len(listagem.json()), 1)
        self.assertEqual(PerguntaFrequente.objects.get(pk=faq_id).curso, self.curso)

    def test_anonimo_403(self):
        url_lista = reverse(
            "painel-habilidades-lista", kwargs={"curso_slug": self.curso.slug}
        )
        resposta = self.client.get(url_lista)
        self.assertIn(resposta.status_code, (401, 403))


class TurmaAnotacoesActionTests(TestCase):
    """@action aninhada TurmaPainelViewSet.anotacoes (GET/POST) — memória
    interna de turma, nunca vai pro site. Zero teste até aqui."""

    def setUp(self):
        self.gestor = criar_gestor(username="anotacoes-gestor")
        self.curso, self.turma = criar_curso_turma(slug="anotacoes-teste")
        self.headers = jwt_headers(self.gestor)

    def test_cria_e_lista_anotacoes(self):
        from apps.cursos.models import AnotacaoTurma

        url = reverse("painel-turmas-anotacoes", args=[self.turma.id])
        criacao = self.client.post(
            url,
            data={"texto": "Aluno faltou 2 aulas seguidas."},
            content_type="application/json",
            headers=self.headers,
        )
        self.assertEqual(criacao.status_code, 201)
        self.assertEqual(criacao.json()["texto"], "Aluno faltou 2 aulas seguidas.")
        self.assertEqual(criacao.json()["autor"], self.gestor.username)

        listagem = self.client.get(url, headers=self.headers)
        self.assertEqual(listagem.status_code, 200)
        self.assertEqual(len(listagem.json()), 1)
        self.assertEqual(AnotacaoTurma.objects.get().autor, self.gestor)

    def test_anonimo_403(self):
        url = reverse("painel-turmas-anotacoes", args=[self.turma.id])
        resposta = self.client.get(url)
        self.assertIn(resposta.status_code, (401, 403))


class TurmaAdminAcoesCarteirinhaTests(TestCase):
    """Ação do Django Admin em TurmaAdmin (apps/cursos/admin.py) — mostra o
    link estável de cadastro de aluno novo (spec 014: token_cadastro da
    Turma, sem criar Matrícula)."""

    def setUp(self):
        self.superusuario = criar_gestor(
            username="super-turma-admin", is_staff=True, is_superuser=True
        )
        self.client.force_login(self.superusuario)
        self.curso, self.turma = criar_curso_turma(slug="admin-acoes-teste")

    def test_mostrar_link_cadastro_nao_cria_matricula(self):
        from apps.educacional.models import Matricula

        url = "/dj-admin/cursos/turma/"
        resposta = self.client.post(
            url,
            data={
                "action": "mostrar_link_cadastro",
                "_selected_action": [str(self.turma.id)],
            },
            follow=True,
        )
        self.assertEqual(resposta.status_code, 200)
        # a ação só exibe o link — não cria/altera Matrícula.
        self.assertEqual(Matricula.objects.filter(turma=self.turma).count(), 0)
        # e o link mostrado carrega o token_cadastro estável da turma.
        self.assertContains(resposta, str(self.turma.token_cadastro))


class VagasRestantesPropertyTests(TestCase):
    """`Turma.vagas_restantes`/`lotada` (spec 014) — deixou de ser campo
    digitado à mão e virou cálculo: capacidade − matrículas ativas ou
    concluídas, nunca negativo."""

    def setUp(self):
        from apps.educacional.models import Aluno, Matricula

        self.Aluno = Aluno
        self.Matricula = Matricula
        self.curso, self.turma = criar_curso_turma(
            slug="vagas-teste", capacidade=2
        )

    def _matricular(self, nome, cpf, status):
        aluno = self.Aluno.objects.create(nome=nome, cpf=cpf)
        return self.Matricula.objects.create(
            aluno=aluno, turma=self.turma, status=status
        )

    def test_sem_capacidade_devolve_none(self):
        _curso, turma_sem_capacidade = criar_curso_turma(slug="vagas-sem-capacidade")
        self.assertIsNone(turma_sem_capacidade.vagas_restantes)
        self.assertFalse(turma_sem_capacidade.lotada)

    def test_sem_matricula_vagas_igual_capacidade(self):
        self.assertEqual(self.turma.vagas_restantes, 2)
        self.assertFalse(self.turma.lotada)

    def test_desconta_so_ativa_e_concluida(self):
        self._matricular("Ativa", "11111111111", self.Matricula.Status.ATIVA)
        self._matricular("Convidado", "22222222222", self.Matricula.Status.CONVIDADO)
        self._matricular("Cancelada", "33333333333", self.Matricula.Status.CANCELADA)
        # só a ATIVA conta — convidado/cancelada não ocupam vaga.
        self.assertEqual(self.turma.vagas_restantes, 1)

    def test_concluida_tambem_conta(self):
        self._matricular("Ativa", "11111111111", self.Matricula.Status.ATIVA)
        self._matricular("Concluida", "22222222222", self.Matricula.Status.CONCLUIDA)
        self.assertEqual(self.turma.vagas_restantes, 0)
        self.assertTrue(self.turma.lotada)

    def test_nunca_fica_negativo(self):
        # capacidade=2, mas 3 matrículas ativas (ex.: capacidade reduzida
        # depois de já ter gente matriculada) — vagas_restantes não vira -1.
        for i in range(3):
            self._matricular(f"Aluno {i}", f"{i}1111111111", self.Matricula.Status.ATIVA)
        self.assertEqual(self.turma.vagas_restantes, 0)
        self.assertTrue(self.turma.lotada)
