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
    fields = ("ordem", "imagem", "legenda", "turma", "conteudo_origem")

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        # Turma sem seleção = foto genérica (galeria da LP do curso). Turma
        # selecionada = foto de formatura daquela turma (prioridade no
        # carrossel do convite de avaliação). Restringe o dropdown às
        # turmas do próprio curso sendo editado.
        if db_field.name == "turma":
            object_id = request.resolver_match.kwargs.get("object_id")
            kwargs["queryset"] = Turma.objects.filter(curso_id=object_id) if object_id else Turma.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


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
    actions = ("gerar_link_carteirinha_turma", "gerar_link_carteirinha_individual")

    @admin.action(description="Gerar link de carteirinha (turma toda — compartilhado)")
    def gerar_link_carteirinha_turma(self, request, queryset):
        # Idempotente: um só link de turma por Turma. Reaproveita o
        # existente em vez de acumular vários links compartilhados pra
        # mesma turma a cada clique.
        for turma in queryset:
            matricula, criada = Matricula.objects.get_or_create(
                turma=turma,
                escopo=Matricula.Escopo.TURMA,
                defaults={"enviado_por": request.user},
            )
            prefixo = "Novo link" if criada else "Link já existente"
            self.message_user(request, f"{prefixo} — {turma}: {matricula.url}")

    @admin.action(description="Gerar link de carteirinha (pessoa específica)")
    def gerar_link_carteirinha_individual(self, request, queryset):
        # Aqui sim um link novo por clique — é pra 1 aluno específico.
        for turma in queryset:
            matricula = Matricula.objects.create(
                turma=turma,
                escopo=Matricula.Escopo.INDIVIDUAL,
                enviado_por=request.user,
            )
            self.message_user(request, f"{turma}: {matricula.url}")


@admin.register(AnotacaoTurma)
class AnotacaoTurmaAdmin(admin.ModelAdmin):
    list_display = ("turma", "autor", "criado_em")
    list_filter = ("turma__curso",)
    search_fields = ("texto",)
