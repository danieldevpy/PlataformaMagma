from django.apps import AppConfig


class NucleoConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.nucleo"
    label = "nucleo"
    verbose_name = "Núcleo"

    def ready(self):
        from apps.nucleo import acoes_contato  # noqa: F401 — registra em apps.nucleo.acoes
