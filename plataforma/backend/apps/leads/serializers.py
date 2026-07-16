from rest_framework import serializers

from apps.cursos.models import Curso
from apps.leads.models import Lead


class LeadPublicoSerializer(serializers.ModelSerializer):
    curso_slug = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, write_only=True
    )

    class Meta:
        model = Lead
        fields = [
            "nome",
            "whatsapp",
            "curso_slug",
            "quando_pretende",
            "utm_source",
            "utm_campaign",
            "pagina_origem",
        ]

    def create(self, validated_data):
        curso_slug = validated_data.pop("curso_slug", None)
        curso = Curso.objects.filter(slug=curso_slug).first() if curso_slug else None
        return Lead.objects.create(curso=curso, **validated_data)


class LeadPainelSerializer(serializers.ModelSerializer):
    curso = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    curso_nome = serializers.CharField(source="curso.nome", read_only=True)

    class Meta:
        model = Lead
        fields = [
            "id",
            "nome",
            "whatsapp",
            "curso",
            "curso_nome",
            "quando_pretende",
            "utm_source",
            "utm_campaign",
            "pagina_origem",
            "status",
            "criado_em",
        ]
        read_only_fields = [
            "id",
            "nome",
            "whatsapp",
            "curso",
            "curso_nome",
            "quando_pretende",
            "utm_source",
            "utm_campaign",
            "pagina_origem",
            "criado_em",
        ]
