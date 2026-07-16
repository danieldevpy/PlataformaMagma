from rest_framework import serializers

from apps.educacional.models import Aluno


class AlunoCarteirinhaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Aluno
        fields = ["nome", "cpf", "data_nascimento", "foto"]


class MatriculaConvitePublicoSerializer(serializers.Serializer):
    """Retrato do convite (preenchido ou não) para a tela da carteirinha."""

    curso = serializers.CharField(source="turma.curso.nome")
    turma_codigo = serializers.CharField(source="turma.codigo")
    codigo_carteirinha = serializers.CharField()
    validade_carteirinha = serializers.DateField()
    preenchida = serializers.SerializerMethodField()
    aluno = serializers.SerializerMethodField()

    def get_preenchida(self, matricula):
        return matricula.preenchida_em is not None

    def get_aluno(self, matricula):
        if not matricula.aluno:
            return None
        return AlunoCarteirinhaSerializer(
            matricula.aluno, context=self.context
        ).data


class PreencherCarteirinhaSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=120)
    cpf = serializers.CharField(max_length=14)
    data_nascimento = serializers.DateField()
    foto = serializers.ImageField(required=False, allow_null=True)

    def validate_nome(self, value):
        value = " ".join(value.split())
        if len(value) < 3:
            raise serializers.ValidationError("Informe o nome completo.")
        return value

    def validate_cpf(self, value):
        digitos = "".join(ch for ch in value if ch.isdigit())
        if len(digitos) != 11:
            raise serializers.ValidationError("CPF precisa ter 11 dígitos.")
        return value
