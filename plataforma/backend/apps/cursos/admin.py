from django.conf import settings
from django.contrib import admin
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404, render
from django.urls import path

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


class OcultoParaEquipeAdminMixin:
    """Esconde o model da lateral do admin pra quem não é superuser —
    reduz a poluição pra quem não tem experiência com Django. Não é
    barreira de segurança: inlines (ex.: AnotacaoTurmaInline dentro de
    Turma) continuam acessíveis normalmente, pois checam permissão
    própria, não `has_module_permission`."""

    def has_module_permission(self, request):
        if not request.user.is_superuser:
            return False
        return super().has_module_permission(request)


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
class HabilidadeAdmin(OcultoParaEquipeAdminMixin, admin.ModelAdmin):
    list_display = ("titulo", "curso", "ordem", "icone", "conteudo_origem")
    list_filter = ("curso", "conteudo_origem")
    search_fields = ("titulo", "descricao")
    ordering = ("curso", "ordem")


@admin.register(PerguntaFrequente)
class PerguntaFrequenteAdmin(OcultoParaEquipeAdminMixin, admin.ModelAdmin):
    list_display = ("pergunta", "curso", "ordem", "conteudo_origem")
    list_filter = ("curso", "conteudo_origem")
    search_fields = ("pergunta", "resposta")
    ordering = ("curso", "ordem")


@admin.register(Instrutor)
class InstrutorAdmin(OcultoParaEquipeAdminMixin, admin.ModelAdmin):
    list_display = ("nome", "registro", "especializacao", "usuario", "conteudo_origem")
    list_filter = ("conteudo_origem", "cursos")
    search_fields = ("nome", "registro", "especializacao")
    filter_horizontal = ("cursos",)


class AnotacaoTurmaInline(admin.TabularInline):
    model = AnotacaoTurma
    extra = 0
    fields = ("autor", "texto")


class MatriculaInline(admin.TabularInline):
    """Quem está matriculado nesta turma (spec 014) — visão direta na
    página da Turma, sem precisar ir filtrar em Matrícula à parte."""

    model = Matricula
    extra = 0
    fields = ("aluno", "status", "valor_fechado", "forma_pagamento", "criado_em")
    readonly_fields = ("criado_em",)
    autocomplete_fields = ("aluno",)
    show_change_link = True


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
    inlines = (MatriculaInline, AnotacaoTurmaInline)
    actions = ("mostrar_link_cadastro",)

    def get_urls(self):
        # Páginas staff (Mesa de Luz e Studio) servidas DENTRO do namespace
        # do admin — nginx de prod só roteia /(api|dj-admin)/ pro Django, e
        # aqui a autenticação já vem de graça via admin_site.admin_view (ver
        # docs/subsistemas/09-acervo-studio-postagem.md).
        urls_customizadas = [
            path(
                "<int:turma_id>/acervo/",
                self.admin_site.admin_view(self.acervo_view),
                name="cursos_turma_acervo",
            ),
            path(
                "<int:turma_id>/studio/",
                self.admin_site.admin_view(self.studio_view),
                name="cursos_turma_studio",
            ),
        ]
        return urls_customizadas + super().get_urls()

    def _contexto_pagina_midia(self, request, turma_id):
        turma = get_object_or_404(Turma, pk=turma_id)
        return {
            **self.admin_site.each_context(request),
            "turma": turma,
            "api_base": "/api/midia",
            "csrf_token": get_token(request),
        }

    def acervo_view(self, request, turma_id):
        contexto = self._contexto_pagina_midia(request, turma_id)
        return render(request, "midia/acervo.html", contexto)

    def studio_view(self, request, turma_id):
        contexto = self._contexto_pagina_midia(request, turma_id)
        return render(request, "midia/studio.html", contexto)

    @admin.action(description="Mostrar link de cadastro de aluno novo (carteirinha)")
    def mostrar_link_cadastro(self, request, queryset):
        # Link estável de cadastro da turma (spec 014): um por Turma
        # (Turma.token_cadastro), reutilizável — não cria mais Matrícula.
        # Aluno abre, preenche o CPF e já nasce matriculado.
        for turma in queryset:
            url = f"{settings.FRONTEND_URL}/carteirinha/nova/{turma.token_cadastro}"
            self.message_user(request, f"{turma}: {url}")


@admin.register(AnotacaoTurma)
class AnotacaoTurmaAdmin(OcultoParaEquipeAdminMixin, admin.ModelAdmin):
    list_display = ("turma", "autor", "criado_em")
    list_filter = ("turma__curso",)
    search_fields = ("texto",)
