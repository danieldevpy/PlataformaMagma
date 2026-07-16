from django.contrib import admin

from apps.educacional.models import Aluno, Matricula


@admin.register(Matricula)
class MatriculaAdmin(admin.ModelAdmin):
    list_display = (
        "token",
        "escopo",
        "turma",
        "aluno",
        "status",
        "codigo_carteirinha",
        "preenchida_em",
        "expira_em",
        "criado_em",
    )
    list_filter = ("escopo", "status", "turma__curso")
    search_fields = ("token", "aluno__nome", "codigo_carteirinha")
    autocomplete_fields = ("turma", "aluno")
    readonly_fields = (
        "token",
        "url",
        "codigo_carteirinha",
        "validade_carteirinha",
        "preenchida_em",
    )
    fields = (
        "turma",
        "escopo",
        "status",
        "aluno",
        "enviado_por",
        "expira_em",
        "validade_carteirinha_meses",
        "valor_fechado",
        "forma_pagamento",
        "token",
        "url",
        "codigo_carteirinha",
        "validade_carteirinha",
        "preenchida_em",
    )

    def save_model(self, request, obj, form, change):
        if not change and not obj.enviado_por_id:
            obj.enviado_por = request.user
        super().save_model(request, obj, form, change)


@admin.register(Aluno)
class AlunoAdmin(admin.ModelAdmin):
    list_display = ("nome", "cpf", "whatsapp", "email", "criado_em")
    search_fields = ("nome", "cpf", "whatsapp", "email")
