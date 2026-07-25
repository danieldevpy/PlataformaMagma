import hashlib
import secrets

from django.db import models
from django.utils import timezone


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
    # Retenção do registro de conversas do agente (spec 021). Fica aqui, e
    # não em variável de ambiente, porque mudar em prod precisa ser 3
    # toques no celular — env var exigiria editar .env.prod na VPS e
    # recriar container. Não entra em CAMPOS_CONFIG do serializer: é
    # config operacional, não conteúdo público do site.
    conversas_retencao_dias = models.PositiveIntegerField(
        default=15,
        help_text=(
            "Por quantos dias guardar as conversas do agente com os "
            "contatos. 0 = nunca apagar."
        ),
    )
    # Prazo do handoff (spec 025), mesmo espírito do campo acima: config
    # operacional editável no celular, não variável de ambiente. O default
    # de 24h erra de propósito pro lado de voltar a atender — o pior caso
    # hoje é silêncio infinito; o pior caso com prazo é a MAG falar com
    # alguém que o gestor já atende, que é visível e recuperável.
    handoff_expira_horas = models.PositiveIntegerField(
        default=24,
        help_text=(
            "Depois de quantas horas um contato escalado volta a ser "
            "atendido pela MAG, se ninguém resolver. 0 = nunca expira."
        ),
    )
    # Silêncio exigido antes de a Nutridora tocar (028-T20). Substituiu a
    # exclusão por `utm_source="whatsapp"`, que usava a ORIGEM do lead como
    # se fosse ATIVIDADE — e origem não muda nunca, então lead nascido de
    # conversa com a MAG ficava fora da régua pra sempre.
    nutridora_silencio_dias = models.PositiveIntegerField(
        default=2,
        help_text=(
            "Quantos dias sem falar com a MAG um lead precisa ficar antes "
            "de receber toque automático da Nutridora. 0 = não checar "
            "conversa (pode tocar alguém no meio do papo)."
        ),
    )

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
    """Número de WhatsApp pausado pra resposta automática, com estado
    explícito (spec 025). Usado pelo handoff da SDR — ver
    apps/nucleo/acoes_contato.py e specs/012-agente-whatsapp-handoff.

    Até a spec 025 a presença do registro ERA o estado ("existe =
    silenciado; apagar pelo admin = libera"). Era uma simplificação
    correta enquanto o handoff era exceção; com 6 de 6 conversas
    simuladas terminando em handoff, virou o buraco principal — apagar
    era a única saída, e apagar perde o histórico de que houve handoff.
    Agora o estado é `resolvido_em`/`expira_em`, e apagar deixa de ser
    necessário.
    """

    numero = models.CharField(
        max_length=20,
        db_index=True,
        help_text="Só dígitos com DDI, mesmo formato de Usuario.whatsapp/Lead.whatsapp.",
    )
    motivo = models.CharField(max_length=255)
    # Null = ainda ativo. O gestor marca pelo Admin quando devolve o
    # contato pro atendimento automático.
    resolvido_em = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Quando a equipe devolveu o contato pro atendimento automático.",
    )
    # Null = nunca expira (comportamento anterior à spec 025, e o que os
    # registros antigos herdam na migração).
    expira_em = models.DateTimeField(
        null=True,
        blank=True,
        help_text=(
            "Passado este momento a MAG volta a atender sozinha, mesmo sem "
            "ninguém resolver. Vazio = nunca expira."
        ),
    )

    class Meta:
        verbose_name = "Contato escalado"
        verbose_name_plural = "Contatos escalados"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"{self.numero} — {self.motivo}"

    @property
    def ativo(self):
        """Silencia a MAG? Só enquanto não foi resolvido nem expirou."""
        if self.resolvido_em is not None:
            return False
        if self.expira_em is not None and self.expira_em <= timezone.now():
            return False
        return True

    @classmethod
    def ativo_para(cls, numero):
        """O handoff ativo deste número, ou None.

        `numero` deixou de ser `unique` de propósito: o mesmo contato pode
        ser escalado de novo meses depois, e o registro antigo (resolvido)
        não pode colidir com o novo. Por isso a consulta é sempre "o ativo
        mais recente", nunca `get(numero=...)`.
        """
        agora = timezone.now()
        return (
            cls.objects.filter(numero=numero, resolvido_em__isnull=True)
            .filter(models.Q(expira_em__isnull=True) | models.Q(expira_em__gt=agora))
            .order_by("-criado_em")
            .first()
        )

    @classmethod
    def numeros_ativos(cls):
        """Conjunto de números silenciados agora — usado pra excluir gente
        do disparo automático (ver apps/leads/acoes.py::processar_nutridora).
        """
        agora = timezone.now()
        return set(
            cls.objects.filter(resolvido_em__isnull=True)
            .filter(models.Q(expira_em__isnull=True) | models.Q(expira_em__gt=agora))
            .values_list("numero", flat=True)
        )


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
