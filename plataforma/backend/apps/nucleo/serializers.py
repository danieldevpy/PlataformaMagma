from rest_framework import serializers

from apps.nucleo.models import ConfiguracaoSite

CAMPOS_CONFIG = [
    "whatsapp_principal",
    "instagram",
    "email",
    "endereco",
    "nota_google",
    "exibir_nota_google",
    "total_alunos_formados",
    "exibir_total_formados",
]


class ConfiguracaoSitePublicaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracaoSite
        fields = CAMPOS_CONFIG


class ConfiguracaoSitePainelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracaoSite
        fields = CAMPOS_CONFIG + ["conteudo_origem", "atualizado_em"]
        read_only_fields = ["conteudo_origem", "atualizado_em"]
