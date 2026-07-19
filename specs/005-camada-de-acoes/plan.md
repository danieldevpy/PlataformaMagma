# Plan 005 — como fazer

Referências: doc 10 §6. Catálogo existente: `apps/midia/views.py::CATALOGO_ACOES`
+ `AcoesCatalogoView`. Convite por turma: app `avaliacoes` (`ConviteAvaliacao`,
escopo turma) — reusar a mecânica existente de criação/URL (explorar admin/views
do app antes de escrever). Turma: `apps/cursos/models.py`.

## Núcleo (`apps/nucleo/acoes.py` — registry)

- `@registrar_acao(nome, descricao, params, escopo)` decorando funções
  `fn(params, request) → dict`. Registry em dict de módulo; apps registram no
  `apps.py.ready()` (import de `<app>/acoes.py`).
- `GET /api/acoes/` (view no nucleo) serializa o registry. As entradas do
  `CATALOGO_ACOES` do midia entram como registros descritivos (rotas REST
  existentes continuam válidas; o endpoint antigo `midia/acoes/` não muda).
- `POST /api/acoes/executar/` `{acao, params}` → valida params declarados, executa,
  responde `{resultado}` | `{detail}`; grava `LogAcao` sempre.

## Modelos (migration no nucleo; midia ganha `agendada_para`)

- `TokenAgente(ComTimestamps)`: `nome` único, `token` (`secrets.token_urlsafe(32)`,
  hash sha256 no banco — comparar por hash), `escopos` JSONField (lista, `*` = tudo,
  prefixo `midia:*`), `ativo`, `ultimo_uso_em`.
- `LogAcao(ComTimestamps)`: `acao`, `params` (sem credenciais), `resultado_resumo`,
  `status` OK|ERRO, `erro`, `usuario` FK null, `agente` FK TokenAgente null.
- Auth: `AutenticacaoAgente` (DRF BaseAuthentication) lendo `X-Agente-Token`;
  permission que aceita `IsGestorOuInstrutor` OU agente com escopo da ação.
- `apps/midia/models.py`: `Postagem.agendada_para` DateTime null + serializer/PATCH
  (fazer POR ÚLTIMO — outro agente pode estar em `apps/midia`; re-ler antes).

## Ações v1

- `avaliacoes/acoes.py`: `gerar_link_avaliacao(turma_codigo)` — cria/reusa
  `ConviteAvaliacao` escopo turma válido e devolve URL pública absoluta (mesma
  base usada nos convites atuais).
- `cursos/acoes.py`: `status_turma(turma_codigo)` — código, curso, datas,
  nº de mídias/postagens/avaliações (imports protegidos).
- `midia/acoes.py`: `listar_postagens_agendadas()` — `agendada_para` não nulo,
  futuro primeiro, shape `PostagemOut` resumido.

## Testes (test client)

Catálogo lista ações; executar sem auth → 401/403; token com escopo errado → 403;
`gerar_link_avaliacao` devolve URL que resolve; `LogAcao` gravado em erro também;
PATCH `agendada_para` funciona. `manage.py check` + migrations limpas em SQLite.

## Fora desta spec

Pré-matrícula pública (`gerar_link_matricula`) — próxima spec (toca frontendExt).
`docs/plataforma/03` — consolidação final do orquestrador.
