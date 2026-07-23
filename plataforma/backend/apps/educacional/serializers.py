from rest_framework import serializers

from config.drf import RelativeMediaModelSerializer

from apps.educacional.models import Aluno, normalizar_cpf


class CarteirinhaAlunoSerializer(RelativeMediaModelSerializer):
    """Card digital do aluno (spec 014). A carteirinha (código/validade) e
    a identidade agora pertencem ao `Aluno` — um card por pessoa,
    acessível por `Aluno.token`. Inclui as matrículas (curso/turma/status)
    pra a tela mostrar onde a pessoa estuda/estudou."""

    token = serializers.CharField(read_only=True)
    url = serializers.CharField(read_only=True)
    matriculas = serializers.SerializerMethodField()

    class Meta:
        model = Aluno
        fields = [
            "token",
            "url",
            "nome",
            "cpf",
            "data_nascimento",
            "foto",
            "codigo_carteirinha",
            "validade_carteirinha",
            "matriculas",
        ]

    def get_matriculas(self, aluno):
        return [
            {
                "curso": matricula.turma.curso.nome,
                "turma_codigo": matricula.turma.codigo,
                "status": matricula.status,
            }
            for matricula in aluno.matriculas.select_related("turma__curso").order_by(
                "-criado_em"
            )
        ]


class PreencherCarteirinhaSerializer(serializers.Serializer):
    """Payload do cadastro de aluno novo (POST no link de cadastro da
    turma). Continua exigindo CPF de 11 dígitos e normaliza pra só dígitos
    antes de gravar (o dedup por CPF depende disso — ver
    `Aluno.buscar_ou_criar_por_cpf`)."""

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
        digitos = normalizar_cpf(value)
        if not digitos or len(digitos) != 11:
            raise serializers.ValidationError("CPF precisa ter 11 dígitos.")
        return digitos
