"""Helpers compartilhados de Django REST Framework."""

from django.db import models
from rest_framework import serializers


class RelativeMediaImageField(serializers.ImageField):
    """ImageField que serializa sempre a URL *relativa* do arquivo
    (ex.: ``/media/cursos/hero/x.jpg``), ignorando o host da request.

    Por quê: em produção o frontend (Next.js) faz fetch server-side na API
    pela rede interna do Docker (``http://backend:8000``). O ImageField
    padrão do DRF usa ``request.build_absolute_uri`` — a URL sairia como
    ``http://backend:8000/media/...``, inalcançável pelo navegador e fora do
    allowlist do next/image. A URL relativa resolve na mesma origem pública
    (o nginx do host serve ``/media/``), funcionando igual no SSR e no cliente.
    """

    def to_representation(self, value):
        if not value:
            return None
        try:
            return value.url
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
