from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.leads.views import CriarLeadPublicoView, LeadPainelViewSet

router = SimpleRouter()
router.register("painel/leads", LeadPainelViewSet, basename="painel-leads")

urlpatterns = [
    path("leads/", CriarLeadPublicoView.as_view(), name="leads-criar"),
] + router.urls
