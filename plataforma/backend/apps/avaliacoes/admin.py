from django.contrib import admin

from apps.avaliacoes.models import Avaliacao, ConviteAvaliacao


@admin.register(ConviteAvaliacao)
class ConviteAvaliacaoAdmin(admin.ModelAdmin):
    list_display = (
        "token",
        "curso",
        "turma",
        "nome_aluno",
        "enviado_por",
        "expira_em",
        "usado_em",
        "criado_em",
    )
    list_filter = ("curso",)
    search_fields = ("nome_aluno", "token")
    readonly_fields = ("token", "url")


@admin.register(Avaliacao)
class AvaliacaoAdmin(admin.ModelAdmin):
    list_display = (
        "nome",
        "curso",
        "turma",
        "estrelas",
        "status",
        "peso",
        "exibir_na_home",
        "conteudo_origem",
        "criado_em",
    )
    list_filter = ("status", "curso", "exibir_na_home", "estrelas", "conteudo_origem")
    search_fields = ("nome", "cargo_atual", "comentario")
