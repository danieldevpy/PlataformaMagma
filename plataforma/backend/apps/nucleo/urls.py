from django.urls import path

from apps.nucleo.views import ConfigPainelView, SiteConfigPublicaView

urlpatterns = [
    path("site/config/", SiteConfigPublicaView.as_view(), name="site-config"),
    path("painel/config/", ConfigPainelView.as_view(), name="painel-config"),
]
