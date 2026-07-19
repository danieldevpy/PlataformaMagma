from django.urls import path

from apps.ia.views import (
    CapacidadesView,
    ExecutarView,
    ProvedorDetailView,
    ProvedoresView,
    TestarProvedorView,
    UsoMensalView,
)

urlpatterns = [
    path("ia/capacidades/", CapacidadesView.as_view(), name="ia-capacidades"),
    path("ia/executar/", ExecutarView.as_view(), name="ia-executar"),
    path("ia/provedores/", ProvedoresView.as_view(), name="ia-provedores"),
    path(
        "ia/provedores/<int:pk>/",
        ProvedorDetailView.as_view(),
        name="ia-provedor-detail",
    ),
    path(
        "ia/provedores/<int:pk>/testar/",
        TestarProvedorView.as_view(),
        name="ia-provedor-testar",
    ),
    path("ia/uso/", UsoMensalView.as_view(), name="ia-uso"),
]
