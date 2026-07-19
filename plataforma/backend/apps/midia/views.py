"""API `/api/midia/…` — Acervo em camadas, Studio e Postagens (ver
docs/subsistemas/09-acervo-studio-postagem.md, seção "Contrato da API", e
specs/008-acervo-em-camadas). Mesma API atende o fluxo manual (Mesa de
Luz/Studio) e um agente — por isso o catálogo descritivo em `GET acoes/`.

Duas famílias de rota convivem de propósito (spec 008): as rotas por turma
(`turmas/<id>/…`, contrato intocado — n8n/Manus não quebram) e as rotas
gerais do acervo em camadas (`acervo/…`, `postagens/`).
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
from apps.cursos.models import Curso, Turma
from apps.midia.models import Midia, Postagem
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
    """Mapeia o content-type do upload pro Tipo de Midia — só foto/vídeo
    entram por aqui (arte só nasce via Studio, ver criação de postagem)."""
    if content_type.startswith("image/"):
        return Midia.Tipo.FOTO
    if content_type.startswith("video/"):
        return Midia.Tipo.VIDEO
    return None


def encontrar_duplicata(candidatos, nome_original, tamanho):
    """Procura em `candidatos` (queryset de Midia JÁ filtrado pro escopo de
    destino — a turma, ou a camada geral/curso) um item de foto/vídeo com o
    mesmo nome de arquivo (case-insensitive) e tamanho em bytes — sinal
    simples e barato (sem ler conteúdo) pra pegar o caso comum de reenvio
    acidental (a Mesa de Luz já faz essa checagem no cliente antes de subir;
    isto aqui é o backstop server-side — pega tabs concorrentes ou uploads
    via API direta). Filtra em Python (não `meta__nome_original=`) — `meta`
    é JSONField e lookups nele se comportam diferente entre SQLite (dev) e
    MySQL (prod), mesma lição do get_fotos da avaliação."""
    nome_alvo = (nome_original or "").strip().lower()
    for midia in candidatos.filter(tipo__in=[Midia.Tipo.FOTO, Midia.Tipo.VIDEO]):
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


def contagens_por_tipo_e_tag(itens):
    """Shape `contagens` do contrato — mesma conta pro acervo da turma e pro
    acervo geral filtrado."""
    return {
        "fotos": sum(1 for i in itens if i.tipo == Midia.Tipo.FOTO),
        "videos": sum(1 for i in itens if i.tipo == Midia.Tipo.VIDEO),
        "artes": sum(1 for i in itens if i.tipo == Midia.Tipo.ARTE),
        "destaque": sum(1 for i in itens if "destaque" in i.tags),
        "capa": sum(1 for i in itens if "capa" in i.tags),
        "avaliacao": sum(1 for i in itens if "avaliacao" in i.tags),
    }


def processar_upload_midia(request, *, camada, turma=None, curso=None):
    """Caminho único de upload de foto/vídeo pro acervo, qualquer camada —
    valida arquivo, checa duplicado no ESCOPO de destino (409 + forcar) e
    cria a Midia com thumb síncrona quando for foto. Devolve a Response."""
    arquivo = request.FILES.get("arquivo")
    if not arquivo:
        return Response({"detail": "Envie um arquivo em 'arquivo'."}, status=400)

    content_type = arquivo.content_type or ""
    tipo = tipo_por_content_type(content_type)
    if tipo is None:
        return Response({"detail": "Arquivo precisa ser imagem ou vídeo."}, status=400)
    if arquivo.size > TAMANHO_MAXIMO_BYTES:
        return Response(
            {"detail": "Arquivo excede o tamanho máximo de 1 GB."}, status=400
        )

    escopo = Midia.objects.filter(camada=camada, turma=turma, curso=curso)
    forcar = valor_verdadeiro(request.data.get("forcar"))
    if not forcar:
        duplicata = encontrar_duplicata(escopo, arquivo.name, arquivo.size)
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
    midia = Midia(
        camada=camada,
        turma=turma,
        curso=curso,
        tipo=tipo,
        legenda=request.data.get("legenda", ""),
        credito=request.data.get("credito", ""),
        aula_data=parse_date(aula_data_bruta) if aula_data_bruta else None,
        origem=Midia.Origem.INSTRUTOR,
        meta=extrair_meta(arquivo),
    )
    midia.arquivo = arquivo
    if tipo in (Midia.Tipo.FOTO, Midia.Tipo.ARTE):
        gerar_thumbnail(midia, arquivo)
    midia.save()

    return Response(
        ItemMidiaSerializer(midia, context={"request": request}).data, status=201
    )


def criar_postagem_com_artes(request, *, turma=None, curso=None):
    """Caminho único de criação de Postagem a partir das artes do Studio —
    contexto turma, curso ou marca (ambos vazios). As artes viram Midia
    (tipo=arte, origem=studio) na camada correspondente ao contexto."""
    titulo = (request.data.get("titulo") or "").strip()
    legenda = request.data.get("legenda", "")
    artes = request.FILES.getlist("artes")

    if not titulo:
        return Response({"detail": "Informe o título da postagem."}, status=400)
    if not artes:
        return Response({"detail": "Envie ao menos uma arte em 'artes'."}, status=400)
    for arte in artes:
        content_type = arte.content_type or ""
        if not content_type.startswith("image/"):
            return Response(
                {"detail": "Todas as artes precisam ser imagens (PNG)."}, status=400
            )
        if arte.size > TAMANHO_MAXIMO_BYTES:
            return Response(
                {"detail": "Arte excede o tamanho máximo de 1 GB."}, status=400
            )

    if turma is not None:
        camada = Midia.Camada.TURMA
    elif curso is not None:
        camada = Midia.Camada.CURSO
    else:
        camada = Midia.Camada.GERAL

    postagem = Postagem.objects.create(
        turma=turma, curso=curso, titulo=titulo, legenda=legenda
    )
    for posicao, arte in enumerate(artes):
        midia = Midia(
            camada=camada,
            turma=turma,
            curso=curso,
            tipo=Midia.Tipo.ARTE,
            origem=Midia.Origem.STUDIO,
            ordem=posicao,
            postagem=postagem,
            meta=extrair_meta(arte),
        )
        midia.arquivo = arte
        gerar_thumbnail(midia, arte)
        midia.save()

    return Response(
        PostagemSerializer(postagem, context={"request": request}).data, status=201
    )


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
                "contagens": contagens_por_tipo_e_tag(itens),
            }
        )


class AcervoGeralView(MidiaAPIView):
    """GET acervo/ — listar_acervo_geral (spec 008). Filtros por query
    string: camada, curso (id), turma (id), tipo, tag, q (busca na legenda).
    Sem filtro devolve o acervo inteiro, mais novo primeiro (a ordem de
    curadoria `ordem` só faz sentido dentro de uma turma)."""

    def get(self, request):
        qs = Midia.objects.select_related("turma", "curso").order_by(
            "-criado_em", "-id"
        )
        params = request.query_params
        if params.get("camada"):
            qs = qs.filter(camada=params["camada"])
        if params.get("curso"):
            qs = qs.filter(curso_id=params["curso"])
        if params.get("turma"):
            qs = qs.filter(turma_id=params["turma"]).order_by("ordem", "id")
        if params.get("tipo"):
            qs = qs.filter(tipo=params["tipo"])
        if params.get("q"):
            qs = qs.filter(legenda__icontains=params["q"])
        itens = list(qs)
        # tag é JSONField — filtro em Python (mesma lição do dedup: lookups
        # de JSON divergem entre SQLite e MySQL)
        if params.get("tag"):
            itens = [i for i in itens if params["tag"] in (i.tags or [])]
        return Response(
            {
                "itens": ItemMidiaSerializer(
                    itens, many=True, context={"request": request}
                ).data,
                "contagens": contagens_por_tipo_e_tag(itens),
            }
        )


class CamadasView(MidiaAPIView):
    """GET acervo/camadas/ — listar_camadas (spec 008). O resumo que alimenta
    os seletores de camada (Mesa de Luz da marca e picker do Studio):
    contagens por camada fixa, por curso e por turma — inclusive as vazias,
    que são alvo válido de upload."""

    def get(self, request):
        # uma consulta só; agrega em Python (escala de escola, não de rede social)
        linhas = Midia.objects.values_list("camada", "curso_id", "turma_id", "tipo")
        contagens = {}
        for camada, curso_id, turma_id, tipo in linhas:
            chave = (camada, curso_id, turma_id)
            porte = contagens.setdefault(chave, {"fotos": 0, "videos": 0, "artes": 0})
            campo = {"foto": "fotos", "video": "videos", "arte": "artes"}.get(tipo)
            if campo:
                porte[campo] += 1

        def contagem(camada, curso_id=None, turma_id=None):
            return contagens.get(
                (camada, curso_id, turma_id), {"fotos": 0, "videos": 0, "artes": 0}
            )

        # ordem de exibição dos seletores: Geral primeiro (é o "balde padrão"
        # da marca), depois as camadas temáticas
        ordem_gerais = [
            Midia.Camada.GERAL,
            Midia.Camada.INSTRUTORES,
            Midia.Camada.ESTRUTURA,
            Midia.Camada.EXTERNA,
        ]
        rotulos = dict(Midia.Camada.choices)
        gerais = [
            {"camada": valor, "rotulo": rotulos[valor], "contagens": contagem(valor)}
            for valor in ordem_gerais
        ]
        cursos = [
            {
                "id": curso.id,
                "nome": curso.nome,
                "slug": curso.slug,
                "contagens": contagem(Midia.Camada.CURSO, curso_id=curso.id),
            }
            for curso in Curso.objects.order_by("nome")
        ]
        turmas = [
            {
                "id": turma.id,
                "codigo": turma.codigo,
                "curso": turma.curso.nome,
                "contagens": contagem(Midia.Camada.TURMA, turma_id=turma.id),
            }
            for turma in Turma.objects.select_related("curso").order_by("-id")
        ]
        return Response({"gerais": gerais, "cursos": cursos, "turmas": turmas})


class EnviarAcervoView(MidiaAPIView):
    """POST acervo/enviar/ — enviar_midia_acervo (spec 008). Upload em
    QUALQUER camada: `camada` + (`turma_id` | `curso_id`) conforme os
    invariantes do modelo; um arquivo por request, como no upload por
    turma."""

    parser_classes = [MultiPartParser]

    def post(self, request):
        camada = (request.data.get("camada") or "").strip()
        turma_id = request.data.get("turma_id")
        curso_id = request.data.get("curso_id")

        if turma_id and not camada:
            camada = Midia.Camada.TURMA
        if curso_id and not camada:
            camada = Midia.Camada.CURSO
        if camada not in Midia.Camada.values:
            return Response(
                {
                    "detail": "Camada inválida. Use uma de: "
                    + ", ".join(Midia.Camada.values)
                    + "."
                },
                status=400,
            )

        turma = curso = None
        if camada == Midia.Camada.TURMA:
            if not turma_id:
                return Response(
                    {"detail": "Camada 'turma' exige 'turma_id'."}, status=400
                )
            turma = get_object_or_404(Turma, pk=turma_id)
        elif camada == Midia.Camada.CURSO:
            if not curso_id:
                return Response(
                    {"detail": "Camada 'curso' exige 'curso_id'."}, status=400
                )
            curso = get_object_or_404(Curso, pk=curso_id)
        elif turma_id or curso_id:
            return Response(
                {"detail": "turma_id/curso_id só valem nas camadas 'turma' e 'curso'."},
                status=400,
            )

        return processar_upload_midia(request, camada=camada, turma=turma, curso=curso)


class AvaliacoesTurmaView(MidiaAPIView):
    """GET turmas/<id>/avaliacoes/ — listar_avaliacoes_turma. Alimenta o
    picker do template Depoimento no Studio (spec 003, T1): avaliações
    aprovadas da turma, prova social pronta pra virar arte."""

    def get(self, request, turma_id):
        turma = get_object_or_404(Turma, pk=turma_id)
        # Import protegido: se apps.avaliacoes sair do INSTALLED_APPS um
        # dia, o resto de apps.midia continua funcionando (mesmo padrão de
        # apps/avaliacoes/serializers.py com Midia, só invertido).
        try:
            from apps.avaliacoes.models import Avaliacao
        except ImportError:
            return Response([])

        avaliacoes = Avaliacao.objects.filter(
            turma=turma, status=Avaliacao.Status.APROVADA
        ).order_by("-estrelas", "-peso", "-criado_em")

        dados = [
            {
                "id": avaliacao.id,
                "nome": avaliacao.nome,
                "cargo_atual": avaliacao.cargo_atual,
                "estrelas": avaliacao.estrelas,
                "comentario": avaliacao.comentario,
                "criado_em": avaliacao.criado_em,
            }
            for avaliacao in avaliacoes
        ]
        return Response(dados)


class EnviarMidiaView(MidiaAPIView):
    """POST turmas/<id>/enviar/ — enviar_midia. Um arquivo por request
    (upload sequencial no cliente via XHR, com progresso real por arquivo).
    Desde a spec 008 é açúcar sobre o caminho único de upload (camada
    turma)."""

    parser_classes = [MultiPartParser]

    def post(self, request, turma_id):
        turma = get_object_or_404(Turma, pk=turma_id)
        return processar_upload_midia(request, camada=Midia.Camada.TURMA, turma=turma)


class ItemMidiaView(MidiaAPIView):
    """PATCH/DELETE itens/<pk>/ — editar_item / remover_item."""

    def patch(self, request, pk):
        midia = get_object_or_404(Midia, pk=pk)
        serializer = ItemMidiaEditSerializer(midia, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ItemMidiaSerializer(midia, context={"request": request}).data)

    def delete(self, request, pk):
        midia = get_object_or_404(Midia, pk=pk)
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
            Midia.objects.filter(pk=item_id, turma=turma).update(ordem=posicao)
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
    """GET/POST turmas/<id>/postagens/ — listar_postagens / criar_postagem.
    Desde a spec 008 o POST é açúcar sobre o caminho único de criação
    (contexto turma)."""

    parser_classes = [MultiPartParser]

    def get(self, request, turma_id):
        turma = get_object_or_404(Turma, pk=turma_id)
        postagens = turma.postagens.all()
        return Response(
            PostagemSerializer(postagens, many=True, context={"request": request}).data
        )

    def post(self, request, turma_id):
        turma = get_object_or_404(Turma, pk=turma_id)
        return criar_postagem_com_artes(request, turma=turma)


class PostagensView(MidiaAPIView):
    """GET/POST postagens/ — listar_postagens_geral / criar_postagem_geral
    (spec 008). GET filtra por `turma`, `curso` ou `contexto=marca` (sem
    turma nem curso); POST cria no contexto indicado por `turma_id` OU
    `curso_id` (nenhum = postagem da marca)."""

    parser_classes = [MultiPartParser]

    def get(self, request):
        qs = Postagem.objects.select_related("turma", "curso")
        params = request.query_params
        if params.get("turma"):
            qs = qs.filter(turma_id=params["turma"])
        if params.get("curso"):
            qs = qs.filter(curso_id=params["curso"])
        if params.get("contexto") == "marca":
            qs = qs.filter(turma__isnull=True, curso__isnull=True)
        return Response(
            PostagemSerializer(qs, many=True, context={"request": request}).data
        )

    def post(self, request):
        turma_id = request.data.get("turma_id")
        curso_id = request.data.get("curso_id")
        if turma_id and curso_id:
            return Response(
                {
                    "detail": "Envie turma_id OU curso_id, não os dois "
                    "(turma já tem curso)."
                },
                status=400,
            )
        turma = get_object_or_404(Turma, pk=turma_id) if turma_id else None
        curso = get_object_or_404(Curso, pk=curso_id) if curso_id else None
        return criar_postagem_com_artes(request, turma=turma, curso=curso)


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
        return Response(PostagemSerializer(postagem, context={"request": request}).data)


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
        "nome": "listar_acervo_geral",
        "metodo": "GET",
        "rota": "/api/midia/acervo/",
        "parametros": {
            "camada": "turma|curso|instrutores|estrutura|externa|geral, opcional",
            "curso": "id de curso, opcional",
            "turma": "id de turma, opcional",
            "tipo": "foto|video|arte, opcional",
            "tag": "destaque|capa|avaliacao, opcional",
            "q": "busca na legenda, opcional",
        },
        "descricao": (
            "Lista o acervo em camadas da marca (spec 008) com filtros "
            "combináveis; sem filtro devolve tudo, mais novo primeiro."
        ),
    },
    {
        "nome": "listar_camadas",
        "metodo": "GET",
        "rota": "/api/midia/acervo/camadas/",
        "parametros": {},
        "descricao": (
            "Resumo das camadas do acervo (gerais, cursos e turmas, com "
            "contagens por tipo) — alimenta os seletores de camada da Mesa "
            "de Luz da marca e do Studio."
        ),
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
        "nome": "enviar_midia_acervo",
        "metodo": "POST",
        "rota": "/api/midia/acervo/enviar/",
        "parametros": {
            "arquivo": "multipart, 1 arquivo (image/* ou video/*, máx 1GB)",
            "camada": "turma|curso|instrutores|estrutura|externa|geral",
            "turma_id": "id, obrigatório na camada turma",
            "curso_id": "id, obrigatório na camada curso",
            "legenda": "string, opcional",
            "credito": "string, opcional — fonte/licença (camada externa)",
            "forcar": "'1'/'true', opcional — ignora a checagem de duplicado",
        },
        "descricao": (
            "Envia foto/vídeo pra QUALQUER camada do acervo (spec 008); mesma "
            "checagem de duplicado do enviar_midia, no escopo da camada de "
            "destino."
        ),
    },
    {
        "nome": "listar_avaliacoes_turma",
        "metodo": "GET",
        "rota": "/api/midia/turmas/<id>/avaliacoes/",
        "parametros": {},
        "descricao": (
            "Lista as avaliações aprovadas da turma (nome, cargo, estrelas, "
            "comentário), ordenadas por estrelas desc + peso desc — alimenta "
            "o picker do template Depoimento no Studio."
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
            "credito": "string, opcional — fonte/licença de imagem externa",
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
        "nome": "listar_postagens_geral",
        "metodo": "GET",
        "rota": "/api/midia/postagens/",
        "parametros": {
            "turma": "id, opcional",
            "curso": "id, opcional",
            "contexto": "'marca', opcional — só postagens sem turma e sem curso",
        },
        "descricao": "Lista postagens de qualquer contexto (turma, curso ou marca).",
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
        "nome": "criar_postagem_geral",
        "metodo": "POST",
        "rota": "/api/midia/postagens/",
        "parametros": {
            "titulo": "string",
            "legenda": "string",
            "artes": "multipart, N arquivos PNG",
            "turma_id": "id, opcional (contexto turma)",
            "curso_id": "id, opcional (contexto curso; sem ambos = marca)",
        },
        "descricao": (
            "Cria uma Postagem RASCUNHO em qualquer contexto (spec 008) — as "
            "artes entram no acervo na camada correspondente."
        ),
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
            "agendada_para": "datetime ISO 8601, opcional — fila pro Manus publicar",
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
