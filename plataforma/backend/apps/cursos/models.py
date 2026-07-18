from django.db import models
from django.utils import timezone

from apps.nucleo.models import ComTimestamps, ConteudoRastreavel


class Curso(ConteudoRastreavel, ComTimestamps):
    class Status(models.TextChoices):
        RASCUNHO = "rascunho", "Rascunho"
        PUBLICADO = "publicado", "Publicado"

    slug = models.SlugField(unique=True)
    nome = models.CharField(max_length=120)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.RASCUNHO
    )

    titulo_venda = models.CharField(max_length=160)
    titulo_destaque = models.CharField(max_length=60, blank=True)
    subtitulo = models.TextField()
    imagem_hero = models.ImageField(upload_to="cursos/hero/", blank=True)

    carga_horaria = models.PositiveIntegerField(help_text="em horas")
    formato = models.CharField(max_length=80, default="Presencial")
    dias_e_horario_padrao = models.CharField(max_length=80, blank=True)
    publico_alvo = models.TextField(blank=True)
    requisitos = models.TextField(blank=True, default="Nenhum — formação do zero")

    texto_pratica = models.TextField(blank=True)
    imagem_pratica = models.ImageField(upload_to="cursos/pratica/", blank=True)
    texto_carreira = models.TextField(blank=True)
    imagem_carreira = models.ImageField(upload_to="cursos/carreira/", blank=True)
    itens_inclusos = models.JSONField(default=list, blank=True)
    saidas_profissionais = models.JSONField(default=list, blank=True)

    seo_titulo = models.CharField(max_length=70, blank=True)
    seo_descricao = models.CharField(max_length=160, blank=True)

    class Meta:
        verbose_name = "Curso"
        verbose_name_plural = "Cursos"

    def __str__(self):
        return self.nome


class Habilidade(ConteudoRastreavel, ComTimestamps):
    """Cards 'O que você vai dominar' — 6 por curso na LP."""

    curso = models.ForeignKey(
        Curso, related_name="habilidades", on_delete=models.CASCADE
    )
    ordem = models.PositiveSmallIntegerField(default=0)
    icone = models.CharField(max_length=30, blank=True)
    titulo = models.CharField(max_length=60)
    descricao = models.CharField(max_length=200)

    class Meta:
        ordering = ["ordem"]
        verbose_name = "Habilidade"
        verbose_name_plural = "Habilidades"

    def __str__(self):
        return self.titulo


class FotoCurso(ConteudoRastreavel, ComTimestamps):
    """Fotos de curso — duas finalidades pela presença ou não de `turma`:
    sem turma, é a galeria genérica usada na LP do curso; com turma, é a
    foto de formatura daquela turma específica, priorizada no carrossel do
    magic link de avaliação (ver docs/plataforma/05-avaliacoes-magic-link.md)
    quando o convite tiver turma associada."""

    curso = models.ForeignKey(Curso, related_name="fotos", on_delete=models.CASCADE)
    turma = models.ForeignKey(
        "Turma", related_name="fotos", null=True, blank=True, on_delete=models.CASCADE
    )
    ordem = models.PositiveSmallIntegerField(default=0)
    imagem = models.ImageField(upload_to="cursos/galeria/")
    legenda = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["ordem"]
        verbose_name = "Foto do curso"
        verbose_name_plural = "Fotos do curso"

    def __str__(self):
        return f"{self.curso.nome} — foto {self.ordem}"


class PerguntaFrequente(ConteudoRastreavel, ComTimestamps):
    curso = models.ForeignKey(Curso, related_name="faqs", on_delete=models.CASCADE)
    ordem = models.PositiveSmallIntegerField(default=0)
    pergunta = models.CharField(max_length=160)
    resposta = models.TextField()

    class Meta:
        ordering = ["ordem"]
        verbose_name = "Pergunta frequente"
        verbose_name_plural = "Perguntas frequentes"

    def __str__(self):
        return self.pergunta


class Instrutor(ConteudoRastreavel, ComTimestamps):
    usuario = models.OneToOneField(
        "contas.Usuario", null=True, blank=True, on_delete=models.SET_NULL
    )
    nome = models.CharField(max_length=120)
    registro = models.CharField(max_length=60, blank=True)
    especializacao = models.CharField(max_length=160, blank=True)
    bio = models.TextField(blank=True)
    foto = models.ImageField(upload_to="instrutores/", blank=True)
    cursos = models.ManyToManyField(Curso, related_name="instrutores", blank=True)

    class Meta:
        verbose_name = "Instrutor"
        verbose_name_plural = "Instrutores"

    def __str__(self):
        return self.nome


class Turma(ConteudoRastreavel, ComTimestamps):
    class Status(models.TextChoices):
        RASCUNHO = "rascunho", "Rascunho"
        INSCRICOES = "inscricoes", "Inscrições abertas"
        LOTADA = "lotada", "Lotada"
        EM_ANDAMENTO = "em_andamento", "Em andamento"
        ENCERRADA = "encerrada", "Encerrada"

    curso = models.ForeignKey(Curso, related_name="turmas", on_delete=models.CASCADE)
    codigo = models.CharField(max_length=20)
    status = models.CharField(
        max_length=14, choices=Status.choices, default=Status.RASCUNHO
    )

    inicio_aulas = models.DateField(null=True, blank=True)
    exibir_inicio = models.BooleanField(default=False)
    dias_e_horario = models.CharField(max_length=80, blank=True)
    capacidade = models.PositiveSmallIntegerField(null=True, blank=True)
    vagas_restantes = models.PositiveSmallIntegerField(null=True, blank=True)
    exibir_vagas = models.BooleanField(default=False)

    exibir_countdown = models.BooleanField(default=False)
    countdown_ate = models.DateTimeField(null=True, blank=True)
    rotulo_countdown = models.CharField(
        max_length=80, default="Condição de matrícula antecipada encerra em"
    )

    preco_cheio = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    preco_avista = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    parcelas_qtd = models.PositiveSmallIntegerField(null=True, blank=True)
    parcela_valor = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    exibir_preco = models.BooleanField(default=False)
    obs_pagamento = models.CharField(max_length=160, blank=True)

    instrutor = models.ForeignKey(
        Instrutor, null=True, blank=True, on_delete=models.SET_NULL
    )

    # Consentimento de uso de imagem da turma — controla se as mídias do
    # acervo (apps.midia) podem circular (ver docs/subsistemas/
    # 09-acervo-studio-postagem.md). Toggle feito na Mesa de Luz.
    consentimento_midia = models.BooleanField(default=False)
    consentimento_midia_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Turma"
        verbose_name_plural = "Turmas"

    def __str__(self):
        return f"{self.curso.nome} — {self.codigo}"

    @property
    def countdown_ativo(self):
        return bool(
            self.exibir_countdown
            and self.countdown_ate
            and self.countdown_ate > timezone.now()
        )


class AnotacaoTurma(ComTimestamps):
    """Memória interna de turmas anteriores — nunca vai para o site."""

    turma = models.ForeignKey(Turma, related_name="anotacoes", on_delete=models.CASCADE)
    autor = models.ForeignKey("contas.Usuario", null=True, on_delete=models.SET_NULL)
    texto = models.TextField()

    class Meta:
        verbose_name = "Anotação de turma"
        verbose_name_plural = "Anotações de turma"

    def __str__(self):
        return f"Anotação em {self.turma}"
