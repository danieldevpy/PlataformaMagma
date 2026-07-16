from urllib.parse import quote

from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.contas.permissions import IsGestor
from apps.leads.models import Lead
from apps.leads.serializers import LeadPainelSerializer, LeadPublicoSerializer
from apps.nucleo.api import MarcarEditadoMixin, PaginacaoPainel
from apps.nucleo.models import ConfiguracaoSite


def montar_whatsapp_url(lead):
    config = ConfiguracaoSite.obter()
    if lead.curso:
        mensagem = (
            f"Olá! Tenho interesse no curso {lead.curso.nome}. "
            "Pode me passar mais informações sobre turmas e valores?"
        )
    else:
        mensagem = (
            "Olá! Vim pelo site da Magma e quero mais informações sobre os cursos."
        )
    return f"https://wa.me/{config.whatsapp_principal}?text={quote(mensagem, safe='')}"


class CriarLeadPublicoView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LeadPublicoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lead = serializer.save()
        return Response(
            {"ok": True, "whatsapp_url": montar_whatsapp_url(lead)},
            status=status.HTTP_201_CREATED,
        )


class LeadPainelViewSet(MarcarEditadoMixin, viewsets.ModelViewSet):
    permission_classes = [IsGestor]
    serializer_class = LeadPainelSerializer
    pagination_class = PaginacaoPainel
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        queryset = Lead.objects.select_related("curso").order_by("-criado_em")
        status_filtro = self.request.query_params.get("status")
        if status_filtro:
            queryset = queryset.filter(status=status_filtro)
        return queryset
