"""Helpers compartilhados de Django REST Framework."""

from django.conf import settings
from django.db import models
from rest_framework import serializers


class RelativeMediaImageField(serializers.ImageField):
    """ImageField que serializa a URL do arquivo prefixada por
    ``settings.MEDIA_URL_BASE`` (ex.: ``/media/cursos/hero/x.jpg`` em prod,
    ``http://localhost:8000/media/cursos/hero/x.jpg`` em dev) — nunca usa o
    host da request atual.

    Por quê: em produção o frontend (Next.js) faz fetch server-side na API
    pela rede interna do Docker (``http://backend:8000``). O ImageField
    padrão do DRF usa ``request.build_absolute_uri`` — a URL sairia como
    ``http://backend:8000/media/...``, inalcançável pelo navegador e fora do
    allowlist do next/image. Com ``MEDIA_URL_BASE`` vazio (prod), a URL fica
    relativa e resolve na mesma origem pública (nginx serve ``/media/``
    junto com o site). Em dev, frontend (:3000) e backend (:8000) rodam em
    origens diferentes sem proxy unificando — por isso ``MEDIA_URL_BASE``
    vira absoluto lá (ver config/settings/dev.py), senão o navegador
    buscaria a imagem em :3000, onde ela não existe.
    """

    def to_representation(self, value):
        if not value:
            return None
        try:
            return f"{settings.MEDIA_URL_BASE}{value.url}"
        except ValueError:
            return None


class RelativeMediaModelSerializer(serializers.ModelSerializer):
    """ModelSerializer que emite URLs de mídia relativas.

    Basta herdar desta classe: qualquer ``models.ImageField`` incluído em
    ``Meta.fields`` passa a usar :class:`RelativeMediaImageField`
    automaticamente, sem precisar declarar campo por campo.
    """

    serializer_field_mapping = {
        **serializers.ModelSerializer.serializer_field_mapping,
        models.ImageField: RelativeMediaImageField,
    }
