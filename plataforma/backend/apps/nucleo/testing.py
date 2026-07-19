"""Helpers de teste compartilhados entre apps (spec 001, T1). Funções
puras chamadas explicitamente pelos `tests.py` de cada app — NÃO são
fixtures pytest (a suíte é `django.test.TestCase` nativo, ver
specs/001-suite-de-testes/plan.md). Import só em `tests.py`, nunca em
código de produção."""

import io

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework_simplejwt.tokens import RefreshToken

from apps.contas.models import Usuario
from apps.cursos.models import Curso, Turma


def criar_gestor(username="gestora-teste", **extra):
    return Usuario.objects.create_user(
        username=username,
        password="senha-teste-123",
        papel=Usuario.Papel.GESTOR,
        **extra,
    )


def criar_instrutor(username="instrutor-teste", **extra):
    return Usuario.objects.create_user(
        username=username,
        password="senha-teste-123",
        papel=Usuario.Papel.INSTRUTOR,
        **extra,
    )


def criar_curso_turma(slug="socorrista-aph-teste", curso_status=Curso.Status.PUBLICADO, **turma_extra):
    """Curso publicado + 1 turma dele — o par mínimo que a LP e o acervo
    precisam. `turma_extra` repassa pra `Turma.objects.create` (ex.:
    status=Turma.Status.INSCRICOES)."""
    curso = Curso.objects.create(
        slug=slug,
        nome="Socorrista APH",
        titulo_venda="Socorrista APH",
        subtitulo="Formação prática, direto no plantão.",
        carga_horaria=120,
        status=curso_status,
    )
    turma = Turma.objects.create(curso=curso, codigo="T001", **turma_extra)
    return curso, turma


def jpeg_em_memoria(nome="foto.jpg", tamanho=(30, 20), cor="#c8102e", exif_orientation=None):
    """JPEG real em memória via Pillow (nunca binário commitado). Tamanho
    default é retangular (não quadrado) de propósito: com
    `exif_orientation` setado, a correção de rotação em
    `apps.midia.utils.gerar_thumbnail` troca largura×altura — é assim que o
    teste de EXIF prova a correção (thumb muda de paisagem pra retrato)."""
    buffer = io.BytesIO()
    imagem = Image.new("RGB", tamanho, cor)
    if exif_orientation:
        exif = imagem.getexif()
        exif[0x0112] = exif_orientation  # tag EXIF "Orientation"
        imagem.save(buffer, format="JPEG", exif=exif.tobytes())
    else:
        imagem.save(buffer, format="JPEG")
    buffer.seek(0)
    return SimpleUploadedFile(nome, buffer.read(), content_type="image/jpeg")


def jwt_headers(usuario):
    """Header `Authorization: Bearer <access>` pra rotas que só aceitam JWT
    (ver nota abaixo). `force_login` (sessão) NÃO autentica nessas rotas —
    só midia/ia declaram `SessionAuthentication` explicitamente
    (apps/midia/views.py, apps/ia/views.py); as demais views de painel
    (cursos, leads, avaliacoes, nucleo/ConfigPainelView) usam só o
    `DEFAULT_AUTHENTICATION_CLASSES` global (JWTAuthentication), então
    dependem de token — divergência registrada em
    specs/001-suite-de-testes/tasks.md §Log (2026-07-19)."""
    token = RefreshToken.for_user(usuario).access_token
    return {"Authorization": f"Bearer {token}"}


def png_em_memoria(nome="arte.png", tamanho=(1080, 1080), cor="#232c3d"):
    """PNG real em memória — usado pras artes exportadas do Studio
    (postagem→ZIP, ver plan.md §T5)."""
    buffer = io.BytesIO()
    Image.new("RGB", tamanho, cor).save(buffer, format="PNG")
    buffer.seek(0)
    return SimpleUploadedFile(nome, buffer.read(), content_type="image/png")
