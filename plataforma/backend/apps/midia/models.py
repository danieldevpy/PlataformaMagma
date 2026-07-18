from django.db import models

from apps.nucleo.models import ComTimestamps


def caminho_midia(instance, filename):
    """upload_to de MidiaTurma.arquivo — separa por turma e tipo
    (turmas/<id>/foto|video|arte/<arquivo>), assim o rsync de backup e a
    limpeza manual conseguem enxergar tudo de uma turma junto."""
    return f"turmas/{instance.turma_id}/{instance.tipo}/{filename}"


class MidiaTurma(ComTimestamps):
    """Acervo de mídia de uma turma — a foto/vídeo entra UMA vez aqui e
    alimenta o Studio (carrossel), o convite de avaliação e futuramente
    álbum/stories (ver docs/subsistemas/09-acervo-studio-postagem.md)."""

    class Tipo(models.TextChoices):
        FOTO = "foto", "Foto"
        VIDEO = "video", "Vídeo"
        ARTE = "arte", "Arte"

    class Origem(models.TextChoices):
        INSTRUTOR = "instrutor", "Instrutor"
        STUDIO = "studio", "Studio"

    turma = models.ForeignKey(
        "cursos.Turma", related_name="midias", on_delete=models.CASCADE
    )
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    arquivo = models.FileField(upload_to=caminho_midia)
    # Só foto/arte ganham thumb (Pillow, síncrono, no upload); vídeo fica
    # thumb=None — a UI usa um card genérico com ícone ▶ pra esse caso.
    thumb = models.ImageField(upload_to="turmas/thumbs/", null=True, blank=True)
    legenda = models.CharField(max_length=160, blank=True)
    # Subconjunto de {"destaque","capa","avaliacao"} — curadoria feita na
    # Mesa de Luz (atalhos D/C/A). "capa" deveria ser única por turma, mas
    # essa regra é resolvida no cliente (o backend não valida aqui).
    tags = models.JSONField(default=list, blank=True)
    ordem = models.PositiveIntegerField(default=0)
    # Gancho pra Etapa 5 (linha do tempo por aula) — não usado ainda.
    aula_data = models.DateField(null=True, blank=True)
    origem = models.CharField(
        max_length=10, choices=Origem.choices, default=Origem.INSTRUTOR
    )
    postagem = models.ForeignKey(
        "midia.Postagem",
        related_name="artes",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    # width, height, size, content_type do arquivo original — preenchido no
    # upload (ver apps/midia/utils.py).
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["ordem", "id"]
        verbose_name = "Mídia da turma"
        verbose_name_plural = "Mídias da turma"

    def __str__(self):
        return f"{self.get_tipo_display()} — {self.turma}"


class Postagem(ComTimestamps):
    """Um post gerado no Studio (carrossel) a partir do acervo da turma —
    as artes exportadas viram MidiaTurma (tipo=arte, origem=studio)
    vinculadas aqui via `MidiaTurma.postagem`."""

    class Status(models.TextChoices):
        RASCUNHO = "rascunho", "Rascunho"
        PRONTA = "pronta", "Pronta"
        PUBLICADA = "publicada", "Publicada"

    class Modo(models.TextChoices):
        MANUAL = "manual", "Manual"
        AUTO = "auto", "Automático"

    turma = models.ForeignKey(
        "cursos.Turma", related_name="postagens", on_delete=models.CASCADE
    )
    titulo = models.CharField(max_length=120)
    legenda = models.TextField(blank=True)
    canal = models.CharField(max_length=30, default="instagram")
    modo = models.CharField(max_length=10, choices=Modo.choices, default=Modo.MANUAL)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.RASCUNHO
    )
    url_publicada = models.URLField(blank=True)
    publicada_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-criado_em"]
        verbose_name = "Postagem"
        verbose_name_plural = "Postagens"

    def __str__(self):
        return f"{self.titulo} — {self.turma}"
