from django.urls import path

from apps.educacional.views import CadastroTurmaView, CarteirinhaAlunoView

urlpatterns = [
    # Cadastro de aluno novo — resolve a turma pelo token_cadastro (link
    # estável, compartilhável). Segmento literal "nova/" vem antes da rota
    # do card pra não colidir com o <uuid:token> dela.
    path(
        "carteirinha/nova/<uuid:token>/",
        CadastroTurmaView.as_view(),
        name="carteirinha-cadastro",
    ),
    # Card digital — resolve o aluno pelo Aluno.token.
    path(
        "carteirinha/<uuid:token>/",
        CarteirinhaAlunoView.as_view(),
        name="carteirinha-aluno",
    ),
]
