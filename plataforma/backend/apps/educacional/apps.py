from django.apps import AppConfig


class EducacionalConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.educacional"
    label = "educacional"
    verbose_name = "Educacional"

    def ready(self):
        from apps.educacional import acoes  # noqa: F401 — registra em apps.nucleo.acoes
