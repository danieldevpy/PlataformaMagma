"""View do webhook Asaas — ver plan.md §Webhook Asaas: primeiro endpoint de
webhook HTTP externo do projeto."""

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.financeiro.models import Cobranca, ConfiguracaoAsaas, EventoWebhookAsaas

MAPA_STATUS = {
    "PENDING": Cobranca.Status.PENDENTE,
    "RECEIVED": Cobranca.Status.PAGA,
    "CONFIRMED": Cobranca.Status.PAGA,
    "RECEIVED_IN_CASH": Cobranca.Status.PAGA,
    "OVERDUE": Cobranca.Status.VENCIDA,
    "REFUNDED": Cobranca.Status.ESTORNADA,
    "REFUND_REQUESTED": Cobranca.Status.ESTORNADA,
    "CANCELLED": Cobranca.Status.CANCELADA,
    "DELETED": Cobranca.Status.CANCELADA,
}


class WebhookAsaasView(APIView):
    """POST /api/financeiro/webhook/asaas/ — recebe notificação de mudança
    de status de cobrança. Autenticado por header `asaas-access-token`
    (token configurado no painel Asaas, comparado contra
    `ConfiguracaoAsaas.get_webhook_token()`), não por sessão/JWT — sem
    `SessionAuthentication`, CSRF não se aplica. Sempre responde 200 pra
    quem tem o token certo (mesmo cobrança desconhecida), pra não disparar
    reenvio agressivo do Asaas; token errado/ausente é o único caso de
    401."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if not self._token_valido(request.headers.get("asaas-access-token") or ""):
            return Response({"detail": "Token de webhook inválido."}, status=401)

        payload = request.data or {}
        evento = payload.get("event") or ""
        dados_pagamento = payload.get("payment") or {}
        asaas_id = dados_pagamento.get("id")

        cobranca = (
            Cobranca.objects.filter(asaas_id=asaas_id).first() if asaas_id else None
        )

        if cobranca is None:
            EventoWebhookAsaas.objects.create(
                evento=evento,
                payload=payload,
                status_processamento=EventoWebhookAsaas.StatusProcessamento.IGNORADO,
            )
            return Response(status=200)

        novo_status = MAPA_STATUS.get(dados_pagamento.get("status"))
        if novo_status:
            cobranca.status = novo_status
            cobranca.save(update_fields=["status", "atualizado_em"])

        EventoWebhookAsaas.objects.create(
            evento=evento,
            payload=payload,
            cobranca=cobranca,
            status_processamento=EventoWebhookAsaas.StatusProcessamento.PROCESSADO,
        )
        return Response(status=200)

    def _token_valido(self, token_recebido):
        if not token_recebido:
            return False
        for config in ConfiguracaoAsaas.objects.exclude(webhook_token=""):
            if config.get_webhook_token() == token_recebido:
                return True
        return False
