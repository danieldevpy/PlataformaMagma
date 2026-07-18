# 09 — Acervo de Mídia, Studio Integrado e Postagens

> Spec de implementação (Etapas 1–3 do plano "Ecossistema de Mídia Magma").
> Status de execução: ver `09-execucao-status.md`.
> Princípio: humano primeiro (fluxo manual polido), agente em paralelo (mesma API).

## Visão

A foto entra UMA vez (Acervo da Turma) e alimenta tudo: studio/carrossel, convite
de avaliação, e futuramente álbum/stories. Vídeos: só upload + biblioteca/download.
Storage local na VPS (`MEDIA_ROOT/turmas/<id>/...`), sem Celery/S3, thumbnails
síncronos com Pillow.

## Decisões de arquitetura (não renegociar sem atualizar este doc)

- Páginas staff servidas pelo Django DENTRO do namespace do admin, via
  `TurmaAdmin.get_urls()`:
  - `/dj-admin/cursos/turma/<id>/acervo/`  → Mesa de Luz (template `midia/acervo.html`)
  - `/dj-admin/cursos/turma/<id>/studio/`  → Studio (template `midia/studio.html`)
  Motivo: nginx de prod só roteia `/(api|dj-admin)/` pro Django. Auth automática
  via `admin_site.admin_view`.
- Botões de acesso na change page da Turma: template
  `backend/templates/admin/cursos/turma/change_form.html` estendendo
  `admin/change_form.html`, sobrescrevendo APENAS o block `object-tools-items`
  (compatível com Jazzmin).
- API nova em `/api/midia/` (app `apps.midia`), DRF `APIView`:
  `authentication_classes = [SessionAuthentication, JWTAuthentication]`,
  `permission_classes = [IsGestorOuInstrutor]` (de `apps/contas/permissions.py`).
  Páginas embutem o token CSRF num `<script>` (`window.MAGMA_CSRF`) e o JS envia
  header `X-CSRFToken` em todo POST/PATCH/DELETE.
- Upload: UM arquivo por request (multipart), sequencial no cliente com XHR
  (progresso por arquivo). Evita estourar body limit e dá UX de progresso real.
- Frontend Next: NENHUMA mudança nesta fase. A integração da avaliação é 100%
  backend (mesmo shape de resposta).
- Mesma numeração/idioma/estilo do código existente (comentários em pt-BR).

## Modelos (app novo `apps.midia`)

```python
def caminho_midia(instance, filename):  # upload_to
    return f"turmas/{instance.turma_id}/{instance.tipo}/{filename}"

class MidiaTurma(ComTimestamps):        # apps.nucleo.models.ComTimestamps
    class Tipo(TextChoices): FOTO="foto"; VIDEO="video"; ARTE="arte"
    class Origem(TextChoices): INSTRUTOR="instrutor"; STUDIO="studio"
    turma        FK cursos.Turma, CASCADE, related_name="midias"
    tipo         Char choices Tipo
    arquivo      FileField(upload_to=caminho_midia)
    thumb        ImageField(upload_to="turmas/thumbs/", null=True, blank=True)
    legenda      Char 160 blank
    tags         JSONField(default=list)   # subconjunto de {"destaque","capa","avaliacao"}
    ordem        PositiveIntegerField(default=0)
    aula_data    DateField(null=True, blank=True)   # gancho Etapa 5
    origem       Char choices Origem default INSTRUTOR
    postagem     FK midia.Postagem, SET_NULL, null/blank, related_name="artes"
    meta         JSONField(default=dict)  # width,height,size,content_type
    Meta.ordering = ["ordem", "id"]

class Postagem(ComTimestamps):
    class Status(TextChoices): RASCUNHO="rascunho"; PRONTA="pronta"; PUBLICADA="publicada"
    class Modo(TextChoices): MANUAL="manual"; AUTO="auto"
    turma          FK cursos.Turma, CASCADE, related_name="postagens"
    titulo         Char 120
    legenda        Text blank
    canal          Char default "instagram"
    modo           Char choices default MANUAL
    status         Char choices default RASCUNHO
    url_publicada  URLField blank
    publicada_em   DateTime null/blank
```

Turma (migration `cursos/0004`): adiciona `consentimento_midia` (Bool default
False) e `consentimento_midia_em` (DateTime null/blank).

Thumbnails: Pillow no momento do upload (só foto/arte): `ImageOps.exif_transpose`
(OBRIGATÓRIO — fotos de celular vêm rotacionadas), reduzir p/ máx 480px lado
maior, JPEG q80. Vídeo: `thumb=None` (UI usa card genérico com ícone ▶).
Validação de upload: content-type `image/*` ou `video/*`, tamanho máx 1 GB.

## Contrato da API (`/api/midia/…`)

| Ação | Método/rota | Corpo → Resposta |
|---|---|---|
| listar_acervo | GET `turmas/<id>/acervo/` | → `{turma:{id,codigo,curso,consentimento_midia}, itens:[Item], contagens:{fotos,videos,artes,destaque,capa,avaliacao}}` |
| enviar_midia | POST `turmas/<id>/enviar/` | multipart `arquivo` (+`legenda?`,`aula_data?`) → `Item` 201 |
| editar_item | PATCH `itens/<pk>/` | `{legenda?,tags?,aula_data?,ordem?}` → `Item` |
| remover_item | DELETE `itens/<pk>/` | → 204 |
| reordenar | POST `turmas/<id>/reordenar/` | `{ids:[...]}` → 200 |
| consentimento | POST `turmas/<id>/consentimento/` | `{ativo:bool}` → `{consentimento_midia, consentimento_midia_em}` |
| listar_postagens | GET `turmas/<id>/postagens/` | → `[PostagemOut]` |
| criar_postagem | POST `turmas/<id>/postagens/` | multipart `titulo`,`legenda`,`artes` (N arquivos PNG) → `PostagemOut` 201 (cria MidiaTurma tipo=arte origem=studio vinculadas) |
| atualizar_postagem | PATCH `postagens/<pk>/` | `{status?,url_publicada?,legenda?,titulo?}` → `PostagemOut` (status=publicada seta `publicada_em`) |
| baixar_artes | GET `postagens/<pk>/zip/` | → ZIP das artes |
| catalogo_acoes | GET `acoes/` | → JSON descritivo de todas as ações acima (nome, método, rota, params, descrição) — base agent-first |

`Item` = `{id,tipo,arquivo_url,thumb_url,legenda,tags,ordem,aula_data,origem,meta,criado_em}`.
URLs de mídia relativas (`/media/...`) — mesmo padrão `MEDIA_URL_BASE` do resto.
`PostagemOut` = `{id,titulo,legenda,canal,modo,status,url_publicada,publicada_em,artes:[Item],criado_em}`.

## Integração avaliação (Etapa 3 — só backend)

`apps/avaliacoes/serializers.py` `get_fotos` passa a priorizar:
1. `MidiaTurma` da turma, `tipo="foto"`, tag `"avaliacao"` OU `"destaque"` —
   capa primeiro (tag `"capa"`), depois por `ordem`;
2. fallback: `FotoCurso` da turma (comportamento atual);
3. fallback: `FotoCurso` genéricas do curso (atual).
Serializar no MESMO shape `{ordem, imagem, legenda}` (imagem = URL relativa via
mesmo mecanismo `RelativeMediaImageField`/`MEDIA_URL_BASE`). Import de
`MidiaTurma` protegido (app instalada). Zero mudança no Next.

## Experiência — Mesa de Luz (`midia/acervo.html` + static próprio)

Design system Magma (navy #101c38/#1b2a4d, ouro #b8933f/#dcb96a, Archivo/Inter,
textura hexágonos). HTML/CSS/JS puro (SEM build), assets em
`backend/static/midia/`. Assinaturas de UX obrigatórias:
- Upload = drop zone + seletor; fila sequencial com card por arquivo (nome,
  barra de progresso XHR real); ao concluir, o card "revela" no grid (blur→nítido).
- Grid responsivo de thumbs; vídeo = card com ícone ▶ + duração se houver;
  clique abre lightbox (foto grande / `<video controls>`).
- Curadoria: hover/tap mostra 3 carimbos ⭐(destaque) 🖼️(capa) 💬(avaliação);
  atalhos de teclado D/C/A com item focado; toggle com animação "pop".
  Regra: `capa` é única por turma (aplicar capa remove das demais — o backend
  não valida, o cliente resolve via PATCH).
- Barra superior: contadores vivos ("12 fotos · 2 vídeos · 3 ⭐ · 1 🖼️ · 5 💬"),
  toggle de consentimento da turma, link → Studio da turma.
- Seleção múltipla (checkbox no hover / long-press) com barra de ações em lote:
  taguear, remover (confirmação), download.
- Estados vazios ilustrados e mensagens de erro em linguagem humana.

## Experiência — Studio integrado (`midia/studio.html` + static próprio)

- Porta do motor `mvp-apps/studio/montar-templates/app/js/templates.js`
  (copiar para `backend/static/midia/templates-engine.js`; adaptar apenas o
  necessário: imagens carregadas por URL do acervo — mesmo origin em dev e
  prod, canvas não taint).
- Picker: fotos do acervo; as com tag ⭐ `destaque` já entram pré-selecionadas.
  Reordenar seleção; ★ define foto do fechamento; offset vertical ↥/↧ por foto;
  variante por slide (moldura/lateral/full/classic) com sorteio "saco
  embaralhado" (portar de `app.js`).
- Campos: nº turma (prefill `turma.codigo`), frase, instagram, whatsapp,
  legenda do post (template editável com `{curso}`/`{turma}`).
- Exportar: renderiza slides 1080×1080 @2x → `canvas.toBlob` → POST
  `criar_postagem` (multipart) → vira Postagem RASCUNHO com artes no acervo.
- Painel "Postagens da turma": lista com timeline estilo pedido
  (`Rascunho → Pronta → Publicada`, nó ativo pulsando dourado), botões:
  Baixar ZIP, Copiar legenda (feedback "copiado ✓"), Marcar pronta,
  Marcar publicada (campo URL opcional) + confete na publicação.

## Infra

- `nginx/nginx.conf` (referência de prod): `client_max_body_size 1g;`
  (nota no doc de execução: aplicar manualmente no host).
- Backup: documentar cron `rsync` da pasta media (não automatizar agora).
- Dev: `init-dev.sh` inalterado (8000/3000).

## Critérios de pronto (teste do Daniel)

1. `./init-dev.sh` sobe sem erro; migrations aplicam limpo.
2. Admin Turma → botão "Acervo" → upload em massa de fotos E vídeos reais com
   progresso; thumbs corretas (orientação EXIF ok); curadoria D/C/A funciona.
3. Botão "Studio" → fotos ⭐ pré-selecionadas → gerar carrossel → Postagem
   criada com artes no acervo; ZIP baixa; legenda copia; status anda até
   Publicada.
4. Convite de avaliação de turma com fotos 💬/⭐ passa a exibi-las; turma sem
   acervo mantém comportamento atual (FotoCurso).
5. Nada do que existe quebra (home, carteirinha, avaliação, admin).
