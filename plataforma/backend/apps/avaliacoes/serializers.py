from rest_framework import serializers

from config.drf import RelativeMediaModelSerializer, url_media_relativa

from apps.avaliacoes.models import Avaliacao, ConviteAvaliacao
from apps.cursos.models import Curso, FotoCurso, Turma
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
        # Prioridade 1: acervo de mídia da turma (apps.midia) — fotos BRUTAS
        # (upload direto na Mesa de Luz) e ARTES já editadas (carrossel
        # publicado no Studio — mesmas peças que viram post no Instagram,
        # reaproveitadas aqui como "prova social" já pronta pra puxar
        # depoimento) com curadoria pra avaliação (tag "avaliacao") ou
        # destacadas (tag "destaque"), capa primeiro (ver docs/subsistemas/
        # 09-acervo-studio-postagem.md, Etapa 3). Mesmo shape
        # {ordem, imagem, legenda} do fallback — zero mudança no Next.
        fotos_acervo = self._fotos_do_acervo(convite)
        if fotos_acervo:
            return fotos_acervo
        # Fallback (comportamento anterior): fotos de formatura da turma do
        # aluno (mais pessoal, mostra a turma dele especificamente); sem
        # turma no convite ou sem fotos cadastradas pra ela, cai pras fotos
        # genéricas do curso (as mesmas usadas na LP — ver
        # CursoDetalhePublicoSerializer.get_fotos).
        fotos = convite.turma.fotos.all() if convite.turma else FotoCurso.objects.none()
        if not fotos:
            fotos = convite.curso.fotos.filter(turma__isnull=True)
        return FotoCursoPublicaSerializer(fotos, many=True, context=self.context).data

    def _fotos_do_acervo(self, convite):
        if not convite.turma:
            return []
        # Import protegido: se apps.midia sair do INSTALLED_APPS um dia, a
        # avaliação continua funcionando só com o fallback FotoCurso.
        try:
            from apps.midia.models import MidiaTurma
        except ImportError:
            return []
        # Filtro de tags em Python (não __contains de JSONField): dev roda
        # SQLite e prod MySQL, e o lookup se comporta diferente entre os
        # dois. O acervo de uma turma é pequeno — dá pra trazer as fotos e
        # peneirar aqui sem custo relevante.
        # tipo foto+arte (não video — carrossel de avaliação é só imagem):
        # arte entra pra reaproveitar o carrossel já editado do Studio como
        # repositório de "prova social" na avaliação, sem duplicar trabalho
        # de curadoria (o instrutor tagueia uma vez na Mesa de Luz e a peça
        # alimenta post do Instagram + avaliação ao mesmo tempo).
        fotos = [
            midia
            for midia in convite.turma.midias.filter(
                tipo__in=[MidiaTurma.Tipo.FOTO, MidiaTurma.Tipo.ARTE]
            )
            if "avaliacao" in midia.tags or "destaque" in midia.tags
        ]
        # Capa primeiro, depois pela ordem da Mesa de Luz (o queryset já vem
        # em ["ordem", "id"] via Meta.ordering — sort estável preserva isso).
        fotos.sort(key=lambda midia: 0 if "capa" in midia.tags else 1)
        # Sempre o ARQUIVO original, nunca a thumb — o carrossel da
        # avaliação exibe a foto grande.
        return [
            {
                "ordem": posicao,
                "imagem": url_media_relativa(midia.arquivo),
                "legenda": midia.legenda,
            }
            for posicao, midia in enumerate(fotos)
        ]


class AvaliacaoPainelSerializer(RelativeMediaModelSerializer):
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
        fields = ["curso", "turma", "escopo", "nome_aluno"]

    def validate(self, attrs):
        # Individual só faz sentido personalizado — sem nome, viraria um
        # link de turma disfarçado (sem o benefício de ser reutilizável).
        if attrs.get("escopo") == ConviteAvaliacao.Escopo.INDIVIDUAL and not attrs.get(
            "nome_aluno", ""
        ).strip():
            raise serializers.ValidationError(
                {"nome_aluno": "Obrigatório para convite de pessoa específica."}
            )
        return attrs
