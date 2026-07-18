"""Geração de thumbnail síncrona (Pillow) — só chamada para foto/arte, nunca
para vídeo (ver docs/subsistemas/09-acervo-studio-postagem.md)."""

import io
import os

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

LADO_MAXIMO = 480
QUALIDADE_JPEG = 80


def gerar_thumbnail(midia_turma, arquivo_upload):
    """Abre a imagem recém-enviada, corrige a orientação EXIF (OBRIGATÓRIO —
    fotos de celular vêm rotacionadas via tag EXIF, não via pixels) e grava
    em `midia_turma.thumb` um JPEG reduzido (máx. 480px no lado maior,
    qualidade 80). Não salva o model — quem chama decide quando persistir.
    """
    arquivo_upload.seek(0)
    imagem = Image.open(arquivo_upload)
    imagem = ImageOps.exif_transpose(imagem)
    if imagem.mode not in ("RGB", "L"):
        imagem = imagem.convert("RGB")
    imagem.thumbnail((LADO_MAXIMO, LADO_MAXIMO), Image.LANCZOS)

    buffer = io.BytesIO()
    imagem.save(buffer, format="JPEG", quality=QUALIDADE_JPEG)
    buffer.seek(0)

    nome_base = os.path.splitext(os.path.basename(arquivo_upload.name))[0]
    midia_turma.thumb.save(f"{nome_base}.jpg", ContentFile(buffer.read()), save=False)

    # devolve o ponteiro do arquivo original pro FileField salvar em seguida
    arquivo_upload.seek(0)


def extrair_meta(arquivo_upload):
    """Monta o dict `meta` (width/height/size/content_type) salvo em
    MidiaTurma.meta. width/height só saem preenchidos para imagem — vídeo
    não tem decodificação de dimensão aqui (sem libs extras)."""
    meta = {
        "content_type": getattr(arquivo_upload, "content_type", "") or "",
        "size": arquivo_upload.size,
    }
    if meta["content_type"].startswith("image/"):
        arquivo_upload.seek(0)
        try:
            with Image.open(arquivo_upload) as imagem:
                meta["width"], meta["height"] = imagem.size
        except Exception:
            pass
        arquivo_upload.seek(0)
    return meta
