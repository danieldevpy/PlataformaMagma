from rest_framework import serializers

from config.drf import url_media_relativa

from apps.midia.models import Midia, Postagem


class ItemMidiaSerializer(serializers.ModelSerializer):
    """Shape `Item` do contrato da API (ver
    docs/subsistemas/09-acervo-studio-postagem.md) — arquivo/thumb saem como
    URL relativa (mesmo padrão MEDIA_URL_BASE do resto da API)."""

    arquivo_url = serializers.SerializerMethodField()
    thumb_url = serializers.SerializerMethodField()

    contexto = serializers.SerializerMethodField()

    class Meta:
        model = Midia
        fields = [
            "id",
            "camada",
            "contexto",
            "tipo",
            "arquivo_url",
            "thumb_url",
            "legenda",
            "credito",
            "tags",
            "ordem",
            "aula_data",
            "origem",
            "meta",
            "criado_em",
        ]

    def get_contexto(self, midia):
        # rótulo humano da camada de origem ("Turma 027 — Socorrista APH",
        # nome do curso, "Geral da marca"…) — o picker multi-camada do
        # Studio mostra isso quando mistura fotos de escopos diferentes
        return midia.contexto_rotulo

    def get_arquivo_url(self, midia):
        return url_media_relativa(midia.arquivo)

    def get_thumb_url(self, midia):
        return url_media_relativa(midia.thumb)


class ItemMidiaEditSerializer(serializers.ModelSerializer):
    """Campos editáveis via PATCH itens/<pk>/ — só o que a Mesa de Luz
    permite curar (legenda, tags, aula_data, ordem, credito)."""

    class Meta:
        model = Midia
        fields = ["legenda", "tags", "aula_data", "ordem", "credito"]
        extra_kwargs = {campo: {"required": False} for campo in fields}


class PostagemSerializer(serializers.ModelSerializer):
    """Shape `PostagemOut` do contrato da API."""

    artes = ItemMidiaSerializer(many=True, read_only=True)
    contexto = serializers.SerializerMethodField()

    class Meta:
        model = Postagem
        fields = [
            "id",
            "contexto",
            "titulo",
            "legenda",
            "canal",
            "modo",
            "status",
            "url_publicada",
            "publicada_em",
            "agendada_para",
            "artes",
            "criado_em",
        ]

    def get_contexto(self, postagem):
        return postagem.contexto_rotulo


class PostagemEditSerializer(serializers.ModelSerializer):
    """Campos editáveis via PATCH postagens/<pk>/ (atualizar_postagem)."""

    class Meta:
        model = Postagem
        fields = ["status", "url_publicada", "legenda", "titulo", "agendada_para"]
        extra_kwargs = {campo: {"required": False} for campo in fields}
