from django.core.exceptions import ValidationError
from django.db import models

from apps.nucleo.models import ComTimestamps


def caminho_midia(instance, filename):
    """upload_to de Midia.arquivo — camada turma mantém o caminho histórico
    (turmas/<id>/foto|video|arte/<arquivo>, assim rsync/limpeza enxergam a
    turma junta E nenhum arquivo pré-camadas precisa mudar de lugar); as
    demais camadas vão para acervo/<camada>/ (curso: acervo/cursos/<id>/)."""
    if instance.turma_id:
        return f"turmas/{instance.turma_id}/{instance.tipo}/{filename}"
    if instance.curso_id:
        return f"acervo/cursos/{instance.curso_id}/{instance.tipo}/{filename}"
    return f"acervo/{instance.camada}/{instance.tipo}/{filename}"


class Midia(ComTimestamps):
    """Acervo de mídia da marca, organizado em CAMADAS (spec 008): a foto/
    vídeo entra UMA vez aqui e alimenta o Studio, o convite de avaliação e
    futuramente álbum/stories. A camada diz de onde a mídia é — de uma turma
    (com consentimento), institucional de um curso, instrutores, estrutura
    da escola, banco de imagens externo (com crédito) ou geral da marca."""

    class Tipo(models.TextChoices):
        FOTO = "foto", "Foto"
        VIDEO = "video", "Vídeo"
        ARTE = "arte", "Arte"

    class Origem(models.TextChoices):
        INSTRUTOR = "instrutor", "Instrutor"
        STUDIO = "studio", "Studio"

    class Camada(models.TextChoices):
        TURMA = "turma", "Turma"
        CURSO = "curso", "Curso"
        INSTRUTORES = "instrutores", "Instrutores"
        ESTRUTURA = "estrutura", "Estrutura"
        EXTERNA = "externa", "Externa (banco de imagens)"
        GERAL = "geral", "Geral da marca"

    # Invariantes (validados em clean() e nas views de upload):
    # camada=turma ⇔ turma preenchida; camada=curso ⇔ curso preenchida (sem
    # turma); demais camadas ⇒ turma e curso vazias. CASCADE proposital na
    # turma: apagar a turma apaga a mídia dela (consentimento/LGPD acima de
    # conveniência — ver .context/decisoes.md, ADR de 2026-07-18).
    camada = models.CharField(
        max_length=12, choices=Camada.choices, default=Camada.GERAL
    )
    turma = models.ForeignKey(
        "cursos.Turma",
        related_name="midias",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    curso = models.ForeignKey(
        "cursos.Curso",
        related_name="midias_acervo",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    arquivo = models.FileField(upload_to=caminho_midia)
    # Só foto/arte ganham thumb (Pillow, síncrono, no upload); vídeo fica
    # thumb=None — a UI usa um card genérico com ícone ▶ pra esse caso.
    thumb = models.ImageField(upload_to="turmas/thumbs/", null=True, blank=True)
    legenda = models.CharField(max_length=160, blank=True)
    # Fonte/licença de imagem vinda de fora (camada externa) — atribuição é
    # obrigação legal de vários bancos gratuitos, então fica no dado.
    credito = models.CharField(max_length=200, blank=True)
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
        verbose_name = "Mídia do acervo"
        verbose_name_plural = "Mídias do acervo"

    def clean(self):
        if self.camada == self.Camada.TURMA and not self.turma_id:
            raise ValidationError("Camada 'turma' exige uma turma.")
        if self.camada == self.Camada.CURSO and not self.curso_id:
            raise ValidationError("Camada 'curso' exige um curso.")
        if self.camada != self.Camada.TURMA and self.turma_id:
            raise ValidationError("Só a camada 'turma' pode ter turma.")
        if self.camada not in (self.Camada.TURMA, self.Camada.CURSO) and self.curso_id:
            raise ValidationError("Só a camada 'curso' pode ter curso próprio.")

    def __str__(self):
        return f"{self.get_tipo_display()} — {self.contexto_rotulo}"

    @property
    def contexto_rotulo(self):
        if self.turma_id:
            return str(self.turma)
        if self.curso_id:
            return str(self.curso)
        return self.get_camada_display()


class Postagem(ComTimestamps):
    """Um post gerado no Studio a partir do acervo — as artes exportadas
    viram Midia (tipo=arte, origem=studio) vinculadas aqui via
    `Midia.postagem`. Desde a spec 008 a postagem tem CONTEXTO: de uma turma,
    de um curso (conteúdo diário da página do curso) ou da marca (ambos
    vazios)."""

    class Status(models.TextChoices):
        RASCUNHO = "rascunho", "Rascunho"
        PRONTA = "pronta", "Pronta"
        PUBLICADA = "publicada", "Publicada"

    class Modo(models.TextChoices):
        MANUAL = "manual", "Manual"
        AUTO = "auto", "Automático"

    turma = models.ForeignKey(
        "cursos.Turma",
        related_name="postagens",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    curso = models.ForeignKey(
        "cursos.Curso",
        related_name="postagens",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
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
    # Fila pro Manus publicar (ver apps/midia/acoes.py::listar_postagens_agendadas
    # e specs/005-camada-de-acoes) — preenchido opcionalmente via PATCH
    # atualizar_postagem; não é o mesmo que publicada_em (esse carimba
    # quando a publicação de fato aconteceu).
    agendada_para = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-criado_em"]
        verbose_name = "Postagem"
        verbose_name_plural = "Postagens"

    @property
    def contexto_rotulo(self):
        if self.turma_id:
            return str(self.turma)
        if self.curso_id:
            return str(self.curso)
        return "Marca"

    def __str__(self):
        return f"{self.titulo} — {self.contexto_rotulo}"
