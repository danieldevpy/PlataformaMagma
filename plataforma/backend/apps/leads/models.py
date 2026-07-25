from django.db import models

from apps.nucleo.models import ComTimestamps


class Lead(ComTimestamps):
    class ToqueNutridora(models.TextChoices):
        T1 = "t1", "T+1"
        T3 = "t3", "T+3"
        T7 = "t7", "T+7"

    # `blank=True` desde a spec 025: o handoff garante o lead mesmo quando
    # a conversa escalou antes de a MAG perguntar o nome. Lead magro ainda
    # é um número pra ligar — perder quem ia comprar não tem conserto.
    nome = models.CharField(max_length=120, blank=True)
    whatsapp = models.CharField(max_length=20, blank=True)
    curso = models.ForeignKey(
        "cursos.Curso", null=True, blank=True, on_delete=models.SET_NULL
    )
    quando_pretende = models.CharField(max_length=60, blank=True)
    utm_source = models.CharField(max_length=60, blank=True)
    utm_campaign = models.CharField(max_length=60, blank=True)
    pagina_origem = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, default="novo")
    # Último toque automático da Nutridora já mandado (ver
    # apps/leads/acoes.py::processar_nutridora e
    # specs/020-agente-whatsapp-nutridora-t1-t3-t7). Em branco = só
    # recebeu o T+0 (evento na criação, não rastreado aqui).
    nutridora_ultimo_toque = models.CharField(
        max_length=2, choices=ToqueNutridora.choices, blank=True
    )

    class Meta:
        verbose_name = "Lead"
        verbose_name_plural = "Leads"

    def __str__(self):
        return self.nome
