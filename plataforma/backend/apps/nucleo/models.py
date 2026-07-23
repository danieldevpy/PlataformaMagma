import hashlib
import secrets

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

    whatsapp_principal = models.CharField(max_length=20, default="5521979767821")
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


def _hash_token(token_bruto):
    return hashlib.sha256(token_bruto.encode()).hexdigest()


class TokenAgente(ComTimestamps):
    """Credencial de agente externo (n8n, Manus) pra chamar
    `/api/acoes/executar/` sem login humano (ver apps/nucleo/acoes.py e
    specs/005-camada-de-acoes). O valor bruto do token só existe no momento
    da criação (devolvido/exibido uma vez pelo admin) — o banco guarda só o
    hash sha256, comparado por igualdade de hash (mesmo padrão de senha)."""

    nome = models.CharField(
        max_length=60, unique=True, help_text="Identifica o agente, ex.: agente-n8n."
    )
    token_hash = models.CharField(max_length=64, unique=True, editable=False)
    # Lista de strings tipo "avaliacoes:gerar_link_avaliacao" (exata),
    # "midia:*" (prefixo — todas as ações do app midia) ou "*" (tudo).
    escopos = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            'Lista JSON de escopos liberados pra esse agente, ex.: ["*"] '
            '(tudo) ou ["avaliacoes:gerar_link_avaliacao", "midia:*"]. Ver '
            "GET /api/acoes/ pro nome do escopo de cada ação."
        ),
    )
    ativo = models.BooleanField(default=True)
    ultimo_uso_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Token de agente"
        verbose_name_plural = "Tokens de agente"

    def __str__(self):
        return self.nome

    @staticmethod
    def gerar_par():
        """Devolve (token_bruto, hash) — usado na criação (admin) e nos
        testes; nunca guarda o bruto."""
        token_bruto = secrets.token_urlsafe(32)
        return token_bruto, _hash_token(token_bruto)

    @classmethod
    def autenticar(cls, token_bruto):
        """Busca o agente ativo dono do token bruto recebido no header
        `X-Agente-Token` — comparação por hash, nunca em texto puro."""
        if not token_bruto:
            return None
        return cls.objects.filter(
            token_hash=_hash_token(token_bruto), ativo=True
        ).first()

    def autoriza(self, escopo_acao):
        """`escopo_acao` é o escopo declarado pela ação (`registrar_acao`).
        Sem escopo declarado (ações puramente descritivas) não autoriza."""
        if not self.ativo or not escopo_acao:
            return False
        for padrao in self.escopos:
            if padrao == "*" or padrao == escopo_acao:
                return True
            if padrao.endswith(":*") and escopo_acao.startswith(padrao[:-1]):
                return True
        return False


class ContatoEscalado(ComTimestamps):
    """Número de WhatsApp pausado pra resposta automática — a presença do
    registro já é o estado (existe = silenciado; apagar pelo admin =
    libera). Usado pelo handoff da SDR (ver apps/nucleo/acoes_contato.py e
    specs/012-agente-whatsapp-handoff)."""

    numero = models.CharField(
        max_length=20,
        unique=True,
        help_text="Só dígitos com DDI, mesmo formato de Usuario.whatsapp/Lead.whatsapp.",
    )
    motivo = models.CharField(max_length=255)

    class Meta:
        verbose_name = "Contato escalado"
        verbose_name_plural = "Contatos escalados"

    def __str__(self):
        return f"{self.numero} — {self.motivo}"


class LogAcao(ComTimestamps):
    """Auditoria de toda execução de `/api/acoes/executar/` — sucesso e
    erro (bot operando a escola exige trilha, ver doc 10 §6)."""

    class Status(models.TextChoices):
        OK = "ok", "OK"
        ERRO = "erro", "Erro"

    acao = models.CharField(max_length=100)
    params = models.JSONField(default=dict, blank=True)
    resultado_resumo = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=6, choices=Status.choices)
    erro = models.TextField(blank=True)
    usuario = models.ForeignKey(
        "contas.Usuario", null=True, blank=True, on_delete=models.SET_NULL
    )
    agente = models.ForeignKey(
        TokenAgente, null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        ordering = ["-criado_em"]
        verbose_name = "Log de ação"
        verbose_name_plural = "Logs de ações"

    def __str__(self):
        quem = self.agente.nome if self.agente_id else (self.usuario or "?")
        return f"{self.acao} — {self.status} ({quem})"
