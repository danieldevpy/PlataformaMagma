from django.urls import path

from apps.financeiro.views import WebhookAsaasView

urlpatterns = [
    path("financeiro/webhook/asaas/", WebhookAsaasView.as_view(), name="financeiro-webhook-asaas"),
]
