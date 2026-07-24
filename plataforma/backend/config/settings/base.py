"""
Configurações base do projeto Magma — compartilhadas por dev e prod.
Ver docs/plataforma/01-arquitetura.md e docs/plataforma/02-backend-django.md.
"""

from datetime import timedelta
from pathlib import Path

from environs import Env

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = Env()
env.read_env(BASE_DIR / ".env")

SECRET_KEY = env.str("DJANGO_SECRET_KEY", default="django-insecure-troque-em-producao")

FRONTEND_URL = env.str("FRONTEND_URL", default="http://localhost:3000")
N8N_LEAD_WEBHOOK = env.str("N8N_LEAD_WEBHOOK", default="")

INSTALLED_APPS = [
    "jazzmin",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "apps.contas",
    "apps.nucleo",
    "apps.cursos",
    "apps.avaliacoes",
    "apps.leads",
    "apps.educacional",
    "apps.midia",
    "apps.ia",
    "apps.financeiro",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Jazzmin (tema do admin) usa related_modal_active=True: os popups de "+
# adicionar objeto relacionado" abrem como modal com <iframe> pro próprio
# admin. O padrão do Django (DENY) bloqueia até o site se exibir em iframe
# nele mesmo — SAMEORIGIN libera isso mantendo a proteção contra
# clickjacking de outros domínios.
X_FRAME_OPTIONS = "SAMEORIGIN"

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

AUTH_USER_MODEL = "contas.Usuario"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"

TIME_ZONE = "America/Sao_Paulo"

USE_I18N = True

USE_TZ = True

STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
# Destino do collectstatic (prod). Precisa ser diferente de STATICFILES_DIRS.
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# Prefixo aplicado às URLs de mídia devolvidas pela API (ver
# RelativeMediaImageField em config/drf.py). Vazio em prod: nginx serve
# frontend e backend na mesma origem, então "/media/..." relativo já
# resolve certo (e evita o host errado num fetch interno Docker). Em dev
# (config/settings/dev.py) vira absoluto porque frontend (:3000) e backend
# (:8000) rodam em portas/origens diferentes sem proxy unificando — uma URL
# relativa buscaria a imagem no :3000, onde ela não existe.
MEDIA_URL_BASE = env.str("MEDIA_URL_BASE", default="")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    "DEFAULT_PAGINATION_CLASS": None,
    "COERCE_DECIMAL_TO_STRING": False,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

# ---------------------------------------------------------------------------
# Django Admin (Jazzmin) — reskinado com o Design System Magma Cursos.
# Cores/fontes/raios vêm de static/admin/css/magma-tokens.css (espelho de
# design-system/tokens/tokens.css). Ver static/admin/css/magma-admin.css
# para a personalização visual completa.
# ---------------------------------------------------------------------------
JAZZMIN_SETTINGS = {
    "site_title": "Magma Admin",
    "site_header": "Magma Cursos",
    "site_brand": "Magma Cursos",
    "site_logo": "branding/simbolo-magma.svg",
    "login_logo": "branding/logo-vertical.svg",
    "site_logo_classes": "magma-brand-image",
    "site_icon": "branding/simbolo-magma.svg",
    "welcome_sign": "Painel administrativo Magma Cursos",
    "copyright": "Curso Magma LTDA",
    "search_model": ["cursos.Curso", "leads.Lead"],
    "user_avatar": None,
    "topmenu_links": [
        {"name": "Ver site", "url": "/", "new_window": True, "icon": "fas fa-globe"},
    ],
    "usermenu_links": [],
    "show_sidebar": True,
    "navigation_expanded": True,
    "hide_apps": [],
    "hide_models": [],
    "order_with_respect_to": [
        "contas",
        "leads",
        "cursos",
        "avaliacoes",
        "nucleo",
        "auth",
    ],
    "custom_links": {},
    "icons": {
        "auth": "fas fa-users-cog",
        "auth.Group": "fas fa-users",
        "contas": "fas fa-user-shield",
        "contas.Usuario": "fas fa-user",
        "nucleo": "fas fa-sliders-h",
        "nucleo.ConfiguracaoSite": "fas fa-cog",
        "cursos": "fas fa-graduation-cap",
        "cursos.Curso": "fas fa-book-medical",
        "cursos.Turma": "fas fa-chalkboard-teacher",
        "cursos.Instrutor": "fas fa-user-md",
        "cursos.Habilidade": "fas fa-tasks",
        "cursos.PerguntaFrequente": "fas fa-circle-question",
        "cursos.AnotacaoTurma": "fas fa-sticky-note",
        "avaliacoes": "fas fa-star",
        "avaliacoes.Avaliacao": "fas fa-star-half-alt",
        "avaliacoes.ConviteAvaliacao": "fas fa-envelope-open-text",
        "leads": "fas fa-bullseye",
        "leads.Lead": "fas fa-user-plus",
    },
    "default_icon_parents": "fas fa-chevron-circle-right",
    "default_icon_children": "fas fa-circle",
    "related_modal_active": True,
    "custom_css": "admin/css/magma-admin.css",
    "custom_js": None,
    "use_google_fonts_cdn": False,
    "show_ui_builder": False,
    "show_theme_chooser": False,
    "changeform_format": "horizontal_tabs",
    "changeform_format_overrides": {},
    "language_chooser": False,
}

JAZZMIN_UI_TWEAKS = {
    "navbar_small_text": False,
    "footer_small_text": True,
    "body_small_text": False,
    "brand_small_text": False,
    "brand_colour": False,
    "accent": "accent-primary",
    "navbar": "navbar-light",
    "no_navbar_border": True,
    "navbar_fixed": True,
    "layout_boxed": False,
    "footer_fixed": False,
    "sidebar_fixed": True,
    "sidebar": "sidebar-dark-primary",
    "sidebar_nav_small_text": False,
    "sidebar_disable_expand": False,
    "sidebar_nav_child_indent": True,
    "sidebar_nav_compact_style": False,
    "sidebar_nav_legacy_style": False,
    "sidebar_nav_flat_style": True,
    "actions_sticky_top": True,
    "theme": "default",
    "default_theme_mode": "light",
    "button_classes": {
        "primary": "btn-primary",
        "secondary": "btn-outline-secondary",
        "info": "btn-info",
        "warning": "btn-warning",
        "danger": "btn-danger",
        "success": "btn-success",
    },
}
