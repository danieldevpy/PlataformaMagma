from django.urls import path

from apps.educacional.views import MatriculaConvitePublicoView

urlpatterns = [
    path(
        "carteirinha/convite/<uuid:token>/",
        MatriculaConvitePublicoView.as_view(),
        name="carteirinha-convite",
    ),
]
