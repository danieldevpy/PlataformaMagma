from django.contrib import admin
from django.middleware.csrf import get_token
from django.shortcuts import render
from django.urls import path

from apps.midia.models import Midia, Postagem


@admin.register(Midia)
class MidiaAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "camada",
        "contexto_rotulo",
        "tipo",
        "origem",
        "legenda",
        "tags",
        "ordem",
        "postagem",
        "criado_em",
    )
    list_filter = ("camada", "tipo", "origem", "turma__curso")
    search_fields = ("legenda", "credito", "turma__codigo", "curso__nome")
    autocomplete_fields = ("turma", "curso", "postagem")

    def get_urls(self):
        # Mesa de Luz e Studio DA MARCA (spec 008) — mesmas páginas staff das
        # turmas, servidas dentro do namespace do admin (nginx de prod só
        # roteia /(api|dj-admin)/ pro Django; autenticação de graça via
        # admin_view — mesmo racional do subsistema 09).
        urls_customizadas = [
            path(
                "acervo/",
                self.admin_site.admin_view(self.acervo_marca_view),
                name="midia_midia_acervo_marca",
            ),
            path(
                "studio/",
                self.admin_site.admin_view(self.studio_marca_view),
                name="midia_midia_studio_marca",
            ),
        ]
        return urls_customizadas + super().get_urls()

    def _contexto_pagina_marca(self, request):
        return {
            **self.admin_site.each_context(request),
            "turma": None,  # os templates leem `turma` p/ decidir o modo
            "api_base": "/api/midia",
            "csrf_token": get_token(request),
        }

    def acervo_marca_view(self, request):
        return render(
            request, "midia/acervo.html", self._contexto_pagina_marca(request)
        )

    def studio_marca_view(self, request):
        return render(
            request, "midia/studio.html", self._contexto_pagina_marca(request)
        )


@admin.register(Postagem)
class PostagemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "titulo",
        "contexto_rotulo",
        "canal",
        "modo",
        "status",
        "agendada_para",
        "publicada_em",
        "criado_em",
    )
    list_filter = ("status", "modo", "canal", "turma__curso")
    search_fields = ("titulo", "turma__codigo", "curso__nome")
    autocomplete_fields = ("turma", "curso")
