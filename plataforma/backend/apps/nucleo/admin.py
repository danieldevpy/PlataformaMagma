from django.contrib import admin

from apps.nucleo.models import ConfiguracaoSite


@admin.register(ConfiguracaoSite)
class ConfiguracaoSiteAdmin(admin.ModelAdmin):
    list_display = (
        "whatsapp_principal",
        "instagram",
        "email",
        "nota_google",
        "exibir_nota_google",
        "total_alunos_formados",
        "exibir_total_formados",
        "conteudo_origem",
        "atualizado_em",
    )
    list_filter = ("conteudo_origem", "exibir_nota_google", "exibir_total_formados")

    def has_add_permission(self, request):
        return not ConfiguracaoSite.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
