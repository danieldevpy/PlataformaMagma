import dj_database_url

from .base import *  # noqa: F401,F403

DEBUG = False

ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])

DATABASES = {
    "default": dj_database_url.parse(env.str("DATABASE_URL"))
}

CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])

# Fica False enquanto você só testa pelo IP da VPS sem certificado TLS
# (SECURE_SSL_REDIRECT/cookies "secure" quebrariam o acesso via http://IP).
# Vire DJANGO_HTTPS_ENABLED=true no .env assim que o domínio tiver HTTPS
# (nginx + certbot, ou proxy equivalente) na frente.
HTTPS_ENABLED = env.bool("DJANGO_HTTPS_ENABLED", default=False)

SECURE_SSL_REDIRECT = HTTPS_ENABLED
SESSION_COOKIE_SECURE = HTTPS_ENABLED
CSRF_COOKIE_SECURE = HTTPS_ENABLED
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30 if HTTPS_ENABLED else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = HTTPS_ENABLED
SECURE_HSTS_PRELOAD = HTTPS_ENABLED
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
