from django.urls import path

from apps.midia.views import (
    AcervoTurmaView,
    AcoesCatalogoView,
    ConsentimentoView,
    EnviarMidiaView,
    ItemMidiaView,
    PostagemDetailView,
    PostagemZipView,
    PostagensTurmaView,
    ReordenarView,
)

urlpatterns = [
    path("midia/acoes/", AcoesCatalogoView.as_view(), name="midia-acoes"),
    path(
        "midia/turmas/<int:turma_id>/acervo/",
        AcervoTurmaView.as_view(),
        name="midia-acervo",
    ),
    path(
        "midia/turmas/<int:turma_id>/enviar/",
        EnviarMidiaView.as_view(),
        name="midia-enviar",
    ),
    path(
        "midia/turmas/<int:turma_id>/reordenar/",
        ReordenarView.as_view(),
        name="midia-reordenar",
    ),
    path(
        "midia/turmas/<int:turma_id>/consentimento/",
        ConsentimentoView.as_view(),
        name="midia-consentimento",
    ),
    path(
        "midia/turmas/<int:turma_id>/postagens/",
        PostagensTurmaView.as_view(),
        name="midia-postagens",
    ),
    path("midia/itens/<int:pk>/", ItemMidiaView.as_view(), name="midia-item"),
    path(
        "midia/postagens/<int:pk>/",
        PostagemDetailView.as_view(),
        name="midia-postagem-detail",
    ),
    path(
        "midia/postagens/<int:pk>/zip/",
        PostagemZipView.as_view(),
        name="midia-postagem-zip",
    ),
]
