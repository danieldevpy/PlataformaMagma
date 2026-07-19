"""Settings da suíte de testes (spec 001, T1) — isola banco e mídia do
ambiente de dev: DB em memória (nunca `db.sqlite3` real) e `MEDIA_ROOT` num
diretório temporário (nunca `backend/media/` real). Rodar sempre com
`--settings=config.settings.test` (nunca a suíte sob `dev`/`prod`)."""

import atexit
import shutil
import tempfile

from .base import *  # noqa: F401,F403

DEBUG = False

ALLOWED_HOSTS = ["*"]

# Chave fixa (não lida de .env) — os testes de credencial cifrada de IA
# (Fernet deriva de SECRET_KEY, ver apps/ia/crypto.py) não podem depender
# do ambiente de quem roda a suíte.
SECRET_KEY = "django-test-secret-key-fixa-para-a-suite-nunca-usar-em-prod"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Diretório temporário próprio (não o MEDIA_ROOT de dev/prod) — qualquer
# teste que grave arquivo (thumb, upload de acervo) nunca toca
# `backend/media/` real. Limpo no fim do processo (atexit); o SO também
# recicla /tmp entre reboots.
_MEDIA_TESTE = tempfile.mkdtemp(prefix="magma-media-teste-")
MEDIA_ROOT = _MEDIA_TESTE
MEDIA_URL_BASE = ""
atexit.register(shutil.rmtree, _MEDIA_TESTE, ignore_errors=True)

# Hasher mais rápido — velocidade da suíte (nunca usado fora de teste).
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

if not CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS = ["http://localhost:3000"]
