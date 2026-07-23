from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cursos.models import Turma
from apps.educacional.models import Aluno, Matricula
from apps.educacional.serializers import (
    CarteirinhaAlunoSerializer,
    PreencherCarteirinhaSerializer,
)

# Status de turma que aceitam cadastro de aluno novo pelo link público
# (spec 014): inscrições abertas ou turma já em andamento. Rascunho, lotada
# e encerrada recusam. Gate pelo campo `status` (ciclo de vida manual da
# turma), não pela property `lotada` calculada — vender/lotar por vaga é
# decisão do gestor, não bloqueio automático do cadastro.
STATUS_ACEITA_CADASTRO = {Turma.Status.INSCRICOES, Turma.Status.EM_ANDAMENTO}


class CadastroTurmaView(APIView):
    """Cadastro de aluno novo (spec 014). Resolve a turma pelo
    `token_cadastro` (link estável e reutilizável, um por turma — não mais
    a Matrícula-fantasma). GET devolve os dados pra montar a página; POST
    faz busca-ou-cria do Aluno por CPF e o matricula na turma."""

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _buscar(self, token):
        return (
            Turma.objects.select_related("curso").filter(token_cadastro=token).first()
        )

    def get(self, request, token):
        turma = self._buscar(token)
        if turma is None:
            return Response({"valido": False, "motivo": "inexistente"})
        if turma.status not in STATUS_ACEITA_CADASTRO:
            return Response({"valido": False, "motivo": "fechada"})
        return Response(
            {
                "valido": True,
                "turma_codigo": turma.codigo,
                "curso": turma.curso.nome,
            }
        )

    def post(self, request, token):
        turma = self._buscar(token)
        if turma is None:
            return Response(
                {"detail": "Link de cadastro não encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if turma.status not in STATUS_ACEITA_CADASTRO:
            return Response(
                {
                    "detail": (
                        "As inscrições desta turma não estão abertas. "
                        "Fale com a equipe da Magma pelo WhatsApp."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PreencherCarteirinhaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data

        # Busca-ou-cria por CPF: reabrir o cadastro com um CPF já existente
        # não duplica o Aluno — só adiciona a matrícula nova (dedup central
        # no model, ver Aluno.buscar_ou_criar_por_cpf).
        aluno, _criado = Aluno.buscar_ou_criar_por_cpf(
            dados["cpf"],
            defaults={
                "nome": dados["nome"],
                "data_nascimento": dados["data_nascimento"],
            },
        )
        if dados.get("foto"):
            aluno.foto = dados["foto"]
            aluno.save(update_fields=["foto", "atualizado_em"])

        # Matrícula ATIVA explícita — o default do model é CONVIDADO, que
        # NÃO conta vaga. get_or_create garante idempotência: reabrir o
        # link não estoura a UniqueConstraint (aluno, turma), só devolve a
        # matrícula que já existe.
        Matricula.objects.get_or_create(
            aluno=aluno,
            turma=turma,
            defaults={"status": Matricula.Status.ATIVA},
        )

        dados_resposta = CarteirinhaAlunoSerializer(
            aluno, context={"request": request}
        ).data
        return Response(
            {"valido": True, **dados_resposta}, status=status.HTTP_201_CREATED
        )


class CarteirinhaAlunoView(APIView):
    """Card digital do aluno (spec 014) — resolve por `Aluno.token`, um
    card por pessoa."""

    permission_classes = [AllowAny]

    def get(self, request, token):
        aluno = Aluno.objects.filter(token=token).first()
        if aluno is None:
            return Response({"valido": False, "motivo": "inexistente"})
        dados = CarteirinhaAlunoSerializer(aluno, context={"request": request}).data
        return Response({"valido": True, **dados})
