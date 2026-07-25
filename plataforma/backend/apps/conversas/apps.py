from django.apps import AppConfig


class ConversasConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.conversas"
    label = "conversas"
    verbose_name = "Conversas"

    def ready(self):
        from apps.conversas import acoes  # noqa: F401 — registra em apps.nucleo.acoes
