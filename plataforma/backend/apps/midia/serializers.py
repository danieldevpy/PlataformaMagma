from rest_framework import serializers

from config.drf import url_media_relativa

from apps.midia.models import MidiaTurma, Postagem


class ItemMidiaSerializer(serializers.ModelSerializer):
    """Shape `Item` do contrato da API (ver
    docs/subsistemas/09-acervo-studio-postagem.md) — arquivo/thumb saem como
    URL relativa (mesmo padrão MEDIA_URL_BASE do resto da API)."""

    arquivo_url = serializers.SerializerMethodField()
    thumb_url = serializers.SerializerMethodField()

    class Meta:
        model = MidiaTurma
        fields = [
            "id",
            "tipo",
            "arquivo_url",
            "thumb_url",
            "legenda",
            "tags",
            "ordem",
            "aula_data",
            "origem",
            "meta",
            "criado_em",
        ]

    def get_arquivo_url(self, midia):
        return url_media_relativa(midia.arquivo)

    def get_thumb_url(self, midia):
        return url_media_relativa(midia.thumb)


class ItemMidiaEditSerializer(serializers.ModelSerializer):
    """Campos editáveis via PATCH itens/<pk>/ — só o que a Mesa de Luz
    permite curar (legenda, tags, aula_data, ordem)."""

    class Meta:
        model = MidiaTurma
        fields = ["legenda", "tags", "aula_data", "ordem"]
        extra_kwargs = {campo: {"required": False} for campo in fields}


class PostagemSerializer(serializers.ModelSerializer):
    """Shape `PostagemOut` do contrato da API."""

    artes = ItemMidiaSerializer(many=True, read_only=True)

    class Meta:
        model = Postagem
        fields = [
            "id",
            "titulo",
            "legenda",
            "canal",
            "modo",
            "status",
            "url_publicada",
            "publicada_em",
            "artes",
            "criado_em",
        ]


class PostagemEditSerializer(serializers.ModelSerializer):
    """Campos editáveis via PATCH postagens/<pk>/ (atualizar_postagem)."""

    class Meta:
        model = Postagem
        fields = ["status", "url_publicada", "legenda", "titulo"]
        extra_kwargs = {campo: {"required": False} for campo in fields}
