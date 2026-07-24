from django import forms
from django.contrib import admin

from apps.financeiro.models import Cobranca, ConfiguracaoAsaas, EventoWebhookAsaas
from apps.financeiro.services import ErroFinanceiro, criar_cobranca_para_matricula


class ConfiguracaoAsaasForm(forms.ModelForm):
    """Os campos reais (`api_key`, `webhook_token`) guardam texto cifrado —
    o form troca por campos write-only: em branco não mexe no valor já
    salvo, preenchido substitui (cifrado) no save. Mesmo padrão de
    `apps/ia/admin.py::ProvedorIAForm`."""

    api_key_nova = forms.CharField(
        label="Chave de API",
        required=False,
        widget=forms.PasswordInput(render_value=False, attrs={"autocomplete": "new-password"}),
        help_text="Deixe em branco para manter a chave já salva.",
    )
    webhook_token_novo = forms.CharField(
        label="Token de webhook",
        required=False,
        widget=forms.PasswordInput(render_value=False, attrs={"autocomplete": "new-password"}),
        help_text="O mesmo token configurado no painel do Asaas em Webhooks. Deixe em branco para manter o já salvo.",
    )

    class Meta:
        model = ConfiguracaoAsaas
        fields = ["ambiente", "api_key_nova", "webhook_token_novo", "ativo"]

    def save(self, commit=True):
        instancia = super().save(commit=False)
        valor_api_key = self.cleaned_data.get("api_key_nova")
        if valor_api_key:
            instancia.set_credencial(valor_api_key)
        valor_webhook = self.cleaned_data.get("webhook_token_novo")
        if valor_webhook:
            instancia.set_webhook_token(valor_webhook)
        if commit:
            instancia.save()
        return instancia


@admin.register(ConfiguracaoAsaas)
class ConfiguracaoAsaasAdmin(admin.ModelAdmin):
    form = ConfiguracaoAsaasForm
    list_display = ("ambiente", "ativo", "criado_em")
    readonly_fields = ("criado_em", "atualizado_em")


class CobrancaAdminForm(forms.ModelForm):
    """Criação pelo Admin é fallback (o caminho principal é a ação
    `gerar_cobranca` do agente MAG, via WhatsApp — ver plan.md); passa pelo
    mesmo `services.criar_cobranca_para_matricula` que a ação usa, então os
    campos que vêm do Asaas nunca são digitados aqui."""

    class Meta:
        model = Cobranca
        fields = ["matricula", "valor", "forma_pagamento", "vencimento"]
        widgets = {"vencimento": forms.DateInput(attrs={"type": "date"})}

    def clean(self):
        dados = super().clean()
        if self.errors or self.instance.pk:
            return dados
        try:
            self.cobranca_criada = criar_cobranca_para_matricula(
                dados["matricula"],
                dados["valor"],
                dados["forma_pagamento"],
                vencimento=dados.get("vencimento"),
            )
        except ErroFinanceiro as erro:
            raise forms.ValidationError(str(erro))
        return dados

    def save(self, commit=True):
        return getattr(self, "cobranca_criada", None) or super().save(commit=commit)

    def save_m2m(self):
        pass  # Cobranca não tem m2m; o ModelAdmin sempre chama isto no fluxo de save.


@admin.register(Cobranca)
class CobrancaAdmin(admin.ModelAdmin):
    list_display = ("matricula", "valor", "forma_pagamento", "status", "vencimento", "criado_em")
    list_filter = ("status", "forma_pagamento", "ambiente")
    search_fields = ("matricula__aluno__nome", "asaas_id")
    autocomplete_fields = ["matricula"]

    def get_form(self, request, obj=None, **kwargs):
        if obj is None:
            kwargs["form"] = CobrancaAdminForm
        return super().get_form(request, obj, **kwargs)

    def get_fields(self, request, obj=None):
        if obj is None:
            return ["matricula", "valor", "forma_pagamento", "vencimento"]
        return [campo.name for campo in Cobranca._meta.fields]

    def get_readonly_fields(self, request, obj=None):
        if obj is None:
            return []
        return [campo.name for campo in Cobranca._meta.fields]

    def save_model(self, request, obj, form, change):
        if not change:
            obj.criado_por = request.user
        obj.save()

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(EventoWebhookAsaas)
class EventoWebhookAsaasAdmin(admin.ModelAdmin):
    """Auditoria pura — nunca editável nem criável pelo admin, só
    consultável (mesmo padrão de `apps/ia/admin.py::ExecucaoIAAdmin`)."""

    list_display = ("criado_em", "evento", "status_processamento", "cobranca")
    list_filter = ("status_processamento", "evento")
    search_fields = ("evento", "cobranca__matricula__aluno__nome")
    readonly_fields = [campo.name for campo in EventoWebhookAsaas._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
