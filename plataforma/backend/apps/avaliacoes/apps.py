from django.apps import AppConfig


class AvaliacoesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.avaliacoes"
    label = "avaliacoes"
    verbose_name = "Avaliações"

    def ready(self):
        from apps.avaliacoes import acoes  # noqa: F401 — registra em apps.nucleo.acoes
