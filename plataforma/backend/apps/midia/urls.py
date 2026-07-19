from django.urls import path

from apps.midia.views import (
    AcervoGeralView,
    AcervoTurmaView,
    AcoesCatalogoView,
    AvaliacoesTurmaView,
    CamadasView,
    ConsentimentoView,
    EnviarAcervoView,
    EnviarMidiaView,
    ItemMidiaView,
    PostagemDetailView,
    PostagemZipView,
    PostagensTurmaView,
    PostagensView,
    ReordenarView,
)

urlpatterns = [
    path("midia/acoes/", AcoesCatalogoView.as_view(), name="midia-acoes"),
    # ---- acervo em camadas (spec 008) — rotas gerais ----
    path("midia/acervo/", AcervoGeralView.as_view(), name="midia-acervo-geral"),
    path("midia/acervo/camadas/", CamadasView.as_view(), name="midia-camadas"),
    path(
        "midia/acervo/enviar/",
        EnviarAcervoView.as_view(),
        name="midia-acervo-enviar",
    ),
    path("midia/postagens/", PostagensView.as_view(), name="midia-postagens-geral"),
    # ---- rotas por turma (contrato do subsistema 09, intocado) ----
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
        "midia/turmas/<int:turma_id>/avaliacoes/",
        AvaliacoesTurmaView.as_view(),
        name="midia-avaliacoes",
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
