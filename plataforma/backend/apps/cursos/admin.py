from django.contrib import admin

from apps.cursos.models import (
    AnotacaoTurma,
    Curso,
    FotoCurso,
    Habilidade,
    Instrutor,
    PerguntaFrequente,
    Turma,
)
from apps.educacional.models import Matricula


class HabilidadeInline(admin.TabularInline):
    model = Habilidade
    extra = 0
    fields = ("ordem", "icone", "titulo", "descricao", "conteudo_origem")


class PerguntaFrequenteInline(admin.TabularInline):
    model = PerguntaFrequente
    extra = 0
    fields = ("ordem", "pergunta", "resposta", "conteudo_origem")


class FotoCursoInline(admin.TabularInline):
    model = FotoCurso
    extra = 0
    fields = ("ordem", "imagem", "legenda", "conteudo_origem")


@admin.register(Curso)
class CursoAdmin(admin.ModelAdmin):
    list_display = (
        "nome",
        "slug",
        "status",
        "carga_horaria",
        "formato",
        "conteudo_origem",
        "atualizado_em",
    )
    list_filter = ("status", "conteudo_origem", "formato")
    search_fields = ("nome", "slug", "titulo_venda")
    prepopulated_fields = {"slug": ("nome",)}
    inlines = (HabilidadeInline, FotoCursoInline, PerguntaFrequenteInline)


@admin.register(Habilidade)
class HabilidadeAdmin(admin.ModelAdmin):
    list_display = ("titulo", "curso", "ordem", "icone", "conteudo_origem")
    list_filter = ("curso", "conteudo_origem")
    search_fields = ("titulo", "descricao")
    ordering = ("curso", "ordem")


@admin.register(PerguntaFrequente)
class PerguntaFrequenteAdmin(admin.ModelAdmin):
    list_display = ("pergunta", "curso", "ordem", "conteudo_origem")
    list_filter = ("curso", "conteudo_origem")
    search_fields = ("pergunta", "resposta")
    ordering = ("curso", "ordem")


@admin.register(Instrutor)
class InstrutorAdmin(admin.ModelAdmin):
    list_display = ("nome", "registro", "especializacao", "usuario", "conteudo_origem")
    list_filter = ("conteudo_origem", "cursos")
    search_fields = ("nome", "registro", "especializacao")
    filter_horizontal = ("cursos",)


class AnotacaoTurmaInline(admin.TabularInline):
    model = AnotacaoTurma
    extra = 0
    fields = ("autor", "texto")


@admin.register(Turma)
class TurmaAdmin(admin.ModelAdmin):
    list_display = (
        "codigo",
        "curso",
        "status",
        "inicio_aulas",
        "exibir_inicio",
        "vagas_restantes",
        "exibir_vagas",
        "exibir_preco",
        "exibir_countdown",
        "instrutor",
        "atualizado_em",
    )
    list_filter = ("status", "curso", "exibir_preco", "exibir_countdown")
    search_fields = ("codigo", "curso__nome")
    inlines = (AnotacaoTurmaInline,)
    actions = ("gerar_link_carteirinha",)

    @admin.action(description="Gerar link de carteirinha (nova matrícula)")
    def gerar_link_carteirinha(self, request, queryset):
        for turma in queryset:
            matricula = Matricula.objects.create(turma=turma, enviado_por=request.user)
            self.message_user(request, f"{turma}: {matricula.url}")


@admin.register(AnotacaoTurma)
class AnotacaoTurmaAdmin(admin.ModelAdmin):
    list_display = ("turma", "autor", "criado_em")
    list_filter = ("turma__curso",)
    search_fields = ("texto",)
