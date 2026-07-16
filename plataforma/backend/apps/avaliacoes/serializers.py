from rest_framework import serializers

from apps.avaliacoes.models import Avaliacao, ConviteAvaliacao
from apps.cursos.models import Curso, Turma
from apps.cursos.serializers import FotoCursoPublicaSerializer


class AvaliacaoConvitePublicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Avaliacao
        fields = ["nome", "estrelas", "comentario", "cargo_atual"]


class ConviteAvaliacaoPublicoSerializer(serializers.Serializer):
    """Retrato do convite (curso + fotos p/ carrossel) para a tela de
    avaliação — espelha MatriculaConvitePublicoSerializer (apps/educacional)."""

    curso = serializers.CharField(source="curso.nome")
    turma_codigo = serializers.SerializerMethodField()
    nome_aluno = serializers.CharField()
    fotos = serializers.SerializerMethodField()

    def get_turma_codigo(self, convite):
        # turma é opcional (null=True) em ConviteAvaliacao — ao contrário de
        # Matricula.turma, não dá pra usar source="turma.codigo" direto.
        return convite.turma.codigo if convite.turma else None

    def get_fotos(self, convite):
        return FotoCursoPublicaSerializer(
            convite.curso.fotos.all(), many=True, context=self.context
        ).data


class AvaliacaoPainelSerializer(serializers.ModelSerializer):
    curso = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    curso_nome = serializers.CharField(source="curso.nome", read_only=True)
    turma_codigo = serializers.SerializerMethodField()

    class Meta:
        model = Avaliacao
        fields = [
            "id",
            "curso",
            "curso_nome",
            "turma_codigo",
            "nome",
            "cargo_atual",
            "estrelas",
            "comentario",
            "foto",
            "status",
            "peso",
            "exibir_na_home",
            "conteudo_origem",
            "criado_em",
        ]
        read_only_fields = [
            "id",
            "curso",
            "curso_nome",
            "turma_codigo",
            "nome",
            "cargo_atual",
            "estrelas",
            "comentario",
            "foto",
            "conteudo_origem",
            "criado_em",
        ]

    def get_turma_codigo(self, avaliacao):
        return avaliacao.turma.codigo if avaliacao.turma else None


class CriarConvitePainelSerializer(serializers.ModelSerializer):
    curso = serializers.SlugRelatedField(
        slug_field="slug", queryset=Curso.objects.all()
    )
    turma = serializers.PrimaryKeyRelatedField(
        queryset=Turma.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = ConviteAvaliacao
        fields = ["curso", "turma", "nome_aluno"]
