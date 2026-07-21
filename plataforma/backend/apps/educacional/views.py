from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.educacional.models import Aluno, Matricula
from apps.educacional.serializers import (
    MatriculaConvitePublicoSerializer,
    PreencherCarteirinhaSerializer,
)


def motivo_invalidez(matricula):
    if matricula is None:
        return "inexistente"
    # depois de preenchida a carteirinha vira definitiva — só expira
    # o convite que nunca chegou a ser usado.
    if matricula.preenchida_em is None and matricula.expira_em < timezone.now():
        return "expirado"
    return None


class MatriculaConvitePublicoView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _buscar(self, token):
        return (
            Matricula.objects.select_related("turma__curso", "aluno")
            .filter(token=token)
            .first()
        )

    def get(self, request, token):
        matricula = self._buscar(token)
        motivo = motivo_invalidez(matricula)
        if motivo:
            return Response({"valido": False, "motivo": motivo})
        dados = MatriculaConvitePublicoSerializer(
            matricula, context={"request": request}
        ).data
        return Response({"valido": True, **dados})

    def post(self, request, token):
        matricula = self._buscar(token)
        motivo = motivo_invalidez(matricula)
        if motivo:
            mensagens = {
                "inexistente": "Convite de carteirinha não encontrado.",
                "expirado": "Este convite expirou. Peça um novo link para a equipe da Magma.",
            }
            return Response(
                {"detail": mensagens[motivo]}, status=status.HTTP_400_BAD_REQUEST
            )

        serializer = PreencherCarteirinhaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data

        # Turma toda: link compartilhado — preencher NUNCA mexe na Matrícula
        # do link em si (ela continua "em branco", disponível pro próximo
        # colega da turma abrir e preencher a dele). Em vez disso nasce uma
        # Matrícula individual nova, com sua própria carteirinha.
        alvo = (
            Matricula.objects.create(
                turma=matricula.turma,
                escopo=Matricula.Escopo.INDIVIDUAL,
                enviado_por=matricula.enviado_por,
                validade_carteirinha_meses=matricula.validade_carteirinha_meses,
            )
            if matricula.escopo == Matricula.Escopo.TURMA
            else matricula
        )

        aluno = alvo.aluno or Aluno()
        aluno.nome = dados["nome"]
        aluno.cpf = dados["cpf"]
        aluno.data_nascimento = dados["data_nascimento"]
        if dados.get("foto"):
            aluno.foto = dados["foto"]
        aluno.save()

        alvo.aluno = aluno
        alvo.status = Matricula.Status.ATIVA
        alvo.preenchida_em = timezone.now()
        alvo.save(update_fields=["aluno", "status", "preenchida_em", "atualizado_em"])

        dados_resposta = MatriculaConvitePublicoSerializer(
            alvo, context={"request": request}
        ).data
        return Response({"valido": True, **dados_resposta}, status=status.HTTP_201_CREATED)
