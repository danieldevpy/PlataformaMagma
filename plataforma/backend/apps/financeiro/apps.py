from django.apps import AppConfig


class FinanceiroConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.financeiro"
    label = "financeiro"
    verbose_name = "Financeiro"

    def ready(self):
        from apps.financeiro import acoes  # noqa: F401 — registra em apps.nucleo.acoes
