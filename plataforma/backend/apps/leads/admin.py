from django import forms
from django.contrib import admin

from apps.leads.models import Lead


class LeadForm(forms.ModelForm):
    class Meta:
        model = Lead
        fields = [
            "nome",
            "whatsapp",
            "curso",
            "quando_pretende",
            "utm_source",
            "utm_campaign",
            "pagina_origem",
            "status",
        ]
        widgets = {
            "nome": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "Nome completo",
                    "required": True,
                }
            ),
            "whatsapp": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "(11) 99999-9999",
                    "maxlength": "20",
                }
            ),
            "curso": forms.Select(attrs={"class": "form-select"}),
            "quando_pretende": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "Ex: Próximo mês",
                }
            ),
            "utm_source": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "google, facebook, etc",
                }
            ),
            "utm_campaign": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "Nome da campanha",
                }
            ),
            "pagina_origem": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "URL de origem",
                }
            ),
            "status": forms.Select(attrs={"class": "form-select"}),
        }


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    form = LeadForm
    list_display = (
        "nome",
        "whatsapp",
        "curso",
        "quando_pretende",
        "status",
        "utm_source",
        "utm_campaign",
        "criado_em",
    )
    list_filter = ("status", "curso", "utm_source")
    search_fields = ("nome", "whatsapp")
    date_hierarchy = "criado_em"
    fieldsets = (
        (
            "Informações Pessoais",
            {
                "fields": ("nome", "whatsapp"),
                "classes": ("lead-personal",),
            },
        ),
        (
            "Interesse no Curso",
            {
                "fields": ("curso", "quando_pretende"),
                "classes": ("lead-course",),
            },
        ),
        (
            "Rastreamento de Origem",
            {
                "fields": ("utm_source", "utm_campaign", "pagina_origem"),
                "classes": ("lead-tracking",),
                "description": "Dados de rastreamento da campanha de origem",
            },
        ),
        (
            "Status",
            {
                "fields": ("status",),
                "classes": ("lead-status",),
            },
        ),
    )
    readonly_fields = ("criado_em",) if "change" in str(LeadForm) else ()
