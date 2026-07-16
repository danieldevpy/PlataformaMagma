from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.contas.permissions import IsGestorOuInstrutor
from apps.cursos.models import Curso, Habilidade, PerguntaFrequente, Turma
from apps.cursos.serializers import (
    AnotacaoTurmaPainelSerializer,
    CursoDetalhePublicoSerializer,
    CursoListaPublicaSerializer,
    CursoPainelSerializer,
    HabilidadePainelSerializer,
    PerguntaFrequentePainelSerializer,
    TurmaPainelSerializer,
)
from apps.nucleo.api import MarcarEditadoMixin


class CursoListaPublicaView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = CursoListaPublicaSerializer
    queryset = (
        Curso.objects.filter(status=Curso.Status.PUBLICADO)
        .prefetch_related("turmas")
        .order_by("nome")
    )


class CursoDetalhePublicoView(RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = CursoDetalhePublicoSerializer
    lookup_field = "slug"
    queryset = Curso.objects.filter(status=Curso.Status.PUBLICADO).prefetch_related(
        "habilidades", "faqs", "instrutores", "turmas", "avaliacoes__turma"
    )

    def get_object(self):
        try:
            return super().get_object()
        except Http404:
            raise NotFound("Curso não encontrado.")


class CursoPainelViewSet(MarcarEditadoMixin, viewsets.ModelViewSet):
    permission_classes = [IsGestorOuInstrutor]
    serializer_class = CursoPainelSerializer
    queryset = Curso.objects.all().order_by("nome")
    lookup_field = "slug"
    http_method_names = ["get", "post", "patch", "head", "options"]


class HabilidadePainelViewSet(MarcarEditadoMixin, viewsets.ModelViewSet):
    permission_classes = [IsGestorOuInstrutor]
    serializer_class = HabilidadePainelSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Habilidade.objects.filter(curso__slug=self.kwargs["curso_slug"])

    def perform_create(self, serializer):
        curso = get_object_or_404(Curso, slug=self.kwargs["curso_slug"])
        serializer.save(curso=curso)


class PerguntaFrequentePainelViewSet(MarcarEditadoMixin, viewsets.ModelViewSet):
    permission_classes = [IsGestorOuInstrutor]
    serializer_class = PerguntaFrequentePainelSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return PerguntaFrequente.objects.filter(curso__slug=self.kwargs["curso_slug"])

    def perform_create(self, serializer):
        curso = get_object_or_404(Curso, slug=self.kwargs["curso_slug"])
        serializer.save(curso=curso)


class TurmaPainelViewSet(MarcarEditadoMixin, viewsets.ModelViewSet):
    permission_classes = [IsGestorOuInstrutor]
    serializer_class = TurmaPainelSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = Turma.objects.select_related("curso").order_by("-criado_em")
        curso_slug = self.request.query_params.get("curso")
        if curso_slug:
            queryset = queryset.filter(curso__slug=curso_slug)
        return queryset

    @action(detail=True, methods=["get", "post"])
    def anotacoes(self, request, pk=None):
        turma = self.get_object()
        if request.method == "POST":
            serializer = AnotacaoTurmaPainelSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(turma=turma, autor=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        serializer = AnotacaoTurmaPainelSerializer(
            turma.anotacoes.order_by("-criado_em"), many=True
        )
        return Response(serializer.data)
