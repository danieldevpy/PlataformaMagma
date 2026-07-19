"""Testes de auth transversal (spec 001, T7): `POST /api/token/` (par JWT)
e o contrato real de autenticação do painel — ver
specs/001-suite-de-testes/plan.md §T7 e apps/nucleo/testing.py::jwt_headers
pra o porquê da distinção JWT-only × Session+JWT entre grupos de views."""

from django.test import TestCase
from django.urls import reverse

from apps.nucleo.testing import criar_gestor, jwt_headers


class TokenObtainPairViewTests(TestCase):
    def test_credenciais_corretas_devolvem_par_jwt(self):
        criar_gestor(username="dona-do-token")
        resposta = self.client.post(
            reverse("token_obtain_pair"),
            data={"username": "dona-do-token", "password": "senha-teste-123"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertIn("access", corpo)
        self.assertIn("refresh", corpo)

    def test_credenciais_erradas_401(self):
        criar_gestor(username="dona-do-token-2")
        resposta = self.client.post(
            reverse("token_obtain_pair"),
            data={"username": "dona-do-token-2", "password": "senha-errada"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 401)


class AutenticacaoPainelVsMidiaTests(TestCase):
    """Contrato real (não o que a doc geral sugere): views de painel que NÃO
    declaram `authentication_classes` próprias usam só o
    DEFAULT_AUTHENTICATION_CLASSES global (JWTAuthentication) — sessão não
    basta. `midia`/`ia` são a exceção: declaram
    `[SessionAuthentication, JWTAuthentication]` explicitamente e aceitam
    os dois. Ver divergência registrada em
    specs/001-suite-de-testes/tasks.md §Log (2026-07-19)."""

    def test_jwt_autentica_endpoint_de_painel_sem_auth_propria(self):
        gestor = criar_gestor(username="jwt-painel")
        resposta = self.client.get(
            reverse("painel-cursos-list"), headers=jwt_headers(gestor)
        )
        self.assertEqual(resposta.status_code, 200)

    def test_sessao_sozinha_nao_autentica_endpoint_de_painel_sem_auth_propria(self):
        gestor = criar_gestor(username="sessao-painel")
        self.client.force_login(gestor)
        resposta = self.client.get(reverse("painel-cursos-list"))
        self.assertIn(resposta.status_code, (401, 403))

    def test_sessao_autentica_endpoint_midia_que_declara_session_e_jwt(self):
        gestor = criar_gestor(username="sessao-midia")
        self.client.force_login(gestor)
        resposta = self.client.get(reverse("midia-acoes"))
        self.assertEqual(resposta.status_code, 200)

    def test_sem_credencial_401_ou_403(self):
        resposta = self.client.get(reverse("painel-cursos-list"))
        self.assertIn(resposta.status_code, (401, 403))
