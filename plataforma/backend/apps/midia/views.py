"""API `/api/midia/…` — Acervo da Turma, Studio e Postagens (ver
docs/subsistemas/09-acervo-studio-postagem.md, seção "Contrato da API").
Mesma API atende o fluxo manual (Mesa de Luz/Studio) e, no futuro, um
agente — por isso o catálogo descritivo em `GET acoes/`.
"""

import io
import os
import zipfile

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.contas.permissions import IsGestorOuInstrutor
from apps.cursos.models import Turma
from apps.midia.models import MidiaTurma, Postagem
from apps.midia.serializers import (
    ItemMidiaEditSerializer,
    ItemMidiaSerializer,
    PostagemEditSerializer,
    PostagemSerializer,
)
from apps.midia.utils import extrair_meta, gerar_thumbnail

# "máx 1GB" (ver spec) — vale tanto pro upload de mídia bruta quanto pras
# artes exportadas do Studio.
TAMANHO_MAXIMO_BYTES = 1024 * 1024 * 1024


def tipo_por_content_type(content_type):
    """Mapeia o content-type do upload pro Tipo de MidiaTurma — só
    foto/vídeo entram por aqui (arte só nasce via Studio, ver
    PostagensTurmaView.post)."""
    if content_type.startswith("image/"):
        return MidiaTurma.Tipo.FOTO
    if content_type.startswith("video/"):
        return MidiaTurma.Tipo.VIDEO
    return None


def encontrar_duplicata(turma, nome_original, tamanho):
    """Procura no acervo da turma um item de foto/vídeo com o mesmo nome de
    arquivo (case-insensitive) e tamanho em bytes — sinal simples e barato
    (sem ler conteúdo) pra pegar o caso comum de reenvio acidental (Mesa de
    Luz já faz essa mesma checagem no cliente antes de subir o arquivo; isto
    aqui é o backstop server-side — pega tabs concorrentes ou uploads via
    API direta). Filtra em Python (não `meta__nome_original=`) — `meta` é
    JSONField e lookups nele se comportam diferente entre SQLite (dev) e
    MySQL (prod), mesma lição do get_fotos da avaliação."""
    nome_alvo = (nome_original or "").strip().lower()
    candidatos = turma.midias.filter(
        tipo__in=[MidiaTurma.Tipo.FOTO, MidiaTurma.Tipo.VIDEO]
    )
    for midia in candidatos:
        meta = midia.meta or {}
        if (
            (meta.get("nome_original") or "").strip().lower() == nome_alvo
            and meta.get("size") == tamanho
        ):
            return midia
    return None


def valor_verdadeiro(bruto):
    """Interpreta um valor de form-data (sempre string) como booleano —
    usado pro flag `forcar` de enviar_midia."""
    return str(bruto or "").strip().lower() in ("1", "true", "on", "sim")


class MidiaAPIView(APIView):
    """Base comum de toda /api/midia/ — sessão (admin embutido) ou JWT
    (consumo externo/agente), liberado só pra gestor/instrutor."""

    authentication_classes = [SessionAuthentication, JWTAuthentication]
    permission_classes = [IsGestorOuInstrutor]


class AcervoTurmaView(MidiaAPIView):
    """GET turmas/<id>/acervo/ — listar_acervo."""

    def get(self, request, turma_id):
        turma = get_object_or_404(Turma, pk=turma_id)
        itens = list(turma.midias.all())
        contagens = {
            "fotos": sum(1 for i in itens if i.tipo == MidiaTurma.Tipo.FOTO),
            "videos": sum(1 for i in itens if i.tipo == MidiaTurma.Tipo.VIDEO),
            "artes": sum(1 for i in itens if i.tipo == MidiaTurma.Tipo.ARTE),
            "destaque": sum(1 for i in itens if "destaque" in i.tags),
            "capa": sum(1 for i in itens if "capa" in i.tags),
            "avaliacao": sum(1 for i in itens if "avaliacao" in i.tags),
        }
        return Response(
            {
                "turma": {
                    "id": turma.id,
                    "codigo": turma.codigo,
                    "curso": turma.curso.nome,
                    "consentimento_midia": turma.consentimento_midia,
                },
                "itens": ItemMidiaSerializer(
                    itens, many=True, context={"request": request}
                ).data,
                "contagens": contagens,
            }
        )


class EnviarMidiaView(MidiaAPIView):
    """POST turmas/<id>/enviar/ — enviar_midia. Um arquivo por request
    (upload sequencial no cliente via XHR, com progresso real por arquivo)."""

    parser_classes = [MultiPartParser]

    def post(self, request, turma_id):
        turma = get_object_or_404(Turma, pk=turma_id)
        arquivo = request.FILES.get("arquivo")
        if not arquivo:
            return Response({"detail": "Envie um arquivo em 'arquivo'."}, status=400)

        content_type = arquivo.content_type or ""
        tipo = tipo_por_content_type(content_type)
        if tipo is None:
            return Response(
                {"detail": "Arquivo precisa ser imagem ou vídeo."}, status=400
            )
        if arquivo.size > TAMANHO_MAXIMO_BYTES:
            return Response(
                {"detail": "Arquivo excede o tamanho máximo de 1 GB."}, status=400
            )

        forcar = valor_verdadeiro(request.data.get("forcar"))
        if not forcar:
            duplicata = encontrar_duplicata(turma, arquivo.name, arquivo.size)
            if duplicata is not None:
                return Response(
                    {
                        "detail": f'Já existe "{arquivo.name}" no acervo (mesmo nome e tamanho).',
                        "duplicado": True,
                        "item_existente": ItemMidiaSerializer(
                            duplicata, context={"request": request}
                        ).data,
                    },
                    status=409,
                )

        aula_data_bruta = request.data.get("aula_data")
        midia = MidiaTurma(
            turma=turma,
            tipo=tipo,
            legenda=request.data.get("legenda", ""),
            aula_data=parse_date(aula_data_bruta) if aula_data_bruta else None,
            origem=MidiaTurma.Origem.INSTRUTOR,
            meta=extrair_meta(arquivo),
        )
        midia.arquivo = arquivo
        if tipo in (MidiaTurma.Tipo.FOTO, MidiaTurma.Tipo.ARTE):
            gerar_thumbnail(midia, arquivo)
        midia.save()

        return Response(
            ItemMidiaSerializer(midia, context={"request": request}).data, status=201
        )


class ItemMidiaView(MidiaAPIView):
    """PATCH/DELETE itens/<pk>/ — editar_item / remover_item."""

    def patch(self, request, pk):
        midia = get_object_or_404(MidiaTurma, pk=pk)
        serializer = ItemMidiaEditSerializer(midia, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ItemMidiaSerializer(midia, context={"request": request}).data)

    def delete(self, request, pk):
        midia = get_object_or_404(MidiaTurma, pk=pk)
        # Apaga os arquivos físicos junto — storage é local na VPS (sem
        # lifecycle de bucket cuidando de lixo órfão pra gente).
        if midia.arquivo:
            midia.arquivo.delete(save=False)
        if midia.thumb:
            midia.thumb.delete(save=False)
        midia.delete()
        return Response(status=204)


class ReordenarView(MidiaAPIView):
    """POST turmas/<id>/reordenar/ — reordenar."""

    def post(self, request, turma_id):
        turma = get_object_or_404(Turma, pk=turma_id)
        ids = request.data.get("ids")
        if not isinstance(ids, list):
            return Response({"detail": "Envie 'ids' como lista."}, status=400)
        for posicao, item_id in enumerate(ids):
            MidiaTurma.objects.filter(pk=item_id, turma=turma).update(ordem=posicao)
        return Response({"ok": True})


class ConsentimentoView(MidiaAPIView):
    """POST turmas/<id>/consentimento/ — consentimento."""

    def post(self, request, turma_id):
        turma = get_object_or_404(Turma, pk=turma_id)
        ativo = request.data.get("ativo")
        if not isinstance(ativo, bool):
            return Response({"detail": "Envie 'ativo' como booleano."}, status=400)

        turma.consentimento_midia = ativo
        # Registra o instante da concessão; ao revogar, zera — não existe
        # campo separado de "revogado_em" pra guardar esse outro histórico.
        turma.consentimento_midia_em = timezone.now() if ativo else None
        turma.save(
            update_fields=[
                "consentimento_midia",
                "consentimento_midia_em",
                "atualizado_em",
            ]
        )
        return Response(
            {
                "consentimento_midia": turma.consentimento_midia,
                "consentimento_midia_em": turma.consentimento_midia_em,
            }
        )


class PostagensTurmaView(MidiaAPIView):
    """GET/POST turmas/<id>/postagens/ — listar_postagens / criar_postagem."""

    parser_classes = [MultiPartParser]

    def get(self, request, turma_id):
        turma = get_object_or_404(Turma, pk=turma_id)
        postagens = turma.postagens.all()
        return Response(
            PostagemSerializer(
                postagens, many=True, context={"request": request}
            ).data
        )

    def post(self, request, turma_id):
        turma = get_object_or_404(Turma, pk=turma_id)
        titulo = (request.data.get("titulo") or "").strip()
        legenda = request.data.get("legenda", "")
        artes = request.FILES.getlist("artes")

        if not titulo:
            return Response({"detail": "Informe o título da postagem."}, status=400)
        if not artes:
            return Response(
                {"detail": "Envie ao menos uma arte em 'artes'."}, status=400
            )
        for arte in artes:
            content_type = arte.content_type or ""
            if not content_type.startswith("image/"):
                return Response(
                    {"detail": "Todas as artes precisam ser imagens (PNG)."},
                    status=400,
                )
            if arte.size > TAMANHO_MAXIMO_BYTES:
                return Response(
                    {"detail": "Arte excede o tamanho máximo de 1 GB."}, status=400
                )

        postagem = Postagem.objects.create(turma=turma, titulo=titulo, legenda=legenda)
        for posicao, arte in enumerate(artes):
            midia = MidiaTurma(
                turma=turma,
                tipo=MidiaTurma.Tipo.ARTE,
                origem=MidiaTurma.Origem.STUDIO,
                ordem=posicao,
                postagem=postagem,
                meta=extrair_meta(arte),
            )
            midia.arquivo = arte
            gerar_thumbnail(midia, arte)
            midia.save()

        return Response(
            PostagemSerializer(postagem, context={"request": request}).data,
            status=201,
        )


class PostagemDetailView(MidiaAPIView):
    """PATCH postagens/<pk>/ — atualizar_postagem."""

    def patch(self, request, pk):
        postagem = get_object_or_404(Postagem, pk=pk)
        vira_publicada = (
            request.data.get("status") == Postagem.Status.PUBLICADA
            and postagem.status != Postagem.Status.PUBLICADA
        )
        serializer = PostagemEditSerializer(postagem, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        extras = {"publicada_em": timezone.now()} if vira_publicada else {}
        serializer.save(**extras)
        return Response(
            PostagemSerializer(postagem, context={"request": request}).data
        )


class PostagemZipView(MidiaAPIView):
    """GET postagens/<pk>/zip/ — baixar_artes. Monta o ZIP em memória
    (io.BytesIO) — nada de arquivo temporário em disco."""

    def get(self, request, pk):
        postagem = get_object_or_404(Postagem, pk=pk)
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zip_arquivo:
            for indice, arte in enumerate(postagem.artes.all(), start=1):
                if not arte.arquivo:
                    continue
                nome = os.path.basename(arte.arquivo.name) or f"arte-{indice}.png"
                with arte.arquivo.open("rb") as arquivo_aberto:
                    zip_arquivo.writestr(nome, arquivo_aberto.read())
        buffer.seek(0)

        resposta = HttpResponse(buffer.getvalue(), content_type="application/zip")
        resposta["Content-Disposition"] = (
            f'attachment; filename="postagem-{postagem.pk}-artes.zip"'
        )
        return resposta


CATALOGO_ACOES = [
    {
        "nome": "listar_acervo",
        "metodo": "GET",
        "rota": "/api/midia/turmas/<id>/acervo/",
        "parametros": {},
        "descricao": "Lista os itens de mídia da turma e as contagens por tipo/tag.",
    },
    {
        "nome": "enviar_midia",
        "metodo": "POST",
        "rota": "/api/midia/turmas/<id>/enviar/",
        "parametros": {
            "arquivo": "multipart, 1 arquivo (image/* ou video/*, máx 1GB)",
            "legenda": "string, opcional",
            "aula_data": "date (YYYY-MM-DD), opcional",
            "forcar": "'1'/'true', opcional — ignora a checagem de duplicado",
        },
        "descricao": (
            "Envia uma foto ou vídeo pro acervo da turma; gera thumb síncrono "
            "se for foto. Antes de salvar, checa se já existe item de foto/"
            "vídeo com mesmo nome de arquivo + tamanho (dedup barato, sem ler "
            "conteúdo) — se achar, responde 409 {duplicado:true, item_existente} "
            "em vez de criar; envie forcar=1 pra subir mesmo assim."
        ),
    },
    {
        "nome": "editar_item",
        "metodo": "PATCH",
        "rota": "/api/midia/itens/<pk>/",
        "parametros": {
            "legenda": "string, opcional",
            "tags": "lista, subconjunto de destaque/capa/avaliacao, opcional",
            "aula_data": "date, opcional",
            "ordem": "inteiro, opcional",
        },
        "descricao": "Edita a curadoria de um item do acervo.",
    },
    {
        "nome": "remover_item",
        "metodo": "DELETE",
        "rota": "/api/midia/itens/<pk>/",
        "parametros": {},
        "descricao": "Remove um item do acervo (e os arquivos físicos associados).",
    },
    {
        "nome": "reordenar",
        "metodo": "POST",
        "rota": "/api/midia/turmas/<id>/reordenar/",
        "parametros": {"ids": "lista de ids de item, na nova ordem"},
        "descricao": "Reordena os itens do acervo da turma.",
    },
    {
        "nome": "consentimento",
        "metodo": "POST",
        "rota": "/api/midia/turmas/<id>/consentimento/",
        "parametros": {"ativo": "booleano"},
        "descricao": "Liga/desliga o consentimento de uso de imagem da turma.",
    },
    {
        "nome": "listar_postagens",
        "metodo": "GET",
        "rota": "/api/midia/turmas/<id>/postagens/",
        "parametros": {},
        "descricao": "Lista as postagens (carrosséis) geradas para a turma.",
    },
    {
        "nome": "criar_postagem",
        "metodo": "POST",
        "rota": "/api/midia/turmas/<id>/postagens/",
        "parametros": {
            "titulo": "string",
            "legenda": "string",
            "artes": "multipart, N arquivos PNG",
        },
        "descricao": "Cria uma Postagem RASCUNHO a partir das artes exportadas do Studio (viram itens do acervo, tipo=arte).",
    },
    {
        "nome": "atualizar_postagem",
        "metodo": "PATCH",
        "rota": "/api/midia/postagens/<pk>/",
        "parametros": {
            "status": "rascunho|pronta|publicada, opcional",
            "url_publicada": "string, opcional",
            "legenda": "string, opcional",
            "titulo": "string, opcional",
        },
        "descricao": "Atualiza status/dados da postagem; status=publicada carimba publicada_em.",
    },
    {
        "nome": "baixar_artes",
        "metodo": "GET",
        "rota": "/api/midia/postagens/<pk>/zip/",
        "parametros": {},
        "descricao": "Baixa um ZIP com todas as artes da postagem.",
    },
    {
        "nome": "catalogo_acoes",
        "metodo": "GET",
        "rota": "/api/midia/acoes/",
        "parametros": {},
        "descricao": "Este catálogo — base agent-first pra descoberta das ações da API.",
    },
]


class AcoesCatalogoView(MidiaAPIView):
    """GET acoes/ — catalogo_acoes."""

    def get(self, request):
        return Response(CATALOGO_ACOES)
