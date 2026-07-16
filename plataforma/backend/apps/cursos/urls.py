from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.cursos.views import (
    CursoDetalhePublicoView,
    CursoListaPublicaView,
    CursoPainelViewSet,
    HabilidadePainelViewSet,
    PerguntaFrequentePainelViewSet,
    TurmaPainelViewSet,
)

router = SimpleRouter()
router.register("painel/cursos", CursoPainelViewSet, basename="painel-cursos")
router.register("painel/turmas", TurmaPainelViewSet, basename="painel-turmas")

habilidades_lista = HabilidadePainelViewSet.as_view({"get": "list", "post": "create"})
habilidades_detalhe = HabilidadePainelViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
faqs_lista = PerguntaFrequentePainelViewSet.as_view({"get": "list", "post": "create"})
faqs_detalhe = PerguntaFrequentePainelViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)

urlpatterns = [
    path("cursos/", CursoListaPublicaView.as_view(), name="cursos-lista"),
    path("cursos/<slug:slug>/", CursoDetalhePublicoView.as_view(), name="cursos-detalhe"),
    path(
        "painel/cursos/<slug:curso_slug>/habilidades/",
        habilidades_lista,
        name="painel-habilidades-lista",
    ),
    path(
        "painel/cursos/<slug:curso_slug>/habilidades/<int:pk>/",
        habilidades_detalhe,
        name="painel-habilidades-detalhe",
    ),
    path(
        "painel/cursos/<slug:curso_slug>/faqs/",
        faqs_lista,
        name="painel-faqs-lista",
    ),
    path(
        "painel/cursos/<slug:curso_slug>/faqs/<int:pk>/",
        faqs_detalhe,
        name="painel-faqs-detalhe",
    ),
] + router.urls
