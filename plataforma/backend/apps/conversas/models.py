"""Registro das conversas entre o agente MAG e os contatos do WhatsApp
(ver specs/021-registro-conversas-agente e docs/subsistemas/02b-agente-whatsapp-n8n.md §8).

O n8n é descartável: a memória do agente vive no Redis com TTL curto
(spec 022) e serve só pra continuidade do papo. O que precisa durar o
suficiente pra ser ANALISADO — "a MAG respondeu certo? converteu?" —
vira dado aqui, na plataforma, agrupado por conversa e não por mensagem
solta como nas execuções do n8n.
"""

from datetime import timedelta

from django.db import models
from django.utils import timezone

from apps.nucleo.models import ComTimestamps

# Silêncio maior que isso e a próxima mensagem do mesmo número abre uma
# conversa nova, em vez de emendar num fio infinito. Constante, não
# configuração: valor que ninguém precisa ajustar no dia a dia (e a spec
# 022 usa o MESMO número no `sessionTTL` da memória do agente no Redis —
# os dois lados precisam concordar sobre o que é "uma conversa").
JANELA_SESSAO_HORAS = 6


class Conversa(ComTimestamps):
    """Um fio de conversa com um número, delimitado por inatividade."""

    class Canal(models.TextChoices):
        WHATSAPP = "whatsapp", "WhatsApp"

    class Desfecho(models.TextChoices):
        NENHUM = "", "Sem desfecho"
        LEAD = "lead_registrado", "Lead registrado"
        HANDOFF = "handoff", "Passou pro humano"
        MATRICULA = "matricula", "Matrícula"
        COBRANCA = "cobranca", "Cobrança gerada"

    canal = models.CharField(
        max_length=20, choices=Canal.choices, default=Canal.WHATSAPP
    )
    numero = models.CharField(max_length=20, db_index=True)
    nome_contato = models.CharField(max_length=120, blank=True)
    # Mesmos valores devolvidos por `identificar_contato`
    # (apps/nucleo/acoes_contato.py): gestor, instrutor, lead, desconhecido.
    papel = models.CharField(max_length=20, blank=True)
    agente = models.CharField(
        max_length=20,
        blank=True,
        help_text="Qual agente atendeu: sdr, operadora, nutridora, radar.",
    )
    lead = models.ForeignKey(
        "leads.Lead", null=True, blank=True, on_delete=models.SET_NULL
    )
    usuario = models.ForeignKey(
        "contas.Usuario", null=True, blank=True, on_delete=models.SET_NULL
    )
    ultima_atividade_em = models.DateTimeField(db_index=True)
    escalada = models.BooleanField(
        default=False, help_text="Houve handoff pro humano nesta conversa."
    )
    desfecho = models.CharField(
        max_length=20, choices=Desfecho.choices, blank=True, default=""
    )

    class Meta:
        ordering = ["-ultima_atividade_em"]
        verbose_name = "Conversa"
        verbose_name_plural = "Conversas"
        indexes = [models.Index(fields=["numero", "-ultima_atividade_em"])]

    def __str__(self):
        quem = self.nome_contato or self.numero
        return f"{quem} — {self.criado_em:%d/%m %H:%M}"

    @classmethod
    def numeros_ativos_desde(cls, dias):
        """Conjunto de números que falaram com algum agente nos últimos
        `dias` dias — usado pra NÃO tocar quem está no meio de um papo
        (ver apps/leads/acoes.py::processar_nutridora, 028-T20).

        Contrapartida de `ContatoEscalado.numeros_ativos()`: um exclui quem
        o humano assumiu, o outro exclui quem a MAG está atendendo agora.

        `dias=0` devolve conjunto vazio — o Admin desligou a checagem, e
        aí ninguém é excluído por conversa.
        """
        if dias <= 0:
            return set()
        limite = timezone.now() - timedelta(days=dias)
        return set(
            cls.objects.filter(ultima_atividade_em__gte=limite).values_list(
                "numero", flat=True
            )
        )

    def transcricao(self):
        """A conversa como texto corrido, do jeito que aconteceu — é isso
        que `exportar_conversas` entrega pra uma LLM ler em bloco (ler
        `{"turnos": [...]}` obrigaria quem analisa a remontar o diálogo)."""
        linhas = []
        for turno in self.turnos.all():
            quem = {
                Turno.Papel.CONTATO: self.nome_contato or "Contato",
                Turno.Papel.AGENTE: f"MAG ({turno.agente})" if turno.agente else "MAG",
                Turno.Papel.SISTEMA: "Sistema",
            }[turno.papel]
            linhas.append(f"[{turno.criado_em:%d/%m %H:%M}] {quem}: {turno.texto}")
            if turno.ferramentas:
                nomes = ", ".join(f.get("nome", "?") for f in turno.ferramentas)
                linhas.append(f"    (ferramentas: {nomes})")
        return "\n".join(linhas)


class Turno(ComTimestamps):
    """Uma fala dentro de uma conversa (do contato, do agente ou do sistema)."""

    class Papel(models.TextChoices):
        CONTATO = "contato", "Contato"
        AGENTE = "agente", "Agente"
        SISTEMA = "sistema", "Sistema"

    conversa = models.ForeignKey(
        Conversa, related_name="turnos", on_delete=models.CASCADE
    )
    papel = models.CharField(max_length=10, choices=Papel.choices)
    texto = models.TextField(blank=True)
    agente = models.CharField(max_length=20, blank=True)
    # [{"nome": "registrar_lead", "params": {...}}] — vem do
    # `intermediateSteps` do AI Agent do n8n, que já está ligado nos dois
    # agentes. É o que permite derivar o desfecho sem LLM.
    ferramentas = models.JSONField(default=list, blank=True)
    execucao_n8n = models.CharField(max_length=40, blank=True)

    class Meta:
        ordering = ["criado_em", "id"]
        verbose_name = "Turno"
        verbose_name_plural = "Turnos"

    def __str__(self):
        return f"{self.get_papel_display()}: {self.texto[:60]}"
