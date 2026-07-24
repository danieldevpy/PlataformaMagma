from django.db import models

from apps.ia.crypto import cifrar, decifrar
from apps.nucleo.models import ComTimestamps


class ConfiguracaoAsaas(ComTimestamps):
    """Credencial do Asaas por ambiente — mesmo padrão do `ProvedorIA`
    (apps/ia/models.py): a chave de API e o token de webhook nunca ficam em
    texto puro no banco (Fernet via apps.ia.crypto, derivado do
    SECRET_KEY). Só 1 linha fica `ativo` por vez (garantido em `save`, não
    só na UI) — decide onde cobranças NOVAS são criadas, pra nunca gerar
    cobrança real por engano testando no sandbox."""

    class Ambiente(models.TextChoices):
        SANDBOX = "sandbox", "Sandbox (testes)"
        PRODUCAO = "producao", "Produção (dinheiro real)"

    ambiente = models.CharField(max_length=10, choices=Ambiente.choices, unique=True)
    # Guardam o valor CIFRADO — use sempre os métodos abaixo, nunca o campo
    # direto.
    api_key = models.CharField(max_length=1000, blank=True)
    webhook_token = models.CharField(max_length=1000, blank=True)
    ativo = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Configuração Asaas"
        verbose_name_plural = "Configurações Asaas"

    def __str__(self):
        return f"{self.get_ambiente_display()} ({'ativo' if self.ativo else 'inativo'})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.ativo:
            # Desativa a outra linha via update() — não reentra em save().
            ConfiguracaoAsaas.objects.exclude(pk=self.pk).update(ativo=False)

    def set_credencial(self, valor_plano):
        self.api_key = cifrar(valor_plano)

    def get_credencial(self):
        return decifrar(self.api_key)

    def set_webhook_token(self, valor_plano):
        self.webhook_token = cifrar(valor_plano)

    def get_webhook_token(self):
        return decifrar(self.webhook_token)

    @classmethod
    def obter_ativa(cls):
        return cls.objects.filter(ativo=True).first()


class Cobranca(ComTimestamps):
    """Cobrança real no Asaas, ligada a uma `Matricula`
    (apps/educacional/models.py). Os campos que vêm do Asaas (`asaas_id`,
    `link_pagamento`, `status`, `ambiente`) nunca são digitados — vêm da
    resposta da API (ver apps/financeiro/services.py)."""

    class FormaPagamento(models.TextChoices):
        PIX = "PIX", "Pix"
        BOLETO = "BOLETO", "Boleto"
        CARTAO = "CREDIT_CARD", "Cartão"
        INDEFINIDO = "UNDEFINED", "Aluno escolhe"

    class Status(models.TextChoices):
        PENDENTE = "pendente", "Pendente"
        PAGA = "paga", "Paga"
        VENCIDA = "vencida", "Vencida"
        CANCELADA = "cancelada", "Cancelada"
        ESTORNADA = "estornada", "Estornada"

    matricula = models.ForeignKey(
        "educacional.Matricula", related_name="cobrancas", on_delete=models.CASCADE
    )
    valor = models.DecimalField(max_digits=8, decimal_places=2)
    forma_pagamento = models.CharField(max_length=12, choices=FormaPagamento.choices)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDENTE
    )
    vencimento = models.DateField()
    link_pagamento = models.URLField()
    asaas_id = models.CharField(max_length=40, unique=True)
    ambiente = models.CharField(max_length=10, choices=ConfiguracaoAsaas.Ambiente.choices)
    criado_por = models.ForeignKey(
        "contas.Usuario", null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        ordering = ["-criado_em"]
        verbose_name = "Cobrança"
        verbose_name_plural = "Cobranças"

    def __str__(self):
        return f"{self.matricula.aluno.nome} — R$ {self.valor} ({self.status})"


class EventoWebhookAsaas(ComTimestamps):
    """Auditoria de todo webhook recebido do Asaas — primeiro webhook HTTP
    externo do projeto (sem convenção prévia a seguir), então cada evento
    fica registrado pra depurar sem depender de log de servidor."""

    class StatusProcessamento(models.TextChoices):
        PROCESSADO = "processado", "Processado"
        IGNORADO = "ignorado", "Ignorado — cobrança não encontrada"

    evento = models.CharField(max_length=60, blank=True)
    payload = models.JSONField()
    cobranca = models.ForeignKey(
        Cobranca,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="eventos_webhook",
    )
    status_processamento = models.CharField(
        max_length=12, choices=StatusProcessamento.choices
    )

    class Meta:
        ordering = ["-criado_em"]
        verbose_name = "Evento de webhook Asaas"
        verbose_name_plural = "Eventos de webhook Asaas"

    def __str__(self):
        return f"{self.evento} — {self.status_processamento} ({self.criado_em:%d/%m/%Y %H:%M})"
