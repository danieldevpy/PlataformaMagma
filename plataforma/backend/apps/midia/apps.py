from django.apps import AppConfig


class MidiaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.midia"
    label = "midia"
    verbose_name = "Mídia"

    def ready(self):
        from apps.midia import acoes  # noqa: F401 — registra em apps.nucleo.acoes
