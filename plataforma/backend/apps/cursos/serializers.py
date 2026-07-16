from rest_framework import serializers

from config.drf import RelativeMediaModelSerializer

from apps.avaliacoes.models import Avaliacao
from apps.cursos.models import (
    AnotacaoTurma,
    Curso,
    FotoCurso,
    Habilidade,
    Instrutor,
    PerguntaFrequente,
    Turma,
)


def turma_destaque_de(curso):
    return (
        curso.turmas.filter(status=Turma.Status.INSCRICOES)
        .order_by("-criado_em")
        .first()
    )


class HabilidadePublicaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Habilidade
        fields = ["ordem", "icone", "titulo", "descricao"]


class PerguntaFrequentePublicaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerguntaFrequente
        fields = ["ordem", "pergunta", "resposta"]


class FotoCursoPublicaSerializer(RelativeMediaModelSerializer):
    class Meta:
        model = FotoCurso
        fields = ["ordem", "imagem", "legenda"]


class InstrutorPublicoSerializer(RelativeMediaModelSerializer):
    class Meta:
        model = Instrutor
        fields = ["nome", "registro", "especializacao", "foto"]


class TurmaDestaquePublicaSerializer(serializers.ModelSerializer):
    dias_e_horario = serializers.SerializerMethodField()
    countdown = serializers.SerializerMethodField()
    preco = serializers.SerializerMethodField()

    class Meta:
        model = Turma
        fields = [
            "codigo",
            "status",
            "inicio_aulas",
            "exibir_inicio",
            "dias_e_horario",
            "vagas_restantes",
            "exibir_vagas",
            "countdown",
            "preco",
        ]

    def get_dias_e_horario(self, turma):
        return turma.dias_e_horario or turma.curso.dias_e_horario_padrao

    def get_countdown(self, turma):
        if not turma.countdown_ativo:
            return None
        return {"ate": turma.countdown_ate, "rotulo": turma.rotulo_countdown}

    def get_preco(self, turma):
        if not turma.exibir_preco:
            return None
        return {
            "cheio": turma.preco_cheio,
            "avista": turma.preco_avista,
            "parcelas_qtd": turma.parcelas_qtd,
            "parcela_valor": turma.parcela_valor,
            "obs": turma.obs_pagamento,
        }


class AvaliacaoPublicaSerializer(serializers.ModelSerializer):
    turma_codigo = serializers.SerializerMethodField()

    class Meta:
        model = Avaliacao
        fields = ["nome", "cargo_atual", "estrelas", "comentario", "foto", "turma_codigo"]

    def get_turma_codigo(self, avaliacao):
        return avaliacao.turma.codigo if avaliacao.turma else None


class CursoListaPublicaSerializer(RelativeMediaModelSerializer):
    turma_destaque = serializers.SerializerMethodField()

    class Meta:
        model = Curso
        fields = [
            "slug",
            "nome",
            "carga_horaria",
            "subtitulo",
            "imagem_hero",
            "turma_destaque",
        ]

    def get_turma_destaque(self, curso):
        turma = turma_destaque_de(curso)
        if turma is None:
            return None
        return {"codigo": turma.codigo, "status": turma.status}


class CursoDetalhePublicoSerializer(RelativeMediaModelSerializer):
    habilidades = HabilidadePublicaSerializer(many=True, read_only=True)
    faqs = PerguntaFrequentePublicaSerializer(many=True, read_only=True)
    fotos = FotoCursoPublicaSerializer(many=True, read_only=True)
    instrutores = InstrutorPublicoSerializer(many=True, read_only=True)
    turma_destaque = serializers.SerializerMethodField()
    avaliacoes = serializers.SerializerMethodField()
    seo = serializers.SerializerMethodField()

    class Meta:
        model = Curso
        fields = [
            "slug",
            "nome",
            "titulo_venda",
            "titulo_destaque",
            "subtitulo",
            "imagem_hero",
            "carga_horaria",
            "formato",
            "dias_e_horario_padrao",
            "publico_alvo",
            "requisitos",
            "texto_pratica",
            "imagem_pratica",
            "texto_carreira",
            "imagem_carreira",
            "itens_inclusos",
            "saidas_profissionais",
            "habilidades",
            "faqs",
            "fotos",
            "instrutores",
            "turma_destaque",
            "avaliacoes",
            "seo",
        ]

    def get_turma_destaque(self, curso):
        turma = turma_destaque_de(curso)
        if turma is None:
            return None
        return TurmaDestaquePublicaSerializer(turma, context=self.context).data

    def get_avaliacoes(self, curso):
        aprovadas = curso.avaliacoes.filter(status=Avaliacao.Status.APROVADA)[:6]
        return AvaliacaoPublicaSerializer(
            aprovadas, many=True, context=self.context
        ).data

    def get_seo(self, curso):
        return {"titulo": curso.seo_titulo, "descricao": curso.seo_descricao}


class CursoPainelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Curso
        fields = "__all__"
        read_only_fields = ["conteudo_origem", "criado_em", "atualizado_em"]


class HabilidadePainelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Habilidade
        fields = ["id", "ordem", "icone", "titulo", "descricao", "conteudo_origem"]
        read_only_fields = ["conteudo_origem"]


class PerguntaFrequentePainelSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerguntaFrequente
        fields = ["id", "ordem", "pergunta", "resposta", "conteudo_origem"]
        read_only_fields = ["conteudo_origem"]


class TurmaPainelSerializer(serializers.ModelSerializer):
    curso = serializers.SlugRelatedField(
        slug_field="slug", queryset=Curso.objects.all()
    )

    class Meta:
        model = Turma
        fields = "__all__"
        read_only_fields = ["conteudo_origem", "criado_em", "atualizado_em"]


class AnotacaoTurmaPainelSerializer(serializers.ModelSerializer):
    autor = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = AnotacaoTurma
        fields = ["id", "texto", "autor", "criado_em"]
        read_only_fields = ["autor", "criado_em"]
