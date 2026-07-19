from django.contrib import admin, messages

from apps.nucleo.models import ConfiguracaoSite, LogAcao, TokenAgente


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


@admin.register(TokenAgente)
class TokenAgenteAdmin(admin.ModelAdmin):
    """Criar aqui gera o token bruto (secrets.token_urlsafe) e mostra ele
    UMA vez só, na mensagem de sucesso — o banco só guarda o hash sha256
    (`token_hash`), então depois desse instante não tem como recuperar o
    valor original: se perder, revoga (ativo=False) e cria outro."""

    list_display = ("nome", "escopos", "ativo", "ultimo_uso_em", "criado_em")
    list_filter = ("ativo",)
    search_fields = ("nome",)
    readonly_fields = ("ultimo_uso_em", "criado_em", "atualizado_em")
    fields = ("nome", "escopos", "ativo", "ultimo_uso_em", "criado_em", "atualizado_em")

    def save_model(self, request, obj, form, change):
        if change:
            super().save_model(request, obj, form, change)
            return

        token_bruto, token_hash = TokenAgente.gerar_par()
        obj.token_hash = token_hash
        super().save_model(request, obj, form, change)
        self.message_user(
            request,
            f"Token gerado pra \"{obj.nome}\" — copie AGORA, não será "
            f"mostrado de novo: {token_bruto}",
            level=messages.WARNING,
        )


@admin.register(LogAcao)
class LogAcaoAdmin(admin.ModelAdmin):
    """Só leitura — trilha de auditoria de `/api/acoes/executar/` (ver
    apps/nucleo/views.py::ExecutarAcaoView)."""

    list_display = ("acao", "status", "usuario", "agente", "criado_em")
    list_filter = ("status", "acao", "agente")
    search_fields = ("acao", "erro")
    readonly_fields = (
        "acao",
        "params",
        "resultado_resumo",
        "status",
        "erro",
        "usuario",
        "agente",
        "criado_em",
        "atualizado_em",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
