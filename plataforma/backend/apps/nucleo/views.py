from rest_framework.authentication import SessionAuthentication
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.contas.permissions import IsGestor
from apps.nucleo.acoes import ErroAcao, catalogo_completo, obter_acao
from apps.nucleo.api import MarcarEditadoMixin
from apps.nucleo.autenticacao import AutenticacaoAgente
from apps.nucleo.models import ConfiguracaoSite, LogAcao, TokenAgente
from apps.nucleo.permissions import PermissaoAcao, PermissaoCatalogo
from apps.nucleo.serializers import (
    ConfiguracaoSitePainelSerializer,
    ConfiguracaoSitePublicaSerializer,
)


class SiteConfigPublicaView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        config = ConfiguracaoSite.obter()
        return Response(ConfiguracaoSitePublicaSerializer(config).data)


class ConfigPainelView(MarcarEditadoMixin, RetrieveUpdateAPIView):
    permission_classes = [IsGestor]
    serializer_class = ConfiguracaoSitePainelSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return ConfiguracaoSite.obter()


class AcoesAPIView(APIView):
    """Base comum das views da camada de ações — sessão/JWT (humano) OU
    `X-Agente-Token` (agente), ver apps/nucleo/acoes.py."""

    authentication_classes = [SessionAuthentication, JWTAuthentication, AutenticacaoAgente]


class CatalogoAcoesView(AcoesAPIView):
    """GET acoes/ — lista todas as ações registradas (registry do nucleo +
    catálogo descritivo do midia), a "documentação viva" que um agente lê
    pra saber o que a plataforma sabe fazer."""

    permission_classes = [PermissaoCatalogo]

    def get(self, request):
        return Response(catalogo_completo())


class ExecutarAcaoView(AcoesAPIView):
    """POST acoes/executar/ {acao, params} — executa uma ação registrada;
    grava LogAcao sempre (sucesso e erro), agente ou humano."""

    permission_classes = [PermissaoAcao]

    def post(self, request):
        nome_acao = request.data.get("acao")
        params = request.data.get("params") or {}
        agente = request.auth if isinstance(request.auth, TokenAgente) else None
        usuario = (
            request.user
            if request.user and request.user.is_authenticated
            else None
        )

        entrada = obter_acao(nome_acao)
        if entrada is None:
            LogAcao.objects.create(
                acao=nome_acao or "",
                params=params,
                status=LogAcao.Status.ERRO,
                erro="Ação não encontrada.",
                usuario=usuario,
                agente=agente,
            )
            return Response({"detail": "Ação não encontrada."}, status=404)

        try:
            resultado = entrada["fn"](params, request)
        except ErroAcao as erro:
            LogAcao.objects.create(
                acao=nome_acao,
                params=params,
                status=LogAcao.Status.ERRO,
                erro=str(erro),
                usuario=usuario,
                agente=agente,
            )
            return Response({"detail": str(erro)}, status=400)
        except Exception as erro:  # noqa: BLE001 — qualquer falha inesperada vira log + 500 genérico
            LogAcao.objects.create(
                acao=nome_acao,
                params=params,
                status=LogAcao.Status.ERRO,
                erro=str(erro),
                usuario=usuario,
                agente=agente,
            )
            return Response({"detail": "Erro ao executar a ação."}, status=500)

        LogAcao.objects.create(
            acao=nome_acao,
            params=params,
            resultado_resumo=str(resultado)[:255],
            status=LogAcao.Status.OK,
            usuario=usuario,
            agente=agente,
        )
        return Response({"resultado": resultado})
