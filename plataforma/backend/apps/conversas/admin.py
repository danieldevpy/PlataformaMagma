"""Admin de leitura das conversas do agente (spec 021).

Registro de conversa não se edita: é prova do que aconteceu. Por isso
tudo aqui é somente leitura — o Admin serve pra procurar um contato e
reler o diálogo, não pra corrigir o passado.
"""

from django.contrib import admin

from apps.conversas.models import Conversa, Turno


class TurnoInline(admin.TabularInline):
    model = Turno
    extra = 0
    can_delete = False
    fields = ("criado_em", "papel", "agente", "texto", "ferramentas")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Conversa)
class ConversaAdmin(admin.ModelAdmin):
    list_display = (
        "numero",
        "nome_contato",
        "papel",
        "agente",
        "desfecho",
        "escalada",
        "criado_em",
        "ultima_atividade_em",
    )
    list_filter = ("agente", "desfecho", "escalada", "papel", "canal")
    search_fields = ("numero", "nome_contato")
    date_hierarchy = "criado_em"
    inlines = [TurnoInline]
    readonly_fields = (
        "canal",
        "numero",
        "nome_contato",
        "papel",
        "agente",
        "lead",
        "usuario",
        "escalada",
        "desfecho",
        "criado_em",
        "ultima_atividade_em",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
