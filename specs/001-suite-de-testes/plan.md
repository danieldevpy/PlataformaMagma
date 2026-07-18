# Plan 001 — Rede de segurança: suíte de testes

> O COMO. Agente implementador: leia antes `CLAUDE.md` (raiz), `.context/index.md`,
> `.context/backend.md` e a constituição. Contratos de API: `docs/plataforma/03-api-contratos.md`
> — **em divergência entre este plan e o código real, o código real + doc 03 vencem; anote a divergência no log do tasks.md**.

## Stack e decisões desta spec

| Decisão | Escolha | Porquê |
|---|---|---|
| Runner backend | `pytest` + `pytest-django` | padrão de mercado, fixtures compartilháveis, saída legível p/ agentes |
| Onde vivem os testes | `plataforma/backend/tests/` (pasta central, 1 módulo por app) | fixtures compartilhadas num único `conftest.py`; mais simples de orquestrar que 7 pastas per-app |
| Banco de teste | SQLite **em memória** (settings próprio) | velocidade + zero risco ao `db.sqlite3` de dev |
| Mídia de teste | `MEDIA_ROOT` em diretório temporário (fixture `tmp_path`/`override_settings`) | nunca sujar `backend/media/` real |
| Dependências novas | `requirements-dev.txt` (novo arquivo: `-r requirements.txt` + `pytest`, `pytest-django`) | prod não instala ferramenta de teste |
| Front nesta spec | `npx tsc --noEmit` + `next build` como smoke; `node --check` nos JS estáticos do admin | pega erro de tipo/rota/sintaxe sem framework de teste novo |

## Arquivos a criar

```
plataforma/
├── rodar-testes.sh                      # runner único (backend + estáticos [+ front])
└── backend/
    ├── requirements-dev.txt
    ├── pytest.ini                       # DJANGO_SETTINGS_MODULE=config.settings.test
    ├── config/settings/test.py          # herda de base: SQLite :memory:, MEDIA_ROOT tmp,
    │                                    # PASSWORD_HASHERS=[MD5PasswordHasher] (velocidade)
    └── tests/
        ├── __init__.py
        ├── conftest.py                  # fixtures compartilhadas (ver §Fixtures)
        ├── test_publico_site.py         # nucleo + cursos + leads (T2)
        ├── test_convites_publicos.py    # avaliações magic-link + carteirinha (T3)
        ├── test_midia.py                # acervo/studio/postagens (T4)
        ├── test_painel_e_regras.py      # auth, permissões, conteudo_origem, toggles (T5)
        └── test_paginas_staff.py        # /dj-admin/ acervo+studio renderizam (T4)
```

## Fixtures (`conftest.py`) — contrato para todas as tarefas

Criar via ORM (nunca via API, para não acoplar fixtures a endpoints):

- `gestor` / `instrutor` — usuários que satisfazem `IsGestor` / `IsGestorOuInstrutor`
  (**ler `apps/contas/permissions.py` e `apps/contas/models.py` primeiro** para saber
  como o papel é modelado; não chutar).
- `api_gestor` — `APIClient` do DRF já autenticado (session login; um teste específico cobre JWT).
- `curso` — curso publicado com slug `socorrista-aph-teste` + conteúdo mínimo p/ a LP.
- `turma` — turma do `curso` (modelo em `apps/cursos/models.py:125`).
- `foto_jpeg` (factory) — gera JPEG real em memória via Pillow; parâmetro para gravar
  EXIF `Orientation=6` (paisagem→retrato) — necessário no teste de thumb.
- `midia_no_acervo` — sobe 1 foto na `turma` via `EnviarMidiaView` (aqui sim via API,
  pois upload é o contrato sob teste) e devolve o item criado.
- Autouse: `override_settings(MEDIA_ROOT=tmp_path)` para qualquer teste que grave arquivo.

## Cobertura (mapa rota → o que provar)

### T2 · Público do site — `test_publico_site.py`
| Rota | Provar |
|---|---|
| `GET /api/site/config/` | 200 + shape do doc 03 |
| `GET /api/cursos/` | 200, lista contém o curso publicado, identificado por **slug** (nunca PK) |
| `GET /api/cursos/<slug>/` | 200 + campos que a LP consome; slug inexistente → 404 `{"detail": ...}` |
| `POST /api/leads/` | 201 cria lead; payload inválido → 400 com `{"detail"...}` ou erros de campo conforme doc 03 |
| Toggle (constituição §3) | desligar um `exibir_*` do curso → campo vem `null`/ausente na resposta pública **sem** mudar o front |

### T3 · Convites públicos (magic-link) — `test_convites_publicos.py`
| Rota | Provar |
|---|---|
| `GET /api/avaliacoes/convite/<uuid>/` | token válido → 200; token aleatório → 404/410 conforme view |
| Fotos do convite | turma **com** acervo → fotos tags avaliacao/destaque, capa em `ordem=0`; turma **sem** acervo → fallback `FotoCurso`; **mesmo shape** nos dois casos (regressão do T4 do subsistema 09) |
| `POST` do convite (envio da avaliação) | cria avaliação; reenvio no mesmo token segue a regra da view (ler a view antes) |
| `GET /api/carteirinha/convite/<uuid>/` | token válido → 200; inválido → 404 |
| Escopo turma × individual | os dois tipos de link funcionam (decisão 2026-07-16 em `.context/decisoes.md`) |

### T4 · Mídia (o smoke test do subsistema 09, persistido) — `test_midia.py` + `test_paginas_staff.py`
| Caso | Provar |
|---|---|
| Upload | `POST /api/midia/turmas/<id>/enviar/` c/ `foto_jpeg` → 201; thumb 480px criada; EXIF Orientation=6 → thumb em retrato |
| Dedup | mesmo nome+tamanho → **409** `{detail, duplicado:true, item_existente}`; com `forcar=1` → 201; mesmo nome tamanho diferente → 201 (sem falso positivo); case-insensitive no nome |
| Curadoria | carimbos via `PATCH /api/midia/itens/<pk>/` (D/C/A); capa é única por turma; `reordenar/` persiste ordem |
| Consentimento | `POST .../consentimento/` altera a turma |
| Postagem | `POST .../postagens/` multipart c/ 2 PNGs 1080² → cria Postagem + 2 MidiaTurma arte/studio; `GET .../zip/` → ZIP válido (abrir com `zipfile`); status até publicada seta `publicada_em` |
| Catálogo | `GET /api/midia/acoes/` → 200, lista de ações não-vazia |
| Segurança | **toda** rota `/api/midia/` sem login → 403; com `instrutor` → autorizada |
| Páginas staff | `GET /dj-admin/cursos/turma/<id>/acervo/` e `/studio/` logado → 200 e template certo; deslogado → redirect p/ login |

### T5 · Painel e regras da constituição — `test_painel_e_regras.py`
| Caso | Provar |
|---|---|
| Auth | `POST /api/token/` → par JWT; API de painel aceita JWT **e** sessão; sem credencial → 401/403 |
| Permissões | usuário comum (sem papel) em rota de painel → 403 |
| `conteudo_origem` (constituição §1–2) | registro criado nasce `"template"`; `PATCH` pelo painel marca `"editado"`; ver regra em `.context/dados.md` |
| CRUD painel | `painel/cursos`, `painel/turmas`, habilidades e FAQs aninhadas: ciclo criar→editar→listar básico |
| Erros | formato `{"detail": "..."}` nas falhas das rotas testadas |

### T6 · Runner + estáticos + front — `rodar-testes.sh`
1. `backend`: ativa `.venv`, `pip install -q -r requirements-dev.txt`, `pytest` (falha → exit ≠ 0).
2. `estáticos`: `node --check` em `backend/static/midia/*.js` e `backend/static/admin/**/*.js` se houver Node (senão avisa e pula).
3. `front` (flag `--full`): `npx tsc --noEmit` + `npm run build` em `frontend/` — mais lento, opcional no dia a dia, obrigatório antes de deploy.

## Armadilhas conhecidas (não redescobrir)

- **JSONField**: filtros de tags/meta são feitos **em Python** de propósito (SQLite×MySQL divergem em `__contains`) — testes não devem "consertar" isso para query ORM.
- **CSRF**: páginas staff usam `window.MAGMA_CSRF` + header `X-CSRFToken`; `APIClient` de teste não força CSRF por padrão — cobrir o fluxo com um teste usando `enforce_csrf_checks=True` no upload.
- **Thumb/EXIF**: gerar a imagem com Pillow no próprio teste (sem binário commitado); gravar EXIF exige salvar com `exif=` bytes — ver como `apps/midia/utils.py` lê a orientação.
- **`STATIC_ROOT` não existe em `base.py`** (pendência conhecida) — `settings/test.py` não deve depender de collectstatic.
- **Não usar o banco/`media/` reais**: qualquer teste que precise de arquivo usa o `MEDIA_ROOT` temporário; o teardown do pytest limpa sozinho.
- **Itens antigos sem `meta.nome_original`** ficam fora do dedup — comportamento esperado, não é bug.

## O que esta spec NÃO cobre (e onde isso fica registrado)

- Seed idempotente (doc 08): o comando ainda não existe. **Obrigação herdada**: a spec
  que implementar o seed DEVE adicionar `tests/test_seed.py` provando idempotência
  (rodar 2× não muda nada) e respeito a `conteudo_origem="editado"`. Registrado como
  pendência em `.context/status.md`.
- Browser real (CSS renderizado, drag-and-drop, canvas/toBlob, clipboard, confete) —
  continua no teste manual do roteiro do subsistema 09 (`docs/subsistemas/09-acervo-studio-postagem.md` §Critérios de pronto).
