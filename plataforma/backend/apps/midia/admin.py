from django.contrib import admin

from apps.midia.models import MidiaTurma, Postagem


@admin.register(MidiaTurma)
class MidiaTurmaAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "turma",
        "tipo",
        "origem",
        "legenda",
        "tags",
        "ordem",
        "postagem",
        "criado_em",
    )
    list_filter = ("tipo", "origem", "turma__curso")
    search_fields = ("legenda", "turma__codigo")
    autocomplete_fields = ("turma", "postagem")


@admin.register(Postagem)
class PostagemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "titulo",
        "turma",
        "canal",
        "modo",
        "status",
        "publicada_em",
        "criado_em",
    )
    list_filter = ("status", "modo", "canal", "turma__curso")
    search_fields = ("titulo", "turma__codigo")
    autocomplete_fields = ("turma",)
