from rest_framework.permissions import BasePermission

from apps.contas.models import Usuario
from apps.nucleo.acoes import obter_acao
from apps.nucleo.models import TokenAgente


def _humano_gestor_ou_instrutor(request):
    usuario = request.user
    return bool(
        usuario
        and usuario.is_authenticated
        and usuario.papel in (Usuario.Papel.GESTOR, Usuario.Papel.INSTRUTOR)
    )


class PermissaoCatalogo(BasePermission):
    """`GET /api/acoes/` — humano (gestor/instrutor) ou qualquer agente
    autenticado (o catálogo é a documentação viva; um agente precisa ler
    tudo pra saber o que existe, mesmo que não tenha escopo pra executar
    cada ação — o filtro por escopo acontece na execução)."""

    def has_permission(self, request, view):
        if _humano_gestor_ou_instrutor(request):
            return True
        return isinstance(request.auth, TokenAgente)


class PermissaoAcao(BasePermission):
    """`POST /api/acoes/executar/` — humano (gestor/instrutor) sempre pode;
    agente só se o token tiver escopo pra ação pedida em `{"acao": ...}`
    (403 fora do escopo, ver `TokenAgente.autoriza`)."""

    def has_permission(self, request, view):
        if _humano_gestor_ou_instrutor(request):
            return True

        agente = request.auth
        if not isinstance(agente, TokenAgente):
            return False

        nome_acao = request.data.get("acao") if hasattr(request, "data") else None
        entrada = obter_acao(nome_acao) if nome_acao else None
        escopo = entrada["escopo"] if entrada else None
        return agente.autoriza(escopo)
