# Plan 001 — Rede de segurança: suíte de testes

> O COMO. Agente implementador: leia antes `CLAUDE.md` (raiz), `.context/index.md`,
> `.context/backend.md` e a constituição. Contratos de API: `docs/plataforma/03-api-contratos.md`
> — **em divergência entre este plan e o código real, o código real + doc 03 vencem; anote a divergência no log do tasks.md**.

## Stack e decisões desta spec (ADR curto)

| Decisão | Escolha | Porquê |
|---|---|---|
| Runner backend | **`django.test.TestCase` nativo + `python manage.py test`** | é o padrão **já em uso** no repo (`apps/nucleo`, `apps/ia`, `apps/midia` = ~45 testes). Adotar pytest exigiria portar tudo — retrabalho sem ganho p/ o alvo (contrato+regra) |
| Onde vivem os testes | **`tests.py` por app** (`apps/<app>/tests.py`) | mesma convenção dos testes existentes; cada app dono dos seus casos; `manage.py test` descobre sozinho |
| Settings de teste | **`config/settings/test.py`** (herda de `base`) | isola DB e `MEDIA_ROOT`; hoje `manage.py test` roda sob `dev`/`prod` e usaria `MEDIA_ROOT` real — inaceitável |
| Banco de teste | SQLite (o test runner cria DB de teste próprio; forçar `:memory:` via `TEST["NAME"]`) | velocidade + zero risco ao `db.sqlite3` de dev |
| Mídia de teste | `MEDIA_ROOT = <tmp>` no `test.py` (dir temporário determinístico, ex. `BASE_DIR/.test-media`, limpo no fim) | nunca sujar `backend/media/` real |
| Dependências novas | **nenhuma** (test runner é do próprio Django) | prod não ganha peso; sem `requirements-dev.txt` |
| Front nesta spec | `npx tsc --noEmit` + `next build` como smoke; `node --check` nos JS estáticos do admin/Studio | pega erro de tipo/rota/sintaxe sem framework novo |

> **Reversão consciente do plano anterior:** a v1 deste plan pedia pytest + pasta central
> `tests/` + `conftest.py` + `requirements-dev.txt`. Descartado: o código consolidou o padrão
> Django-nativo per-app antes desta spec rodar. Ver `tasks.md §Log` (2026-07-18 noite).

## Arquivos a criar / tocar

```
plataforma/
├── rodar-testes.sh                         # NOVO — runner único (backend + estáticos [+ front])
└── backend/
    ├── config/settings/test.py             # NOVO — herda de base: DB de teste, MEDIA_ROOT tmp, MD5 hasher
    └── apps/
        ├── nucleo/tests.py                  # EXISTE — camada de ações; consolidar + faltas (site/config)
        ├── ia/tests.py                      # EXISTE — provedores/capacidades/uso; consolidar + Gemini
        ├── midia/tests.py                   # EXISTE — expandir p/ smoke completo (EXIF/dedup/ZIP/curadoria/403)
        ├── cursos/tests.py                  # NOVO — LP pública (config via nucleo), cursos lista/detalhe, toggles, painel
        ├── leads/tests.py                   # NOVO — criação pública 201/400 + painel
        └── avaliacoes/tests.py              # NOVO — convite magic-link, POST da avaliação, escopo turma×individual, carteirinha
```

Helpers repetidos entre apps (criar gestor/instrutor, curso+turma, JPEG via Pillow) podem
morar num módulo simples `apps/nucleo/testing.py` (funções puras, **não** pytest fixtures),
importado pelos `tests.py`. Cada app permanece dono do seu arquivo — nada de acoplar apps.

## Estado atual dos testes (mapa consolidar / expandir / novo)

- **`apps/nucleo/tests.py` — CONSOLIDAR.** Já cobre catálogo/execução de ações, escopos de
  `TokenAgente`, `LogAcao` em sucesso e erro, `PATCH agendada_para`. Falta: `GET /api/site/config/`
  (shape do doc 03) e `GET /api/painel/config/` (403 sem login).
- **`apps/ia/tests.py` — CONSOLIDAR.** Já cobre capacidades (com/sem provedor), executar (mock),
  CRUD de provedor, credencial **cifrada** write-only, testar-provedor, uso mensal, página staff,
  acesso negado. Falta: se o **adapter Gemini** (novo, em `apps/ia/adapters/gemini.py`) existir no
  merge, um teste smoke mockado dele (nunca chama API real) e um caso de `Provedor.GEMINI`.
- **`apps/midia/tests.py` — EXPANDIR.** Já cobre `AvaliacoesTurmaView` e o acervo em camadas
  (upload por camada, dedup por escopo, listagem/filtros, resumo de camadas, postagem da marca,
  postagem turma+curso→400, ação de postagens agendadas, páginas da marca renderizam). Falta o
  **smoke pesado do subsistema 09**: EXIF Orientation=6→thumb retrato, dedup **409/`forcar`/case/tamanho**,
  curadoria D/C/A + capa única + `reordenar`, `consentimento`, **postagem→ZIP válido→`publicada_em`**,
  e **403 em TODAS as rotas `/api/midia/`** sem login.
- **`apps/cursos`, `apps/leads`, `apps/avaliacoes` — NOVO.** Sem nenhum teste hoje.

## Cobertura (mapa rota → o que provar)

### T2 · Público do site — `apps/cursos/tests.py` (+ `apps/nucleo/tests.py` p/ config)
| Rota | Provar |
|---|---|
| `GET /api/site/config/` | 200 + shape do doc 03 (**vai em `nucleo/tests.py`**, é view de nucleo) |
| `GET /api/cursos/` | 200, lista contém o curso publicado, identificado por **slug** (nunca PK) |
| `GET /api/cursos/<slug>/` | 200 + campos que a LP consome; slug inexistente → 404 `{"detail": ...}` |
| Toggle (constituição §3) | desligar um `exibir_*` do curso → campo vem `null`/ausente na resposta pública |
| Painel cursos/turmas | `painel/cursos`, `painel/turmas`, habilidades e FAQs aninhadas: ciclo criar→editar→listar; 403 sem papel |

### T3 · Leads — `apps/leads/tests.py`
| Rota | Provar |
|---|---|
| `POST /api/leads/` | 201 cria lead; payload inválido → 400 com `{"detail"...}`/erros de campo conforme doc 03 |
| `painel/leads` | listar exige gestor/instrutor; anônimo → 403 |

### T4 · Convites públicos (magic-link) — `apps/avaliacoes/tests.py`
> Antes de escrever, **LER as views de `avaliacoes` (e a carteirinha, onde estiver)** — regras
> de token/reenvio saem do código, não de suposição.

| Rota | Provar |
|---|---|
| `GET /api/avaliacoes/convite/<uuid>/` | token válido → 200; token aleatório → 404/410 conforme view |
| Fotos do convite | turma **com** acervo → fotos avaliacao/destaque, capa em `ordem=0`; turma **sem** acervo → fallback `FotoCurso`; **mesmo shape** nos dois casos |
| `POST` do convite (envio) | cria avaliação; reenvio no mesmo token segue a regra da view |
| Carteirinha | `GET` do convite de carteirinha (onde a rota viver): token válido → 200; inválido → 404 |
| Escopo turma × individual | os dois tipos de link funcionam (decisão 2026-07-16 em `.context/decisoes.md`) |

### T5 · Mídia / Acervo em camadas — `apps/midia/tests.py` (EXPANDIR o que já existe)
| Caso | Provar |
|---|---|
| Upload | `POST /api/midia/turmas/<id>/enviar/` c/ JPEG real → 201; thumb 480px; EXIF Orientation=6 → thumb retrato |
| Dedup | mesmo nome+tamanho **por escopo de camada** → **409** `{detail, duplicado:true, item_existente}`; `forcar=1` → 201; nome igual, tamanho ≠ → 201 (sem falso positivo); case-insensitive no nome |
| Curadoria | carimbos via `PATCH /api/midia/itens/<pk>/` (D/C/A); capa única por turma; `reordenar/` persiste ordem |
| Consentimento | `POST .../consentimento/` altera a turma |
| Postagem | `POST .../postagens/` multipart c/ 2 PNGs 1080² → cria `Postagem` + 2 `Midia` arte/studio; `GET .../zip/` → ZIP válido (abrir c/ `zipfile`); status até publicada seta `publicada_em` |
| Postagem multi-contexto (spec 008) | postagem da **marca** ok; **turma+curso juntos → 400** (já coberto — manter) |
| Catálogo de ações | `GET /api/midia/acoes/` → 200, lista não-vazia (**pode ficar em nucleo**, checar onde a view mora) |
| Segurança | **toda** rota `/api/midia/` sem login → 403; com `instrutor` → autorizada |
| Páginas staff | `GET /dj-admin/cursos/turma/<id>/acervo|studio/` **e** `/dj-admin/midia/midia/acervo|studio/` logado → 200 e template certo; deslogado → redirect p/ login |

### T6 · IA + Camada de Ações — `apps/ia/tests.py` + `apps/nucleo/tests.py` (CONSOLIDAR)
| Caso | Provar |
|---|---|
| IA — o que já existe | manter capacidades/executar(mock)/CRUD/credencial cifrada/testar/uso/staff |
| IA — Gemini (se presente) | smoke mockado do `AdaptadorGemini` (nunca API real) + `Provedor.GEMINI` cifra credencial |
| Ações — o que já existe | manter catálogo, escopos de `TokenAgente`, `LogAcao`, `agendada_para` |
| Constituição transversal | credencial de IA **nunca** volta no JSON (write-only); 403 sem login em `ia/*` e `acoes/*` |

### T7 · Painel e regras da constituição — distribuído nos `tests.py` dos apps donos
| Caso | Provar | Onde |
|---|---|---|
| Auth | `POST /api/token/` → par JWT; API de painel aceita JWT **e** sessão; sem credencial → 401/403 | `contas/tests.py` (NOVO, se necessário) ou `cursos` |
| `conteudo_origem` (constituição §1–2) | registro nasce `"template"`; `PATCH` pelo painel marca `"editado"`; ver `.context/dados.md` | app dono do modelo tocado |
| Erros | formato `{"detail": "..."}` nas falhas das rotas testadas | transversal |

### T8 · Runner + estáticos + front — `rodar-testes.sh`
1. `backend`: `python manage.py test --settings=config.settings.test` (falha → exit ≠ 0).
2. `estáticos`: `node --check` em `backend/static/midia/*.js`, `backend/static/midia/templates/*.js`,
   `backend/static/ia/*.js` e `backend/static/admin/**/*.js` se houver Node (senão avisa e pula).
3. `front` (flag `--full`): `npx tsc --noEmit` + `npm run build` em `frontend/` — mais lento,
   opcional no dia a dia, obrigatório antes de deploy.

## Armadilhas conhecidas (não redescobrir)

- **`MEDIA_ROOT` real**: `manage.py test` sob `dev`/`prod` gravaria em `backend/media/`. Rodar
  **sempre** com `--settings=config.settings.test`, que aponta `MEDIA_ROOT` p/ um dir temporário.
- **JSONField**: filtros de tags/meta são feitos **em Python** de propósito (SQLite×MySQL divergem
  em `__contains`) — testes não devem "consertar" isso para query ORM.
- **CSRF**: páginas staff usam `window.MAGMA_CSRF` + header `X-CSRFToken`; o test client não força
  CSRF por padrão — cobrir o fluxo de upload com `Client(enforce_csrf_checks=True)`.
- **Thumb/EXIF**: gerar a imagem com Pillow no próprio teste (sem binário commitado); gravar EXIF
  exige salvar com `exif=` bytes — ver como `apps/midia/utils.py` lê a orientação.
- **`STATIC_ROOT`/collectstatic**: `test.py` não deve depender de collectstatic.
- **Renomeação spec 008**: o modelo é `Midia` (ex-`MidiaTurma`); dedup é **por escopo de camada**,
  não por turma. Rotas por turma (contrato do subsistema 09) seguem intocadas; há rotas gerais novas
  (`acervo/`, `acervo/camadas/`, `acervo/enviar/`, `postagens/`).
- **Credencial de IA cifrada** deriva de `DJANGO_SECRET_KEY`; no `test.py` fixe uma `SECRET_KEY`
  determinística p/ os testes de cifra não dependerem do ambiente.
- **Adapters de IA**: **nunca** chamar API real — mockar `executar`/`testar` do adaptador (padrão já
  usado em `apps/ia/tests.py`).
- **Itens antigos sem `meta.nome_original`** ficam fora do dedup — comportamento esperado, não é bug.

## O que esta spec NÃO cobre (e onde isso fica registrado)

- Seed idempotente (doc 08): o comando ainda não existe. **Obrigação herdada**: a spec que
  implementar o seed DEVE adicionar teste provando idempotência (rodar 2× não muda nada) e respeito
  a `conteudo_origem="editado"`. Registrado como pendência em `.context/status.md`.
- Browser real (CSS renderizado, drag-and-drop, canvas/toBlob, clipboard, confete) e render
  pixel-a-pixel do Studio — continua no teste manual do roteiro do subsistema 09
  (`docs/subsistemas/09-acervo-studio-postagem.md` §Critérios de pronto) + olho do dono no Studio 2.0.
