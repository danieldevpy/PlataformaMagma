from django.db import models

from apps.ia.crypto import cifrar, decifrar
from apps.nucleo.models import ComTimestamps


class ProvedorIA(ComTimestamps):
    """Configuração de um provedor de IA pra um tipo de capacidade (texto,
    imagem ou vídeo) — ver docs/subsistemas/10-studio-2.0.md §5.2. Só 1
    provedor fica ATIVO por tipo (garantido em `save`, não só na UI): ativar
    um desativa os demais do mesmo tipo, então nunca há ambiguidade de qual
    provedor a capacidade usa."""

    class Tipo(models.TextChoices):
        TEXTO = "texto", "Texto"
        IMAGEM = "imagem", "Imagem"
        VIDEO = "video", "Vídeo"

    class Provedor(models.TextChoices):
        ANTHROPIC = "anthropic", "Anthropic"
        OPENAI = "openai", "OpenAI"

    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    provedor = models.CharField(max_length=20, choices=Provedor.choices)
    modelo = models.CharField(max_length=100)
    # Guarda o valor CIFRADO (Fernet, ver apps/ia/crypto.py) — nunca a chave
    # em texto puro. Use `get_credencial`/`set_credencial`, nunca o campo
    # direto.
    credencial = models.CharField(max_length=1000, blank=True)
    # Extras por provedor (temperatura, tamanho, max_tokens etc.).
    config = models.JSONField(default=dict, blank=True)
    ativo = models.BooleanField(default=True)
    testado_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["tipo", "-ativo", "-criado_em"]
        verbose_name = "Provedor de IA"
        verbose_name_plural = "Provedores de IA"

    def __str__(self):
        return f"{self.get_tipo_display()} · {self.get_provedor_display()} ({self.modelo})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.ativo:
            # Desativa os demais provedores do mesmo tipo — via update() pra
            # não reentrar em save() nem disparar sinais em cascata.
            ProvedorIA.objects.filter(tipo=self.tipo, ativo=True).exclude(
                pk=self.pk
            ).update(ativo=False)

    def set_credencial(self, valor_plano):
        """Recebe a chave em texto puro (só existe na memória da request) e
        grava já cifrada no campo `credencial`."""
        self.credencial = cifrar(valor_plano)

    def get_credencial(self):
        """Decifra a chave pra uso pontual (chamada ao provedor). Nunca
        logar nem serializar o retorno disto."""
        return decifrar(self.credencial)


class ExecucaoIA(ComTimestamps):
    """Auditoria + custo de cada chamada de IA feita via `/api/ia/executar/`
    — trilha obrigatória (ver doc 10 §5.2 e §10 "Custo de IA descontrolado")."""

    class Status(models.TextChoices):
        OK = "ok", "OK"
        ERRO = "erro", "Erro"

    provedor = models.ForeignKey(
        ProvedorIA,
        related_name="execucoes",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    capacidade = models.CharField(max_length=40)
    # Resumo curto do contexto pedido (nunca o contexto inteiro) — só pra
    # auditoria caber numa linha de admin.
    contexto_resumo = models.CharField(max_length=255, blank=True)
    tokens_entrada = models.PositiveIntegerField(null=True, blank=True)
    tokens_saida = models.PositiveIntegerField(null=True, blank=True)
    duracao_ms = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices)
    erro = models.TextField(blank=True)
    usuario = models.ForeignKey(
        "contas.Usuario",
        related_name="execucoes_ia",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    # Preenchido quando quem pediu foi um agente (n8n etc.), não um humano
    # logado — mesmo espírito do `TokenAgente` da spec 005.
    agente = models.CharField(max_length=60, blank=True)

    class Meta:
        ordering = ["-criado_em"]
        verbose_name = "Execução de IA"
        verbose_name_plural = "Execuções de IA"

    def __str__(self):
        return f"{self.capacidade} · {self.status} · {self.criado_em:%d/%m/%Y %H:%M}"
