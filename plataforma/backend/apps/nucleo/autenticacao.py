from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from apps.nucleo.models import TokenAgente


class AutenticacaoAgente(BaseAuthentication):
    """Lê o header `X-Agente-Token` e autentica um `TokenAgente` (ver
    apps/nucleo/models.py::TokenAgente). Sem o header, devolve `None` (deixa
    outro authenticator — sessão/JWT — tentar); com o header presente mas
    inválido/inativo, recusa explicitamente (não deixa cair pro humano)."""

    def authenticate(self, request):
        token_bruto = request.headers.get("X-Agente-Token")
        if not token_bruto:
            return None

        agente = TokenAgente.autenticar(token_bruto)
        if agente is None:
            raise AuthenticationFailed("Token de agente inválido, inativo ou inexistente.")

        agente.ultimo_uso_em = timezone.now()
        agente.save(update_fields=["ultimo_uso_em", "atualizado_em"])
        # request.user vira AnonymousUser (não é um Usuario humano) e
        # request.auth carrega a instância de TokenAgente — é nela que a
        # permission de ação (PermissaoAcao) confere o escopo.
        return (AnonymousUser(), agente)

    def authenticate_header(self, request):
        # Presente pra fazer o DRF responder 401 (não 403) quando falta
        # qualquer autenticação — mesmo comportamento do JWTAuthentication.
        return "X-Agente-Token"
