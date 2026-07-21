from django.apps import AppConfig


class LeadsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.leads"
    label = "leads"
    verbose_name = "Leads"

    def ready(self):
        from apps.leads import acoes  # noqa: F401 — registra em apps.nucleo.acoes
        from apps.leads import signals  # noqa: F401
