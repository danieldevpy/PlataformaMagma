"""Testes de apps.conversas (spec 021) — registro das conversas do agente
MAG: janela de sessão, desfecho derivado das ferramentas, exportação pra
análise e purga respeitando a retenção configurada."""

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.contas.models import Usuario
from apps.conversas.models import JANELA_SESSAO_HORAS, Conversa, Turno
from apps.leads.models import Lead
from apps.nucleo.models import ConfiguracaoSite, TokenAgente


def criar_token_agente(nome="agente-conversas", escopos=None):
    token_bruto, token_hash = TokenAgente.gerar_par()
    agente = TokenAgente.objects.create(
        nome=nome, token_hash=token_hash, escopos=escopos or []
    )
    return agente, token_bruto


class BaseConversasTests(TestCase):
    def setUp(self):
        self.url_executar = reverse("acoes-executar")
        self.gestor = Usuario.objects.create_user(
            username="gestora-conversas",
            password="senha-teste-123",
            papel=Usuario.Papel.GESTOR,
        )

    def executar(self, acao, params=None, esperado=200):
        self.client.force_login(self.gestor)
        resposta = self.client.post(
            self.url_executar,
            data={"acao": acao, "params": params or {}},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, esperado, resposta.content)
        if esperado != 200:
            return resposta.json()
        return resposta.json()["resultado"]

    def registrar(self, **params):
        params.setdefault("numero", "5521999990000")
        params.setdefault("texto_contato", "oi")
        params.setdefault("texto_agente", "olá!")
        return self.executar("registrar_turnos", params)


class RegistrarTurnosTests(BaseConversasTests):
    def test_grava_os_dois_lados_da_troca(self):
        resultado = self.registrar(
            texto_contato="quanto custa o APH?",
            texto_agente="o investimento é combinado na secretaria",
            agente="sdr",
            papel="lead",
            nome="Fernando",
        )

        self.assertTrue(resultado["conversa_nova"])
        self.assertEqual(resultado["turnos_gravados"], 2)

        conversa = Conversa.objects.get(pk=resultado["conversa_id"])
        self.assertEqual(conversa.nome_contato, "Fernando")
        self.assertEqual(conversa.agente, "sdr")
        self.assertEqual(
            [t.papel for t in conversa.turnos.all()],
            [Turno.Papel.CONTATO, Turno.Papel.AGENTE],
        )

    def test_exige_numero(self):
        corpo = self.executar("registrar_turnos", {"texto_agente": "oi"}, esperado=400)
        self.assertIn("numero", corpo["detail"])

    def test_exige_ao_menos_um_texto(self):
        corpo = self.executar(
            "registrar_turnos", {"numero": "5521999990000"}, esperado=400
        )
        self.assertIn("texto", corpo["detail"])

    def test_mensagem_seguinte_entra_na_mesma_conversa(self):
        primeira = self.registrar(texto_contato="oi")
        segunda = self.registrar(texto_contato="ainda estou aqui")

        self.assertEqual(primeira["conversa_id"], segunda["conversa_id"])
        self.assertFalse(segunda["conversa_nova"])
        self.assertEqual(Conversa.objects.count(), 1)
        self.assertEqual(Turno.objects.count(), 4)

    def test_depois_da_janela_de_silencio_abre_conversa_nova(self):
        primeira = self.registrar(texto_contato="oi")
        Conversa.objects.filter(pk=primeira["conversa_id"]).update(
            ultima_atividade_em=timezone.now()
            - timedelta(hours=JANELA_SESSAO_HORAS, minutes=1)
        )

        segunda = self.registrar(texto_contato="voltei")

        self.assertNotEqual(primeira["conversa_id"], segunda["conversa_id"])
        self.assertTrue(segunda["conversa_nova"])
        self.assertEqual(Conversa.objects.count(), 2)

    def test_numeros_diferentes_nao_se_misturam(self):
        um = self.registrar(numero="5521111111111")
        outro = self.registrar(numero="5521222222222")

        self.assertNotEqual(um["conversa_id"], outro["conversa_id"])

    def test_toque_proativo_grava_so_o_lado_do_agente_como_sistema(self):
        resultado = self.registrar(
            texto_contato="",
            texto_agente="Oi! Passando pra lembrar do curso :)",
            agente="nutridora",
            proativo=True,
        )

        self.assertEqual(resultado["turnos_gravados"], 1)
        turno = Turno.objects.get()
        self.assertEqual(turno.papel, Turno.Papel.SISTEMA)
        self.assertEqual(turno.agente, "nutridora")

    def test_vincula_lead_pelo_numero(self):
        lead = Lead.objects.create(nome="Fernando", whatsapp="5521999990000")

        resultado = self.registrar(papel="lead")

        conversa = Conversa.objects.get(pk=resultado["conversa_id"])
        self.assertEqual(conversa.lead_id, lead.id)
        self.assertIsNone(conversa.usuario_id)

    def test_vincula_usuario_quando_papel_e_gestor(self):
        self.gestor.whatsapp = "5521999990000"
        self.gestor.save()

        resultado = self.registrar(papel="gestor", agente="operadora")

        conversa = Conversa.objects.get(pk=resultado["conversa_id"])
        self.assertEqual(conversa.usuario_id, self.gestor.id)
        self.assertIsNone(conversa.lead_id)

    def test_nome_descoberto_depois_nao_apaga_o_que_ja_sabia(self):
        primeira = self.registrar(nome="Fernando")
        self.registrar(nome="")

        conversa = Conversa.objects.get(pk=primeira["conversa_id"])
        self.assertEqual(conversa.nome_contato, "Fernando")

    def test_ferramentas_em_formatos_diferentes_nao_quebram(self):
        resultado = self.registrar(
            ferramentas=["listar_cursos", {"nome": "detalhes_curso", "params": {"slug": "aph"}}]
        )

        turno = Turno.objects.get(papel=Turno.Papel.AGENTE)
        self.assertEqual(
            [f["nome"] for f in turno.ferramentas],
            ["listar_cursos", "detalhes_curso"],
        )
        self.assertEqual(resultado["desfecho"], "")

    def test_ferramentas_em_formato_inesperado_nao_estoura(self):
        self.registrar(ferramentas="isso não é uma lista")

        turno = Turno.objects.get(papel=Turno.Papel.AGENTE)
        self.assertEqual(turno.ferramentas, [])


class DesfechoDerivadoTests(BaseConversasTests):
    def test_registrar_lead_marca_desfecho(self):
        resultado = self.registrar(ferramentas=[{"nome": "registrar_lead"}])
        self.assertEqual(resultado["desfecho"], Conversa.Desfecho.LEAD)

    def test_escalar_contato_marca_handoff_e_escalada(self):
        resultado = self.registrar(ferramentas=[{"nome": "escalar_contato"}])

        conversa = Conversa.objects.get(pk=resultado["conversa_id"])
        self.assertEqual(conversa.desfecho, Conversa.Desfecho.HANDOFF)
        self.assertTrue(conversa.escalada)

    def test_desfecho_avanca_no_funil_mas_nao_retrocede(self):
        self.registrar(ferramentas=[{"nome": "registrar_lead"}])
        self.registrar(ferramentas=[{"nome": "gerar_cobranca"}])
        # Troca banal depois da cobrança não pode "rebaixar" a conversa.
        resultado = self.registrar(ferramentas=[{"nome": "listar_cursos"}])

        self.assertEqual(resultado["desfecho"], Conversa.Desfecho.COBRANCA)

    def test_ferramenta_de_leitura_nao_gera_desfecho(self):
        resultado = self.registrar(ferramentas=[{"nome": "info_institucional"}])
        self.assertEqual(resultado["desfecho"], "")


class ExportarConversasTests(BaseConversasTests):
    def test_transcricao_traz_o_dialogo_na_ordem(self):
        self.registrar(
            texto_contato="quanto custa?",
            texto_agente="a secretaria passa o valor",
            agente="sdr",
            nome="Fernando",
        )

        resultado = self.executar("exportar_conversas", {"dias": 7})

        self.assertEqual(resultado["total"], 1)
        transcricao = resultado["conversas"][0]["transcricao"]
        self.assertIn("Fernando: quanto custa?", transcricao)
        self.assertIn("MAG (sdr): a secretaria passa o valor", transcricao)
        self.assertLess(
            transcricao.index("quanto custa?"), transcricao.index("secretaria passa")
        )

    def test_transcricao_lista_as_ferramentas_usadas(self):
        self.registrar(ferramentas=[{"nome": "registrar_lead"}])

        resultado = self.executar("exportar_conversas")

        self.assertIn("ferramentas: registrar_lead", resultado["conversas"][0]["transcricao"])

    def test_filtra_por_periodo(self):
        antiga = self.registrar(numero="5521111111111")
        Conversa.objects.filter(pk=antiga["conversa_id"]).update(
            ultima_atividade_em=timezone.now() - timedelta(days=30)
        )
        self.registrar(numero="5521222222222")

        resultado = self.executar("exportar_conversas", {"dias": 7})

        self.assertEqual(resultado["total"], 1)
        self.assertEqual(resultado["conversas"][0]["numero"], "5521222222222")

    def test_filtra_por_agente_e_desfecho(self):
        self.registrar(numero="5521111111111", agente="sdr", ferramentas=[{"nome": "registrar_lead"}])
        self.registrar(numero="5521222222222", agente="operadora")

        so_sdr = self.executar("exportar_conversas", {"agente": "sdr"})
        self.assertEqual(so_sdr["total"], 1)

        so_lead = self.executar("exportar_conversas", {"desfecho": "lead_registrado"})
        self.assertEqual(so_lead["total"], 1)
        self.assertEqual(so_lead["conversas"][0]["numero"], "5521111111111")

    def test_limite_tem_teto_e_total_continua_real(self):
        for i in range(3):
            self.registrar(numero=f"552100000000{i}")

        resultado = self.executar("exportar_conversas", {"limite": 2})

        self.assertEqual(resultado["total"], 3)
        self.assertEqual(resultado["devolvidas"], 2)

    def test_dias_invalido_da_400(self):
        self.executar("exportar_conversas", {"dias": 0}, esperado=400)


class PurgarConversasTests(BaseConversasTests):
    def _envelhecer(self, conversa_id, dias):
        Conversa.objects.filter(pk=conversa_id).update(
            ultima_atividade_em=timezone.now() - timedelta(days=dias)
        )

    def test_apaga_o_que_passou_da_retencao_e_preserva_o_resto(self):
        config = ConfiguracaoSite.obter()
        config.conversas_retencao_dias = 15
        config.save()

        velha = self.registrar(numero="5521111111111")
        self._envelhecer(velha["conversa_id"], 20)
        nova = self.registrar(numero="5521222222222")

        resultado = self.executar("purgar_conversas")

        self.assertEqual(resultado["apagadas"], 1)
        self.assertEqual(resultado["retencao_dias"], 15)
        self.assertFalse(Conversa.objects.filter(pk=velha["conversa_id"]).exists())
        self.assertTrue(Conversa.objects.filter(pk=nova["conversa_id"]).exists())

    def test_apaga_os_turnos_junto(self):
        config = ConfiguracaoSite.obter()
        config.conversas_retencao_dias = 15
        config.save()

        velha = self.registrar(numero="5521111111111")
        self._envelhecer(velha["conversa_id"], 20)

        self.executar("purgar_conversas")

        self.assertEqual(Turno.objects.count(), 0)

    def test_retencao_zero_nunca_apaga(self):
        config = ConfiguracaoSite.obter()
        config.conversas_retencao_dias = 0
        config.save()

        velha = self.registrar(numero="5521111111111")
        self._envelhecer(velha["conversa_id"], 999)

        resultado = self.executar("purgar_conversas")

        self.assertTrue(resultado["purga_desativada"])
        self.assertEqual(resultado["apagadas"], 0)
        self.assertTrue(Conversa.objects.filter(pk=velha["conversa_id"]).exists())

    def test_retencao_maior_configurada_preserva_conversa_antiga(self):
        config = ConfiguracaoSite.obter()
        config.conversas_retencao_dias = 90
        config.save()

        velha = self.registrar(numero="5521111111111")
        self._envelhecer(velha["conversa_id"], 30)

        resultado = self.executar("purgar_conversas")

        self.assertEqual(resultado["apagadas"], 0)
        self.assertTrue(Conversa.objects.filter(pk=velha["conversa_id"]).exists())


class EscoposConversasTests(BaseConversasTests):
    """As 3 ações são de agente (n8n) — cada uma exige o seu escopo."""

    def _post_com_token(self, token_bruto, acao, params=None):
        return self.client.post(
            self.url_executar,
            data={"acao": acao, "params": params or {}},
            content_type="application/json",
            headers={"X-Agente-Token": token_bruto},
        )

    def test_token_com_escopo_certo_registra(self):
        _, token = criar_token_agente(escopos=["conversas:registrar_turnos"])

        resposta = self._post_com_token(
            token,
            "registrar_turnos",
            {"numero": "5521999990000", "texto_agente": "oi"},
        )

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(Conversa.objects.count(), 1)

    def test_token_sem_escopo_nega_com_403(self):
        _, token = criar_token_agente(escopos=["conversas:registrar_turnos"])

        resposta = self._post_com_token(token, "exportar_conversas")

        self.assertEqual(resposta.status_code, 403)

    def test_curinga_do_app_libera_as_tres(self):
        _, token = criar_token_agente(escopos=["conversas:*"])

        for acao in ("registrar_turnos", "exportar_conversas", "purgar_conversas"):
            params = (
                {"numero": "5521999990000", "texto_agente": "oi"}
                if acao == "registrar_turnos"
                else {}
            )
            resposta = self._post_com_token(token, acao, params)
            self.assertEqual(resposta.status_code, 200, acao)
