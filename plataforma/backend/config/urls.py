from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

admin.site.site_header = "Magma Cursos"
admin.site.site_title = "Magma Admin"
admin.site.index_title = "Painel administrativo"

urlpatterns = [
    path("dj-admin/", admin.site.urls),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/", include("apps.nucleo.urls")),
    path("api/", include("apps.cursos.urls")),
    path("api/", include("apps.avaliacoes.urls")),
    path("api/", include("apps.leads.urls")),
    path("api/", include("apps.educacional.urls")),
    path("api/", include("apps.midia.urls")),
    path("api/", include("apps.ia.urls")),
    path("api/", include("apps.financeiro.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
