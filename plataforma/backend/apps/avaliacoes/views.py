from urllib.parse import quote

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.avaliacoes.models import Avaliacao, ConviteAvaliacao
from apps.avaliacoes.serializers import (
    AvaliacaoConvitePublicoSerializer,
    AvaliacaoPainelSerializer,
    ConviteAvaliacaoPublicoSerializer,
    CriarConvitePainelSerializer,
)
from apps.contas.permissions import IsGestor
from apps.nucleo.api import MarcarEditadoMixin, PaginacaoPainel
from apps.nucleo.models import ConteudoRastreavel


def motivo_invalidez(convite):
    if convite is None:
        return "inexistente"
    # Link de turma é compartilhado e reutilizável — só expira, nunca "usado"
    # (usado_em fica sempre None nesse escopo, ver ConviteAvaliacao.usado_em).
    if convite.escopo == ConviteAvaliacao.Escopo.INDIVIDUAL and convite.usado_em is not None:
        return "usado"
    if convite.expira_em < timezone.now():
        return "expirado"
    return None


class ConviteAvaliacaoPublicoView(APIView):
    permission_classes = [AllowAny]

    def _buscar(self, token):
        return (
            ConviteAvaliacao.objects.select_related("curso", "turma")
            .prefetch_related("turma__fotos")
            .filter(token=token)
            .first()
        )

    def get(self, request, token):
        convite = self._buscar(token)
        motivo = motivo_invalidez(convite)
        if motivo:
            return Response({"valido": False, "motivo": motivo})
        dados = ConviteAvaliacaoPublicoSerializer(
            convite, context={"request": request}
        ).data
        return Response({"valido": True, **dados})

    def post(self, request, token):
        convite = self._buscar(token)
        motivo = motivo_invalidez(convite)
        if motivo:
            mensagens = {
                "inexistente": "Convite de avaliação não encontrado.",
                "usado": "Este convite já foi utilizado.",
                "expirado": "Este convite expirou.",
            }
            return Response(
                {"detail": mensagens[motivo]}, status=status.HTTP_400_BAD_REQUEST
            )
        serializer = AvaliacaoConvitePublicoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            convite=convite,
            curso=convite.curso,
            turma=convite.turma,
            status=Avaliacao.Status.PENDENTE,
            conteudo_origem=ConteudoRastreavel.Origem.EDITADO,
        )
        if convite.escopo == ConviteAvaliacao.Escopo.INDIVIDUAL:
            convite.usado_em = timezone.now()
            convite.save(update_fields=["usado_em", "atualizado_em"])
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


class AvaliacaoPainelViewSet(MarcarEditadoMixin, viewsets.ModelViewSet):
    permission_classes = [IsGestor]
    serializer_class = AvaliacaoPainelSerializer
    pagination_class = PaginacaoPainel
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        queryset = Avaliacao.objects.select_related("curso", "turma")
        status_filtro = self.request.query_params.get("status")
        if status_filtro:
            queryset = queryset.filter(status=status_filtro)
        return queryset


class CriarConvitePainelView(APIView):
    permission_classes = [IsGestor]

    def post(self, request):
        serializer = CriarConvitePainelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        convite = serializer.save(enviado_por=request.user)
        nome = convite.nome_aluno.strip()
        saudacao = f"Oi, {nome}!" if nome else "Oi!"
        mensagem = (
            f"{saudacao} Aqui é do Curso Magma. Pode avaliar sua experiência "
            f"no curso {convite.curso.nome}? Leva 1 minuto: {convite.url}"
        )
        return Response(
            {
                "url": convite.url,
                "whatsapp_share": f"https://wa.me/?text={quote(mensagem, safe='')}",
            },
            status=status.HTTP_201_CREATED,
        )
