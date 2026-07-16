from .base import *  # noqa: F401,F403

DEBUG = True

ALLOWED_HOSTS = ["*"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

if not CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS = ["http://localhost:3000"]

# Backend roda em :8000, frontend em :3000 — sem proxy unificando origem
# como em prod (nginx), então a API precisa devolver a URL de mídia
# completa, senão o navegador tentaria buscar a imagem em :3000.
MEDIA_URL_BASE = env.str("MEDIA_URL_BASE", default="http://localhost:8000")
