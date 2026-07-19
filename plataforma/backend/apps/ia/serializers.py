"""Serializers da página staff "Integrações de IA" (doc 10 §5.3). A
credencial NUNCA aparece de volta em texto puro — só o booleano
`tem_credencial` diz se já existe uma chave salva (mesmo espírito do
`ProvedorIAForm` do admin, agora pra consumo via API pela página nova)."""

from rest_framework import serializers

from apps.ia.models import ProvedorIA


class ProvedorIASerializer(serializers.ModelSerializer):
    """Leitura — nunca inclui `credencial` (nem cifrada)."""

    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    provedor_label = serializers.CharField(source="get_provedor_display", read_only=True)
    tem_credencial = serializers.SerializerMethodField()

    class Meta:
        model = ProvedorIA
        fields = [
            "id",
            "tipo",
            "tipo_label",
            "provedor",
            "provedor_label",
            "modelo",
            "config",
            "ativo",
            "testado_em",
            "criado_em",
            "tem_credencial",
        ]

    def get_tem_credencial(self, obj):
        return bool(obj.credencial)


class ProvedorIAEscritaSerializer(serializers.ModelSerializer):
    """Criação/edição — `credencial_nova` é write-only e opcional na edição
    (em branco mantém a chave já salva); obrigatória na criação (não existe
    chave anterior pra manter). Mesmo padrão do `ProvedorIAForm` do admin."""

    credencial_nova = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = ProvedorIA
        fields = ["tipo", "provedor", "modelo", "config", "ativo", "credencial_nova"]

    def validate(self, dados):
        if self.instance is None and not dados.get("credencial_nova"):
            raise serializers.ValidationError(
                {"credencial_nova": "Informe a chave de API."}
            )
        return dados

    def create(self, dados_validados):
        credencial_nova = dados_validados.pop("credencial_nova", "")
        dados_validados.setdefault("ativo", True)
        instancia = ProvedorIA(**dados_validados)
        instancia.set_credencial(credencial_nova)
        instancia.save()
        return instancia

    def update(self, instancia, dados_validados):
        credencial_nova = dados_validados.pop("credencial_nova", None)
        for campo, valor in dados_validados.items():
            setattr(instancia, campo, valor)
        if credencial_nova:
            instancia.set_credencial(credencial_nova)
        instancia.save()
        return instancia
