from django import forms
from django.contrib import admin
from django.middleware.csrf import get_token
from django.shortcuts import render
from django.urls import path

from apps.ia.models import ExecucaoIA, ProvedorIA


class ProvedorIAForm(forms.ModelForm):
    """O campo real `credencial` guarda texto cifrado (ilegível) — o form
    troca ele por um campo write-only: em branco não mexe na chave já
    salva, preenchido substitui (cifrada) no save. Nunca mostra a chave em
    texto puro de volta pra tela (write-only mesmo)."""

    credencial_nova = forms.CharField(
        label="Chave de API",
        required=False,
        widget=forms.PasswordInput(render_value=False, attrs={"autocomplete": "new-password"}),
        help_text="Deixe em branco para manter a chave já salva.",
    )

    class Meta:
        model = ProvedorIA
        fields = ["tipo", "provedor", "modelo", "credencial_nova", "config", "ativo"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk and self.instance.credencial:
            self.fields["credencial_nova"].widget.attrs["placeholder"] = "•••• (chave já salva)"

    def save(self, commit=True):
        instancia = super().save(commit=False)
        valor_novo = self.cleaned_data.get("credencial_nova")
        if valor_novo:
            instancia.set_credencial(valor_novo)
        if commit:
            instancia.save()
        return instancia


@admin.register(ProvedorIA)
class ProvedorIAAdmin(admin.ModelAdmin):
    form = ProvedorIAForm
    list_display = ("tipo", "provedor", "modelo", "ativo", "testado_em", "criado_em")
    list_filter = ("tipo", "provedor", "ativo")
    readonly_fields = ("testado_em", "criado_em", "atualizado_em")

    def get_urls(self):
        # Página staff "Integrações de IA" (doc 10 §5.3) — mesmo padrão de
        # auth das páginas staff do `midia` (Mesa de Luz/Studio, ver
        # apps/cursos/admin.py::TurmaAdmin.get_urls): view Django comum
        # protegida por `admin_site.admin_view` (exige is_staff), dentro do
        # namespace do admin — nginx de prod só roteia /(api|dj-admin)/ pro
        # Django. As chamadas de dados da página em si são via /api/ia/
        # (sessão + `IsGestorOuInstrutor`, mesmo padrão do resto do app).
        urls_customizadas = [
            path(
                "integracoes/",
                self.admin_site.admin_view(self.integracoes_view),
                name="ia_provedoria_integracoes",
            ),
        ]
        return urls_customizadas + super().get_urls()

    def integracoes_view(self, request):
        contexto = {
            **self.admin_site.each_context(request),
            "api_base": "/api/ia",
            "csrf_token": get_token(request),
        }
        return render(request, "ia/integracoes.html", contexto)


@admin.register(ExecucaoIA)
class ExecucaoIAAdmin(admin.ModelAdmin):
    """Auditoria pura — nunca editável nem criável pelo admin, só
    consultável (ver plan.md "ExecucaoIA readonly")."""

    list_display = (
        "criado_em",
        "capacidade",
        "provedor",
        "status",
        "tokens_entrada",
        "tokens_saida",
        "duracao_ms",
        "usuario",
    )
    list_filter = ("status", "capacidade", "provedor__tipo")
    search_fields = ("capacidade", "contexto_resumo", "erro", "agente")
    readonly_fields = [campo.name for campo in ExecucaoIA._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
