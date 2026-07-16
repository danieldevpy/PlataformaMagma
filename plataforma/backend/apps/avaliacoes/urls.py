from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.avaliacoes.views import (
    AvaliacaoPainelViewSet,
    ConviteAvaliacaoPublicoView,
    CriarConvitePainelView,
)

router = SimpleRouter()
router.register("painel/avaliacoes", AvaliacaoPainelViewSet, basename="painel-avaliacoes")

urlpatterns = [
    path(
        "avaliacoes/convite/<uuid:token>/",
        ConviteAvaliacaoPublicoView.as_view(),
        name="avaliacoes-convite",
    ),
    path("painel/convites/", CriarConvitePainelView.as_view(), name="painel-convites"),
] + router.urls
