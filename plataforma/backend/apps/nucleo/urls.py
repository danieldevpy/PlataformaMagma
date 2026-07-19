from django.urls import path

from apps.nucleo.views import (
    CatalogoAcoesView,
    ConfigPainelView,
    ExecutarAcaoView,
    SiteConfigPublicaView,
)

urlpatterns = [
    path("site/config/", SiteConfigPublicaView.as_view(), name="site-config"),
    path("painel/config/", ConfigPainelView.as_view(), name="painel-config"),
    path("acoes/", CatalogoAcoesView.as_view(), name="acoes-catalogo"),
    path("acoes/executar/", ExecutarAcaoView.as_view(), name="acoes-executar"),
]
