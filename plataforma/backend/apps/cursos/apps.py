from django.apps import AppConfig


class CursosConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.cursos"
    label = "cursos"
    verbose_name = "Cursos"

    def ready(self):
        from apps.cursos import acoes  # noqa: F401 — registra em apps.nucleo.acoes
