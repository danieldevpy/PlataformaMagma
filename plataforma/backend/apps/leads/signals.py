import json
import logging
import urllib.error
import urllib.request

from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.leads.models import Lead

logger = logging.getLogger(__name__)


def montar_payload(lead):
    return {
        "id": lead.pk,
        "nome": lead.nome,
        "whatsapp": lead.whatsapp,
        "curso": lead.curso.nome if lead.curso else None,
        "curso_slug": lead.curso.slug if lead.curso else None,
        "quando_pretende": lead.quando_pretende,
        "utm_source": lead.utm_source,
        "utm_campaign": lead.utm_campaign,
        "pagina_origem": lead.pagina_origem,
        "status": lead.status,
        "criado_em": lead.criado_em.isoformat(),
    }


@receiver(post_save, sender=Lead, dispatch_uid="lead_webhook_n8n")
def disparar_webhook_n8n(sender, instance, created, **kwargs):
    if not created:
        return
    webhook = getattr(settings, "N8N_LEAD_WEBHOOK", "")
    if not webhook:
        return
    try:
        requisicao = urllib.request.Request(
            webhook,
            data=json.dumps(montar_payload(instance)).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(requisicao, timeout=5) as resposta:
            logger.info(
                "Webhook n8n do lead %s enviado (HTTP %s)",
                instance.pk,
                resposta.status,
            )
    except (urllib.error.URLError, OSError, ValueError):
        logger.exception("Falha ao enviar webhook n8n do lead %s", instance.pk)
