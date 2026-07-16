from django.db import models


class ConteudoRastreavel(models.Model):
    """Rastreia se um conteúdo editável ainda é o template do seed ou já foi
    revisado pelo gestor/instrutor (ver docs/plataforma/02-backend-django.md)."""

    class Origem(models.TextChoices):
        TEMPLATE = "template", "Template"
        EDITADO = "editado", "Editado"

    conteudo_origem = models.CharField(
        max_length=10, choices=Origem.choices, default=Origem.TEMPLATE
    )

    class Meta:
        abstract = True


class ComTimestamps(models.Model):
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ConfiguracaoSite(ConteudoRastreavel, ComTimestamps):
    """Singleton com as configurações globais do site (get_or_create(pk=1))."""

    whatsapp_principal = models.CharField(max_length=20, default="5521964946079")
    instagram = models.CharField(max_length=60, default="@magma_curso")
    email = models.EmailField(default="curso.magma21@gmail.com")
    endereco = models.TextField(
        default="Rua Nossa Senhora de Fátima, 495 — Olinda, Nilópolis/RJ"
    )
    nota_google = models.DecimalField(
        max_digits=2, decimal_places=1, null=True, blank=True
    )
    total_alunos_formados = models.PositiveIntegerField(null=True, blank=True)
    exibir_nota_google = models.BooleanField(default=False)
    exibir_total_formados = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Configuração do site"
        verbose_name_plural = "Configuração do site"

    def __str__(self):
        return "Configuração do site"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def obter(cls):
        instancia, _ = cls.objects.get_or_create(pk=1)
        return instancia
