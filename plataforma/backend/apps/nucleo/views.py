from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.contas.permissions import IsGestor
from apps.nucleo.api import MarcarEditadoMixin
from apps.nucleo.models import ConfiguracaoSite
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
