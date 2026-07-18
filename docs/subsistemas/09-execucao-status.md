# 09 — STATUS DE EXECUÇÃO (handoff entre sessões)

> Se esta sessão morrer: leia `09-acervo-studio-postagem.md` (spec/contratos) e
> este arquivo (o que já foi feito). Retome pela primeira tarefa não-DONE.
> Papel do orquestrador: NÃO codar; delegar a agentes (Sonnet), revisar, integrar.

## Tarefas

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | Backend fundação: app `apps.midia` (modelos MidiaTurma+Postagem, migrations, thumbs Pillow c/ EXIF, API `/api/midia/` completa conforme contrato, catálogo `/api/midia/acoes/`), migration `cursos/0004` (consentimento na Turma), INSTALLED_APPS+urls, admin básico dos modelos, `TurmaAdmin.get_urls` c/ views acervo/studio (templates placeholder se T2/T3 não entregues), template `admin/cursos/turma/change_form.html` (block object-tools-items c/ 2 botões), nginx.conf ref `client_max_body_size 1g` | DONE (revisado ✓, check/migrate ok) | Sonnet #1 |
| T2 | Mesa de Luz UI: `backend/templates/midia/acervo.html` + `backend/static/midia/acervo.{css,js}` — upload sequencial XHR c/ progresso, grid c/ revelação, carimbos D/C/A (capa única), lightbox foto/vídeo, contadores, consentimento, seleção múltipla + lote, estados vazios | DONE (contrato revisado ✓) | Sonnet #2 |
| T3 | Studio UI: `backend/templates/midia/studio.html` + `backend/static/midia/studio.{css,js}` + porta do motor canvas (`templates-engine.js` a partir de `mvp-apps/studio/montar-templates/app/js/templates.js`) — picker com ⭐ pré-selecionado, variantes+offset+fechamento, export → criar_postagem, painel postagens c/ timeline+ZIP+copiar legenda+status+confete | ENTREGUE (contrato revisado ✓; validação funcional na T5) | Sonnet #3 |
| T4 | Avaliação: `avaliacoes/serializers.py get_fotos` prioriza acervo (avaliacao/destaque, capa primeiro) c/ fallback FotoCurso; mesmo shape de resposta; teste rápido | DONE (revisão estática ✓ + teste funcional no T5 ✓: capa em ordem=0, fallback FotoCurso ok, convite sem turma ok) | Sonnet #1 (reuso) |
| T5 | Integração/validação: migrations aplicam, smoke test de ponta a ponta (upload real c/ EXIF, curadoria, studio→postagem→ZIP→publicada, avaliação c/ acervo e fallback, regressão, 403 sem login), correções triviais | DONE (todos os itens ✅, ZERO correções necessárias; dados de teste limpos do banco/disco) | Sonnet (sessão 2) + revisão orquestrador ✓ |

Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).

## Ondas
- Onda 1 (paralelo, 3 agentes Sonnet): T1, T2, T3 — contratos fixos na spec permitem paralelismo.
- Onda 2: T4 (depende de T1) + correções de integração (reutilizar agentes) + T5.

## Decisões já tomadas (não rediscutir)
- Páginas staff no namespace `/dj-admin/` via `TurmaAdmin.get_urls` (nginx prod só roteia api|dj-admin).
- API: Session+JWT auth, `IsGestorOuInstrutor`, CSRF via `window.MAGMA_CSRF` + header `X-CSRFToken`.
- Upload 1 arquivo/request. Vídeo sem transcode/thumb (card genérico). Máx 1 GB.
- Next.js intocado nesta fase (T4 é só backend, mesmo shape).
- Turma vive em `apps/cursos/models.py:125`; próximas migrations: cursos 0004, midia 0001.

## Log
- (sessão 2026-07-17) Spec e status criados; mapa técnico levantado (Explore). Ondas definidas.
- (sessão 2026-07-17) T3 ENTREGUE: studio.html+studio.{js,css}+templates-engine.js em backend/{templates,static}/midia/. Contrato conferido (rotas, campo artes, CSRF, engine intacta). Confete portado da carteirinha.

- (sessão 2026-07-17) T1 DONE: apps.midia completo, migrations aplicadas (cursos/0004, midia/0001), url_media_relativa extraída em config/drf.py, nginx ref 1g. T2 DONE: acervo.{html,css,js}. Onda 2 disparada: T4 (agente backend) + T5 smoke test (agente UI).
- (sessão 2 — 2026-07-17, retomada) Sessão anterior morreu no meio da Onda 2. Constatado: T4 JÁ ESTAVA no código (diff completo em avaliacoes/serializers.py, conforme spec, incl. filtro de tags em Python p/ SQLite/MySQL). Revisão estática do T4 pelo orquestrador: aprovada (`manage.py check` limpo, `migrate --check` limpo, shape idêntico ao fallback). T5 redelegado a um agente Sonnet novo: smoke test completo via Django test client (páginas staff, API /api/midia/ inteira, EXIF/thumb, postagem+ZIP, T4 funcional c/ capa primeiro + fallback, regressão e segurança sem login).
- (sessão 2 — 2026-07-17, encerramento) T5 DONE: TODOS os itens do smoke test passaram sem nenhuma correção (nem trivial). Destaques validados: thumb 480px c/ EXIF Orientation=6 corrigido (paisagem→retrato), postagem multipart c/ 2 PNGs 1080² → 2 MidiaTurma arte/studio, ZIP válido, publicada_em setado, catálogo acoes/ c/ 11 ações, 403 sem login, avaliação c/ capa em ordem=0 + fallback intacto, regressão /api/cursos/ ok. Dados de teste 100% revertidos (banco + disco). Revisão de integração do orquestrador: diffs de infra (admin get_urls, drf.py, settings, urls, nginx 1g) aprovados. **IMPLEMENTAÇÃO COMPLETA — falta só o teste manual do Daniel no browser (upload em massa real) e aplicar client_max_body_size 1g no nginx do host de prod.**
- (sessão 2 — 2026-07-17, bugfix pós-teste) Daniel abriu o Acervo no browser: modal de confirmação VAZIO + lightbox abertos no load, travando a página. Causa: overlays escondidos pelo atributo `hidden`, mas regras de autor `.confirm/.lightbox/...{display:flex}` vencem o `[hidden]{display:none}` do UA stylesheet (o smoke test via test client não pega — é bug de CSS renderizado). Fix: `[hidden]{display:none !important}` no topo de acervo.css e studio.css. Lição p/ próximas UIs: todo CSS novo que esconde via atributo `hidden` precisa dessa regra-guarda.

## Handoff → próxima sessão (diagnóstico dos testes manuais do Daniel)

Estado ao encerrar a sessão 2 (2026-07-17, commitado):
- Implementação COMPLETA (T1–T5 DONE) + 1 bugfix de browser aplicado ([hidden] vs display de autor). Daniel só chegou a ABRIR o Acervo; upload em massa, curadoria, Studio, postagem e avaliação ainda NÃO foram exercitados no browser real.
- Roteiro do teste: critérios de pronto na spec (`09-acervo-studio-postagem.md`, seção final). Prints de bug vão pra pasta `plataforma/bug/` (untracked).
- Suspeitos naturais se surgirem novos bugs de UI: (a) tudo que o test client não cobre — CSS renderizado, drag-and-drop, canvas/toBlob do studio, clipboard, confete; (b) cache de static no browser (pedir Ctrl+Shift+R); (c) upload grande em dev (runserver não tem limite nginx, mas prod precisa do 1g manual no host).
- Fora do commit (working tree do Daniel, não mexer sem perguntar): deleções antigas de `avaliacao/`, `carteirinha-digital/`, `design-system c2/`, `landing-page/` (aparente reorganização p/ `mvp-apps/`/`design-system-junto/`), `plataforma/backend/data.json`, docs 07b/agente-social-maker (de outra frente).

- (sessão 3 — 2026-07-17, ajuste pedido pelo Daniel após o primeiro teste) Pedido: (1) upload de múltiplos arquivos no Acervo, (2) detecção de duplicado (nome+tamanho) pra foto e vídeo, evitando exclusão manual depois.
  - **Achado (1): já estava implementado** desde a Onda 1 (`fileInput multiple` + drag&drop de vários + fila sequencial em `acervo.js`) — provavelmente o Daniel nem chegou a testar isso porque o bug do modal fantasma travou a página assim que ele abriu. Nenhuma mudança de código necessária aqui; só verificado (leitura + `node --check`).
  - **(2) implementado**: `meta.nome_original` capturado no upload (`apps/midia/utils.py::extrair_meta`); `views.py::encontrar_duplicata` compara nome (case-insensitive) + `meta.size` contra foto/vídeo já existentes na turma (filtro em Python, mesma ressalva JSONField SQLite×MySQL de sempre); `EnviarMidiaView.post` responde 409 `{detail,duplicado:true,item_existente}` a menos que venha `forcar=1`. No cliente (`acervo.js`), `enfileirar` faz a checagem ANTES de subir (zero bytes gastos) contra `estado.itens` + a própria fila (pega duplicata dentro do mesmo lote solto); se achar suspeitos, um único diálogo agrupa todos e pergunta "enviar mesmo assim?" — cancelar descarta com toast, confirmar reenfileira com `forcar:true`. Backend 409 tratado como backstop silencioso (não trava a fila, só marca o card como "⏭️ já existe" e segue pro próximo arquivo) pro caso raro de outra aba/cliente ter subido o mesmo arquivo nesse meio-tempo.
  - Validação: backend testado via `manage.py shell` + Django test client — mesmo nome+tamanho → 409 com `item_existente`; case diferente → ainda pega (409); `forcar=1` → passa (201); mesmo nome com tamanho GENUINAMENTE diferente → não bloqueia (201/201), confirmando que não há falso positivo. `manage.py check` limpo. JS validado por `node --check` (sintaxe) + leitura completa da lógica — **não houve teste em browser real** (sem ferramenta de automação de navegador disponível nesta sessão); recomendo exercitar no próximo teste manual: selecionar/arrastar vários arquivos de uma vez, e tentar subir um arquivo já existente (nome+tamanho iguais) pra ver o diálogo de confirmação em lote.
  - Limitação conhecida (documentada na spec): itens enviados ANTES desta função não têm `nome_original` em `meta`, então não entram na checagem de duplicado até serem reenviados — sem backfill, não é crítico.
  - Arquivos alterados: `apps/midia/utils.py`, `apps/midia/views.py` (dedup + doc no catálogo `acoes/`), `static/midia/acervo.js` (fila com pré-checagem + status `duplicado`), `static/midia/acervo.css` (estilos do novo status + `.toast--aviso`), `docs/subsistemas/09-acervo-studio-postagem.md` (contrato + UX). **Ainda NÃO commitado** — Daniel não pediu commit desta vez.
