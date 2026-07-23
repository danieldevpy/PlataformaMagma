from django.contrib import admin

from apps.educacional.models import Aluno, Matricula


@admin.register(Matricula)
class MatriculaAdmin(admin.ModelAdmin):
    """Matrícula pura (spec 014) — Aluno numa Turma + status + pagamento.
    Carteirinha/convite saíram daqui (viraram Aluno/Turma.token_cadastro)."""

    list_display = (
        "aluno",
        "turma",
        "status",
        "valor_fechado",
        "forma_pagamento",
        "criado_em",
    )
    list_filter = ("status", "turma__curso")
    search_fields = ("aluno__nome", "aluno__cpf", "turma__codigo")
    autocomplete_fields = ("turma", "aluno")
    fields = (
        "turma",
        "aluno",
        "status",
        "enviado_por",
        "valor_fechado",
        "forma_pagamento",
    )

    def save_model(self, request, obj, form, change):
        if not change and not obj.enviado_por_id:
            obj.enviado_por = request.user
        super().save_model(request, obj, form, change)


@admin.register(Aluno)
class AlunoAdmin(admin.ModelAdmin):
    """Identidade durável do aluno (spec 014) — dono da carteirinha."""

    list_display = (
        "nome",
        "cpf",
        "codigo_carteirinha",
        "validade_carteirinha",
        "whatsapp",
        "email",
        "criado_em",
    )
    search_fields = ("nome", "cpf", "whatsapp", "email", "codigo_carteirinha", "token")
    readonly_fields = ("token", "url", "codigo_carteirinha", "validade_carteirinha")
    fields = (
        "nome",
        "cpf",
        "data_nascimento",
        "foto",
        "whatsapp",
        "email",
        "endereco",
        "origem_lead",
        "validade_carteirinha_meses",
        "token",
        "url",
        "codigo_carteirinha",
        "validade_carteirinha",
    )
