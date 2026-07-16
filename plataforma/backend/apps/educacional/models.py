import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.nucleo.models import ComTimestamps


class Aluno(ComTimestamps):
    nome = models.CharField(max_length=120)
    cpf = models.CharField(max_length=14, blank=True)
    data_nascimento = models.DateField(null=True, blank=True)
    foto = models.ImageField(upload_to="alunos/", blank=True, null=True)
    whatsapp = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    endereco = models.CharField(max_length=200, blank=True)
    origem_lead = models.ForeignKey(
        "leads.Lead",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="alunos",
    )

    class Meta:
        verbose_name = "Aluno"
        verbose_name_plural = "Alunos"

    def __str__(self):
        return self.nome or f"Aluno #{self.pk}"


def matricula_expiracao_padrao():
    # prazo para o aluno preencher a carteirinha — depois de preenchida,
    # o link deixa de expirar (vira a carteirinha definitiva dele).
    return timezone.now() + timedelta(days=90)


class Matricula(ComTimestamps):
    """Reserva de vaga numa Turma + convite (magic link) de carteirinha
    digital. O gestor cria a Matrícula (pelo Django Admin, escolhendo a
    Turma) antes de o aluno existir; `aluno` só é preenchido quando ele
    acessa o link e completa a carteirinha.

    `escopo` decide como o link se comporta: TURMA é um link único
    compartilhado com a turma toda — cada aluno que preenche gera sua
    própria Matrícula/Aluno/carteirinha nova (esta linha nunca é
    preenchida, fica reutilizável até expirar). INDIVIDUAL é o
    comportamento de sempre: esta própria linha é preenchida uma vez."""

    class Status(models.TextChoices):
        CONVIDADO = "convidado", "Convidado (aguardando preenchimento)"
        ATIVA = "ativa", "Ativa"
        CONCLUIDA = "concluida", "Concluída"
        CANCELADA = "cancelada", "Cancelada"

    class Escopo(models.TextChoices):
        TURMA = "turma", "Turma toda (link compartilhado)"
        INDIVIDUAL = "individual", "Pessoa específica"

    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    escopo = models.CharField(
        max_length=10, choices=Escopo.choices, default=Escopo.TURMA
    )
    turma = models.ForeignKey(
        "cursos.Turma", on_delete=models.CASCADE, related_name="matriculas"
    )
    aluno = models.ForeignKey(
        Aluno,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="matriculas",
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.CONVIDADO
    )

    # carteirinha — gerados automaticamente na criação (ver save()), para
    # já aparecerem na tela do aluno antes mesmo de ele preencher algo.
    codigo_carteirinha = models.CharField(
        max_length=30, unique=True, editable=False, blank=True
    )
    validade_carteirinha_meses = models.PositiveSmallIntegerField(default=24)
    validade_carteirinha = models.DateField(null=True, blank=True, editable=False)

    valor_fechado = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    forma_pagamento = models.CharField(max_length=30, blank=True)

    enviado_por = models.ForeignKey(
        "contas.Usuario", null=True, blank=True, on_delete=models.SET_NULL
    )
    expira_em = models.DateTimeField(default=matricula_expiracao_padrao)
    preenchida_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Matrícula"
        verbose_name_plural = "Matrículas"

    def __str__(self):
        quem = self.aluno.nome if self.aluno else "(convite pendente)"
        return f"{quem} — {self.turma}"

    def save(self, *args, **kwargs):
        criando = self._state.adding
        super().save(*args, **kwargs)
        if criando and not self.codigo_carteirinha:
            prefixo = self._prefixo_codigo()
            competencia = timezone.now().strftime("%y%m")
            self.codigo_carteirinha = f"{prefixo}-{competencia}-{self.pk:04d}"
            self.validade_carteirinha = (
                timezone.now() + timedelta(days=30 * self.validade_carteirinha_meses)
            ).date()
            super().save(update_fields=["codigo_carteirinha", "validade_carteirinha"])

    def _prefixo_codigo(self):
        base = self.turma.curso.slug.rsplit("-", 1)[-1]
        letras = "".join(ch for ch in base.upper() if ch.isalnum())
        return letras[:4] or "MAG"

    @property
    def url(self):
        return f"{settings.FRONTEND_URL}/carteirinha/{self.token}"
