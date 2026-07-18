# Tasks 001 — Rede de segurança: suíte de testes

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).
> Modelo de execução: o do subsistema 09 — orquestrador NÃO coda; delega, revisa, integra.
> Todo agente lê antes: `CLAUDE.md`, `.context/backend.md`, `spec.md` + `plan.md` desta pasta.

## Tarefas

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | **Fundação**: `requirements-dev.txt`, `config/settings/test.py` (SQLite :memory:, MEDIA_ROOT tmp, hasher MD5), `pytest.ini`, `tests/__init__.py` + `tests/conftest.py` com TODAS as fixtures do plan §Fixtures, e 1 teste-sanidade (`test_fundacao.py`: fixtures criam gestor/curso/turma; `GET /api/cursos/` responde 200). Critério: `pytest` verde do zero, `db.sqlite3` e `media/` reais intocados (conferir timestamps). | PENDENTE | |
| T2 | **Público do site**: `tests/test_publico_site.py` conforme plan §T2 (site/config, cursos lista+detalhe+404, leads 201/400, toggle→null). Critério: cada rota com ≥1 caso feliz e ≥1 caso de erro; asserts de shape citam doc 03 em comentário curto quando divergirem do óbvio. | PENDENTE | |
| T3 | **Convites públicos**: `tests/test_convites_publicos.py` conforme plan §T3 (avaliação magic-link c/ fotos acervo×fallback mesmo shape, POST da avaliação, carteirinha, escopo turma×individual). Antes de escrever, LER as views de `avaliacoes` e `educacional` — regras de token/reenvio saem do código, não de suposição. | PENDENTE | |
| T4 | **Mídia + páginas staff**: `tests/test_midia.py` + `tests/test_paginas_staff.py` conforme plan §T4 (upload+EXIF/thumb, dedup 409/forcar/case/tamanho, curadoria D/C/A + capa única + reordenar, consentimento, postagem→ZIP válido→publicada_em, catálogo acoes/, 403 em TODAS as rotas sem login, staff pages 200/redirect). É a tarefa maior — o roteiro é o smoke test do subsistema 09 (`docs/subsistemas/09-execucao-status.md` log de T5). | PENDENTE | |
| T5 | **Painel e regras da constituição**: `tests/test_painel_e_regras.py` conforme plan §T5 (JWT+sessão, 401/403, conteudo_origem template→editado, CRUD painel, erros `{"detail"}`). | PENDENTE | |
| T6 | **Runner**: `plataforma/rodar-testes.sh` (backend sempre; `node --check` nos estáticos se houver Node; `--full` roda tsc+next build) + seção "Como rodar os testes" no `docs/plataforma/README.md` + atualizar `.context/backend.md` (1 linha: onde ficam os testes e como rodar). Critério: `./rodar-testes.sh` verde; `./rodar-testes.sh --full` verde; falha proposital (quebrar 1 assert) → exit ≠ 0. | PENDENTE | |
| T7 | *(Opcional — só se houver remoto Git ativo)* **CI**: `.github/workflows/testes.yml` rodando `rodar-testes.sh` em push/PR. | PENDENTE | |

## Ondas

- **Onda 0 (sozinha, bloqueia tudo):** T1 — o `conftest.py` é o contrato das demais.
- **Onda 1 (paralelo, até 4 agentes):** T2, T3, T4, T5 — módulos independentes, fixtures fixas do T1. Regra: nenhum agente altera `conftest.py`; se faltar fixture, registra no log e o orquestrador decide (evita conflito entre agentes paralelos).
- **Onda 2:** T6 (integra tudo) → revisão do orquestrador rodando a suíte completa 2× (determinismo) → T7 se aplicável.

## Regras de revisão do orquestrador (por tarefa)

1. Rodar `pytest tests/test_<módulo>.py -v` — verde e sem warnings novos graves.
2. Conferir que o teste falharia: escolher 1 assert central, inverter mentalmente (ou de fato) e confirmar que pegaria regressão real — teste que nunca falha não protege nada.
3. Testes não alteram código de produção. Se o agente encontrou BUG real ao testar: NÃO consertar silenciosamente — registrar no log abaixo e abrir discussão com o Daniel (pode ser regra de negócio).
4. `db.sqlite3` e `backend/media/` reais intocados após a suíte.

## Log

- (2026-07-18) Spec criada (arquiteto). Motivação: v0.1.0 não tem nenhum teste persistido; rede de segurança antes das features da campanha 08/08. Aguardando Daniel disparar a Onda 0.
