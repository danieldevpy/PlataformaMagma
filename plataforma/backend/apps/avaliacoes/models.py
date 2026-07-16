import uuid
from datetime import timedelta

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.nucleo.models import ComTimestamps, ConteudoRastreavel


def expiracao_padrao():
    return timezone.now() + timedelta(days=30)


class ConviteAvaliacao(ComTimestamps):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    curso = models.ForeignKey("cursos.Curso", on_delete=models.CASCADE)
    turma = models.ForeignKey(
        "cursos.Turma", null=True, blank=True, on_delete=models.SET_NULL
    )
    nome_aluno = models.CharField(max_length=120, blank=True)
    enviado_por = models.ForeignKey(
        "contas.Usuario", null=True, blank=True, on_delete=models.SET_NULL
    )
    expira_em = models.DateTimeField(default=expiracao_padrao)
    usado_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Convite de avaliação"
        verbose_name_plural = "Convites de avaliação"

    def __str__(self):
        return f"Convite {self.token} — {self.curso}"

    @property
    def url(self):
        return f"{settings.FRONTEND_URL}/avaliar/{self.token}"


class Avaliacao(ConteudoRastreavel, ComTimestamps):
    class Status(models.TextChoices):
        PENDENTE = "pendente", "Pendente"
        APROVADA = "aprovada", "Aprovada"
        REJEITADA = "rejeitada", "Rejeitada"

    convite = models.OneToOneField(
        ConviteAvaliacao, null=True, blank=True, on_delete=models.SET_NULL
    )
    curso = models.ForeignKey(
        "cursos.Curso", related_name="avaliacoes", on_delete=models.CASCADE
    )
    turma = models.ForeignKey(
        "cursos.Turma", null=True, blank=True, on_delete=models.SET_NULL
    )
    nome = models.CharField(max_length=120)
    cargo_atual = models.CharField(max_length=120, blank=True)
    estrelas = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comentario = models.TextField(max_length=600)
    foto = models.ImageField(upload_to="avaliacoes/", blank=True)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDENTE
    )
    peso = models.PositiveSmallIntegerField(default=0)
    exibir_na_home = models.BooleanField(default=False)

    class Meta:
        ordering = ["-peso", "-estrelas", "-criado_em"]
        verbose_name = "Avaliação"
        verbose_name_plural = "Avaliações"

    def __str__(self):
        return f"{self.nome} — {self.estrelas}★ ({self.curso})"
