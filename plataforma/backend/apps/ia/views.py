"""API `/api/ia/…` — proxy de execução de IA (ver
docs/subsistemas/10-studio-2.0.md §5). Mesmo padrão de auth/erro do app
`midia`: Session+JWT, `IsGestorOuInstrutor`, erros `{"detail": "..."}`. A
chave de API do provedor nunca sai do backend — o Studio só fala
"capacidade" (texto.gerar etc.), nunca o nome do provedor."""

import time

from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.contas.permissions import IsGestorOuInstrutor
from apps.ia.adapters import ErroAdaptadorIA, obter_adaptador
from apps.ia.models import ExecucaoIA, ProvedorIA
from apps.ia.serializers import ProvedorIAEscritaSerializer, ProvedorIASerializer

# Capacidades conhecidas pela plataforma → tipo de provedor que resolve
# cada uma (ver doc 10 §5.1). `audio.transcrever` é futuro (sem Tipo ainda)
# — fica de fora até a spec que o introduzir.
CAPACIDADES_CONHECIDAS = {
    "texto.gerar": ProvedorIA.Tipo.TEXTO,
    "texto.melhorar": ProvedorIA.Tipo.TEXTO,
    "texto.variacoes": ProvedorIA.Tipo.TEXTO,
    "imagem.melhorar": ProvedorIA.Tipo.IMAGEM,
    "imagem.remover_fundo": ProvedorIA.Tipo.IMAGEM,
    "imagem.gerar": ProvedorIA.Tipo.IMAGEM,
    "video.gerar": ProvedorIA.Tipo.VIDEO,
}

CAMPOS_RESUMO_CONTEXTO = ("tipo_conteudo", "template", "turma", "curso")


def resolver_provedor_ativo(tipo):
    """O provedor "vale" pra uma capacidade só se estiver ativo E já tiver
    passado no teste de conexão — provedor cadastrado mas nunca testado não
    acende o ✨ no Studio (evita 1ª chamada real do usuário quebrar)."""
    return (
        ProvedorIA.objects.filter(tipo=tipo, ativo=True)
        .exclude(testado_em=None)
        .order_by("-testado_em")
        .first()
    )


def capacidade_disponivel(capacidade):
    tipo = CAPACIDADES_CONHECIDAS.get(capacidade)
    if tipo is None:
        return False
    provedor = resolver_provedor_ativo(tipo)
    if provedor is None:
        return False
    try:
        adaptador = obter_adaptador(provedor)
    except ErroAdaptadorIA:
        return False
    return capacidade in adaptador.capacidades


def resumir_contexto(contexto):
    """String curta pra caber numa linha de admin — nunca o contexto
    inteiro (pode ter texto longo em `texto_atual`)."""
    partes = [
        str(contexto.get(campo))
        for campo in CAMPOS_RESUMO_CONTEXTO
        if contexto.get(campo)
    ]
    return " · ".join(partes)[:255]


def provedor_tipo_label(tipo):
    return dict(ProvedorIA.Tipo.choices).get(tipo, tipo)


class IaAPIView(APIView):
    """Base comum de toda /api/ia/ — mesmo padrão do `MidiaAPIView`."""

    authentication_classes = [SessionAuthentication, JWTAuthentication]
    permission_classes = [IsGestorOuInstrutor]


class CapacidadesView(IaAPIView):
    """GET capacidades/ — `{"texto.gerar": true, ...}` refletindo só
    provedores ativos e testados (sem provedor, tudo `false`)."""

    def get(self, request):
        return Response(
            {cap: capacidade_disponivel(cap) for cap in CAPACIDADES_CONHECIDAS}
        )


class ExecutarView(IaAPIView):
    """POST executar/ `{capacidade, contexto}` — resolve o provedor ativo
    do tipo da capacidade, chama o adaptador e grava `ExecucaoIA` (sucesso
    E erro, ver plan.md)."""

    def post(self, request):
        capacidade = (request.data.get("capacidade") or "").strip()
        contexto = request.data.get("contexto")
        if contexto is None:
            contexto = {}

        if not capacidade:
            return Response({"detail": "Informe 'capacidade'."}, status=400)
        if not isinstance(contexto, dict):
            return Response({"detail": "'contexto' precisa ser um objeto."}, status=400)

        tipo = CAPACIDADES_CONHECIDAS.get(capacidade)
        if tipo is None:
            return Response(
                {"detail": f'Capacidade "{capacidade}" desconhecida.'}, status=400
            )

        provedor = resolver_provedor_ativo(tipo)
        if provedor is None:
            return Response(
                {
                    "detail": (
                        f"Nenhum provedor de {provedor_tipo_label(tipo)} configurado "
                        "e testado. Configure em Integrações de IA."
                    )
                },
                status=400,
            )

        try:
            adaptador = obter_adaptador(provedor)
        except ErroAdaptadorIA as erro:
            return Response({"detail": str(erro)}, status=400)

        if capacidade not in adaptador.capacidades:
            return Response(
                {"detail": f'O provedor configurado não sabe executar "{capacidade}".'},
                status=400,
            )

        usuario = request.user if request.user.is_authenticated else None
        contexto_resumo = resumir_contexto(contexto)
        inicio = time.monotonic()
        try:
            resultado = adaptador.executar(capacidade, contexto)
        except ErroAdaptadorIA as erro:
            self._registrar_erro(provedor, capacidade, contexto_resumo, inicio, usuario, str(erro))
            return Response({"detail": str(erro)}, status=502)
        except Exception:  # nunca vazar 500 cru pro Studio (doc 10 §10)
            self._registrar_erro(
                provedor,
                capacidade,
                contexto_resumo,
                inicio,
                usuario,
                "Erro inesperado ao executar a IA.",
            )
            return Response({"detail": "Erro inesperado ao executar a IA."}, status=502)

        duracao_ms = int((time.monotonic() - inicio) * 1000)
        ExecucaoIA.objects.create(
            provedor=provedor,
            capacidade=capacidade,
            contexto_resumo=contexto_resumo,
            tokens_entrada=resultado.get("tokens_entrada"),
            tokens_saida=resultado.get("tokens_saida"),
            duracao_ms=duracao_ms,
            status=ExecucaoIA.Status.OK,
            usuario=usuario,
        )
        return Response({"resultado": resultado.get("resultado", "")})

    @staticmethod
    def _registrar_erro(provedor, capacidade, contexto_resumo, inicio, usuario, mensagem_erro):
        duracao_ms = int((time.monotonic() - inicio) * 1000)
        ExecucaoIA.objects.create(
            provedor=provedor,
            capacidade=capacidade,
            contexto_resumo=contexto_resumo,
            duracao_ms=duracao_ms,
            status=ExecucaoIA.Status.ERRO,
            erro=mensagem_erro,
            usuario=usuario,
        )


class TestarProvedorView(IaAPIView):
    """POST provedores/<pk>/testar/ — chamada mínima real; seta
    `testado_em` só se a chamada funcionar."""

    def post(self, request, pk):
        provedor = get_object_or_404(ProvedorIA, pk=pk)
        try:
            adaptador = obter_adaptador(provedor)
            adaptador.testar()
        except ErroAdaptadorIA as erro:
            return Response({"detail": str(erro)}, status=400)
        except Exception:
            return Response(
                {"detail": "Erro inesperado ao testar a conexão."}, status=502
            )

        provedor.testado_em = timezone.now()
        provedor.save(update_fields=["testado_em", "atualizado_em"])
        return Response({"testado_em": provedor.testado_em})


class ProvedoresView(IaAPIView):
    """GET/POST provedores/ — alimenta a página staff "Integrações de IA"
    (doc 10 §5.3): lista todos os provedores cadastrados (sem credencial em
    texto puro, ver serializers.py) e cria um novo. Como `ProvedorIA.save`
    só deixa 1 ativo por tipo, o item mais recente/ativo de cada tipo (1º
    da ordenação padrão do model) é "o provedor atual" daquele tipo na UI."""

    def get(self, request):
        provedores = ProvedorIA.objects.all()
        return Response(ProvedorIASerializer(provedores, many=True).data)

    def post(self, request):
        serializer = ProvedorIAEscritaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        provedor = serializer.save()
        return Response(ProvedorIASerializer(provedor).data, status=201)


class ProvedorDetailView(IaAPIView):
    """PATCH provedores/<pk>/ — edita modelo/config/ativo e, opcionalmente,
    rotaciona a credencial (em branco/ausente mantém a chave já salva,
    mesmo padrão write-only do `ProvedorIAForm` do admin)."""

    def patch(self, request, pk):
        provedor = get_object_or_404(ProvedorIA, pk=pk)
        serializer = ProvedorIAEscritaSerializer(provedor, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        provedor = serializer.save()
        return Response(ProvedorIASerializer(provedor).data)


class UsoMensalView(IaAPIView):
    """GET uso/ — card de uso da página staff: contagem de execuções e
    tokens do mês corrente (via `ExecucaoIA`), pra Daniel nunca ter
    surpresa na fatura do provedor (doc 10 §5.3/§10)."""

    def get(self, request):
        inicio_mes = timezone.now().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        agregados = ExecucaoIA.objects.filter(criado_em__gte=inicio_mes).aggregate(
            total=Count("id"),
            ok=Count("id", filter=Q(status=ExecucaoIA.Status.OK)),
            erro=Count("id", filter=Q(status=ExecucaoIA.Status.ERRO)),
            tokens_entrada=Sum("tokens_entrada"),
            tokens_saida=Sum("tokens_saida"),
        )
        return Response(
            {
                "mes_referencia": inicio_mes.strftime("%Y-%m"),
                "execucoes": agregados["total"] or 0,
                "execucoes_ok": agregados["ok"] or 0,
                "execucoes_erro": agregados["erro"] or 0,
                "tokens_entrada": agregados["tokens_entrada"] or 0,
                "tokens_saida": agregados["tokens_saida"] or 0,
            }
        )
