import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.nucleo.models import ComTimestamps


def normalizar_cpf(valor):
    """Só dígitos; vazio vira None (unique tolera múltiplos NULL em SQLite
    e MySQL — Aluno sem CPF conhecido não colide com outro sem CPF)."""
    digitos = "".join(ch for ch in (valor or "") if ch.isdigit())
    return digitos or None


class Aluno(ComTimestamps):
    """Identidade durável do aluno (spec 014): uma pessoa = um registro,
    independente de quantos cursos fizer — chave é o CPF. Dono da
    carteirinha digital (código + validade), gerada uma única vez na
    criação do Aluno (ver save()) e acessível por `token` (uuid público,
    nunca a PK — constituição §6)."""

    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    nome = models.CharField(max_length=120)
    cpf = models.CharField(max_length=14, unique=True, null=True, blank=True)
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

    # carteirinha — migrou de Matricula pra cá (spec 014): gerada
    # automaticamente na criação (ver save()), mesma lógica de
    # prefixo/competência que antes vivia em Matricula.save(), agora
    # baseada no 1º curso do aluno (ou prefixo genérico "MAG" quando ele
    # ainda não tiver nenhuma matrícula nesse momento).
    codigo_carteirinha = models.CharField(
        max_length=30, unique=True, editable=False, blank=True
    )
    validade_carteirinha_meses = models.PositiveSmallIntegerField(default=24)
    validade_carteirinha = models.DateField(null=True, blank=True, editable=False)

    class Meta:
        verbose_name = "Aluno"
        verbose_name_plural = "Alunos"

    def __str__(self):
        return self.nome or f"Aluno #{self.pk}"

    def save(self, *args, **kwargs):
        self.cpf = normalizar_cpf(self.cpf)
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
        primeira_matricula = self.matriculas.order_by("criado_em", "pk").first()
        if not primeira_matricula:
            return "MAG"
        base = primeira_matricula.turma.curso.slug.rsplit("-", 1)[-1]
        letras = "".join(ch for ch in base.upper() if ch.isalnum())
        return letras[:4] or "MAG"

    @property
    def url(self):
        return f"{settings.FRONTEND_URL}/carteirinha/{self.token}"

    @classmethod
    def buscar_ou_criar_por_cpf(cls, cpf, defaults=None):
        """Centraliza o dedup (critério de aceite da spec 014): reabrir o
        cadastro com um CPF já existente nunca cria um segundo Aluno — só
        devolve o que já existe (preenchendo com `defaults` os campos que
        ainda estiverem vazios). Sem CPF (branco), sempre cria um Aluno
        novo — `cpf=None` não pode "casar" com outro Aluno sem CPF.

        Devolve `(aluno, criado)`, no mesmo formato do
        `QuerySet.get_or_create`."""
        cpf_normalizado = normalizar_cpf(cpf)
        defaults = dict(defaults or {})
        if not cpf_normalizado:
            return cls.objects.create(cpf=cpf, **defaults), True

        aluno, criado = cls.objects.get_or_create(
            cpf=cpf_normalizado, defaults=defaults
        )
        if not criado and defaults:
            mudou = False
            for campo, valor in defaults.items():
                if valor and not getattr(aluno, campo):
                    setattr(aluno, campo, valor)
                    mudou = True
            if mudou:
                aluno.save()
        return aluno, criado


class Matricula(ComTimestamps):
    """Matrícula pura (spec 014): Aluno (obrigatório) numa Turma + status +
    pagamento. Convite/magic-link e carteirinha, que a Matrícula acumulava
    antes, migraram pro Aluno (identidade/carteirinha) e pra Turma
    (`token_cadastro`, o link estável de cadastro de aluno novo) — acabou a
    Matrícula-fantasma."""

    class Status(models.TextChoices):
        CONVIDADO = "convidado", "Convidado (aguardando preenchimento)"
        ATIVA = "ativa", "Ativa"
        CONCLUIDA = "concluida", "Concluída"
        CANCELADA = "cancelada", "Cancelada"

    aluno = models.ForeignKey(
        Aluno, on_delete=models.CASCADE, related_name="matriculas"
    )
    turma = models.ForeignKey(
        "cursos.Turma", on_delete=models.CASCADE, related_name="matriculas"
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.CONVIDADO
    )

    valor_fechado = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    forma_pagamento = models.CharField(max_length=30, blank=True)

    enviado_por = models.ForeignKey(
        "contas.Usuario", null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        verbose_name = "Matrícula"
        verbose_name_plural = "Matrículas"
        constraints = [
            models.UniqueConstraint(
                fields=["aluno", "turma"], name="matricula_aluno_turma_unica"
            )
        ]

    def __str__(self):
        return f"{self.aluno.nome} — {self.turma}"
