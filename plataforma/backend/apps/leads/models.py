from django.db import models

from apps.nucleo.models import ComTimestamps


class Lead(ComTimestamps):
    nome = models.CharField(max_length=120)
    whatsapp = models.CharField(max_length=20, blank=True)
    curso = models.ForeignKey(
        "cursos.Curso", null=True, blank=True, on_delete=models.SET_NULL
    )
    quando_pretende = models.CharField(max_length=60, blank=True)
    utm_source = models.CharField(max_length=60, blank=True)
    utm_campaign = models.CharField(max_length=60, blank=True)
    pagina_origem = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, default="novo")

    class Meta:
        verbose_name = "Lead"
        verbose_name_plural = "Leads"

    def __str__(self):
        return self.nome
