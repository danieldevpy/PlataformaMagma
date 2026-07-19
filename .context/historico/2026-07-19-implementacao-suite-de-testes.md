# 2026-07-19 — Implementação completa da suíte de testes (spec 001, T1–T8)

## Prompt do Daniel (essência)

> "Eu tinha feito uma spec sobre os testes automatizados, porém desenvolvi novas
> features, então acredito que o plano deve haver mudanças, então analise tudo e veja
> se preciso atualizar a spec antes de começar a implementar." → spec revisada (sessão
> anterior, mesma data à noite) → "comece a implantar a spec 01 completamente em
> sequência."

## O que foi feito

1. **Revisão da spec 001** (antes desta implementação, registrada em commit separado):
   stack revertida de pytest→Django-nativo per-app (o código já tinha consolidado ~45
   testes nesse formato); escopo ampliado p/ ia/ações/acervo em camadas/Studio.
2. **T1 — Fundação**: `config/settings/test.py` (DB `:memory:`, `MEDIA_ROOT` temporário
   com limpeza via `atexit`, `SECRET_KEY` fixa, hasher MD5) + `apps/nucleo/testing.py`
   (helpers `criar_gestor`/`criar_instrutor`/`criar_curso_turma`/`jpeg_em_memoria`/
   `png_em_memoria`/`jwt_headers`). Os ~45 testes existentes passaram a rodar isolados.
3. **T2 — Público do site**: `apps/cursos/tests.py` (novo) — lista/detalhe/404, toggles
   `preco`/`countdown`→null, painel cursos/turmas/habilidades/faqs (ciclo criar→editar→
   listar, `conteudo_origem` template→editado). `GET /api/site/config/` +
   `/api/painel/config/` em `apps/nucleo/tests.py`.
4. **T3 — Leads**: `apps/leads/tests.py` (novo) — POST público 201/400, painel (`IsGestor`).
5. **T4 — Convites públicos**: `apps/avaliacoes/tests.py` (novo) — convite magic-link
   (fotos do acervo com prioridade de capa × fallback `FotoCurso`, mesmo shape), POST da
   avaliação, escopo turma×individual, `painel/convites`. `apps/educacional/tests.py`
   (novo, app sem nenhum teste até então) — convite de carteirinha, mesmo padrão.
6. **T5 — Mídia/acervo**: expansão pesada de `apps/midia/tests.py` (sem tocar o que já
   passava) — EXIF Orientation=6→thumb corrigido, dedup 409/`forcar`/case-insensitive/
   tamanho (rota por turma), curadoria (PATCH tags/legenda), `reordenar`, remoção,
   `consentimento`, postagem→ZIP válido→`publicada_em`, **403 exaustivo** em todas as
   rotas `/api/midia/` (tabela com as 14 rotas), páginas staff da turma.
7. **T6 — IA + Ações**: `AdaptadorGeminiTests` em `apps/ia/tests.py` (mock de
   `requests.post`, nunca API real — executar, erro HTTP→502, credencial cifrada,
   registro em `REGISTRO_ADAPTADORES`) + `CredencialNuncaVazaNoJsonTests`. Ações
   (`nucleo/tests.py`) já estavam cobertas.
8. **T7 — Constituição transversal**: `apps/contas/tests.py` (novo) — `POST /api/token/`
   (par JWT, credencial errada→401) e um teste que **documenta por código** a divergência
   de auth descoberta (ver achado abaixo).
9. **T8 — Runner**: `plataforma/rodar-testes.sh` (backend sempre + `node --check` em
   todo `.js` de `static/`; `--full` roda `tsc --noEmit`+`next build`). Seção "Como rodar
   os testes" em `docs/plataforma/README.md`; `.context/backend.md` atualizado.

## Achado registrado (não é bug corrigido silenciosamente)

`CursoPainelViewSet`, `TurmaPainelViewSet`, `Habilidade`/`FAQ` ViewSets,
`LeadPainelViewSet`, `AvaliacaoPainelViewSet`, `CriarConvitePainelView` e
`ConfigPainelView` **não declaram `authentication_classes`** — usam só o
`DEFAULT_AUTHENTICATION_CLASSES` global (`JWTAuthentication`). Sessão (`force_login`)
**não** autentica nessas rotas, só token JWT. Só `apps/midia/views.py` e
`apps/ia/views.py` declaram `[SessionAuthentication, JWTAuthentication]` e aceitam os
dois. Isso diverge da frase genérica "Auth API: Session+JWT" que estava em
`.context/backend.md` — corrigida nesta sessão pra descrever o contrato real por grupo
de view. **Nenhum código de produção foi alterado** — os testes refletem o
comportamento real (helper `jwt_headers`); fica pro Daniel decidir se os painéis de
`cursos`/`leads`/`avaliacoes`/`nucleo` devem passar a aceitar sessão também (hoje "o
Admin é o painel" — JWT-only pode ser intencional, sem uso real ainda).

## Validação

- Suíte completa: **120 testes**, todos verdes, 2 execuções seguidas idênticas
  (determinismo).
- `db.sqlite3` (timestamp) e `backend/media/` (contagem de arquivos) intocados
  antes/depois.
- `./rodar-testes.sh` verde; `./rodar-testes.sh --full` verde (Next 16 buildou as 9
  rotas, `tsc --noEmit` sem erro).
- Falha proposital (assert trocado por `999` em `leads/tests.py`, revertido em seguida):
  runner saiu com **exit 1**, confirmando o critério de aceite.

## Segunda rodada — auditoria de lacunas (mesmo dia, sessão contínua)

Daniel pediu: "analise se tem mais algo que precisa ser testado no código". Fiz uma
varredura do que a spec 001 **não** mapeava (admin.py de cada app, `acoes.py`,
adapters de IA, `prompts.py`, `crypto.py`) e achei 10 lacunas reais — priorizadas e
todas fechadas a pedido do Daniel ("sim, tudo"):

1. **Ações do Django Admin em `TurmaAdmin`** (`gerar_link_carteirinha_turma`/
   `_individual`) — a idempotência do link de turma (get_or_create) nunca tinha sido
   provada. Testado via POST na changelist do admin com superusuário.
2. **`AvaliacaoPainelViewSet`** — a moderação (aprovar/rejeitar, peso,
   `exibir_na_home`) não tinha nenhum teste; só a criação do convite tinha.
3. **`AdaptadorOpenAI`** — Anthropic e Gemini já tinham teste de adapter dedicado
   (mock de `requests.post`), OpenAI ficou de fora até esta rodada.
4. **`apps/ia/prompts.py::montar_mensagem`** — a montagem do prompt que vai pra API
   paga (contexto, campos extras, fallback vazio) nunca foi testada diretamente.
5. **`apps/ia/crypto.py`** — `cifrar`/`decifrar` isolados (string vazia, token
   inválido → `""` sem exceção), só cobertos indiretamente via `ProvedorIA`.
6. **`TurmaPainelViewSet.anotacoes`** — `@action` aninhada (GET/POST), zero teste.
7. **`listar_postagens_agendadas`** — branch de contexto **curso** (`curso_slug`)
   nunca testado, só turma/marca.
8. **`status_turma`** — contagens `midias`/`postagens`/`avaliacoes` nunca verificadas.
9. **`Instrutor`/`InstrutorPublicoSerializer`** — nunca aparecia em nenhum teste.
10. **`TokenAgenteAdmin.save_model`** — a "cola" do admin (token bruto mostrado uma
    vez só na mensagem) não tinha teste, só o método de model por trás.

Suíte: **120 → 147 testes**, todos verdes já na primeira execução (nenhum retrabalho
de ajuste), 2 rodadas seguidas idênticas, `db.sqlite3`/`backend/media/` intocados.
Nenhum código de produção foi tocado nesta rodada — só teste.

## Terceira rodada — extensão pro frontend (mesmo dia, sessão contínua)

Daniel perguntou: "e para o front-end falta algo?". O frontend não tinha **nenhuma**
infra de teste (só `tsc --noEmit` + `next build` como smoke). Mapeei o código e achei
lógica pura de risco real sem cobertura — a mais crítica sendo `lib/api.ts::api()` (o
único ponto por onde passa toda chamada ao backend) e `app/api/revalidate/route.ts` (o
webhook que o Django chama pra invalidar cache, com autenticação por segredo em
produção). Perguntei o escopo antes de mexer; Daniel escolheu "Vitest + lógica pura"
(sem React Testing Library/jsdom — componentes/E2E ficam pra depois, mesma lógica do
corte que a spec 001 já fazia pro backend).

Implementado:
- `npm install -D vitest` (única dependência nova) + `frontend/vitest.config.ts`
  (ambiente `node`, sem jsdom) + script `npm run test` (`vitest run`).
- Testes colocados junto do arquivo-fonte: `lib/format.test.ts` (`horasPorExtenso` —
  números por extenso em PT-BR, com o caso especial "Cem" e a concordância feminina
  "Uma" em vez de "Um"), `lib/whatsapp.test.ts`, `lib/home-cards.test.ts` (merge
  card estático × curso da API na home), `lib/jsonld.test.ts` (SEO estruturado, parse
  do endereço por `" — "`), `lib/api.test.ts` (sucesso, erro `{detail}` do doc 03,
  corpo não-JSON, falha de rede — `fetch` mockado via `vi.stubGlobal`), e
  `app/api/revalidate/route.test.ts` (mock de `next/cache`; provei que o webhook é
  **fail-closed**: sem `REVALIDATE_SECRET` configurado no ambiente, nega sempre,
  mesmo com qualquer header enviado).
- 56 testes, todos verdes já na primeira execução. `tsc --noEmit`, `eslint` e
  `next build` seguem limpos com os arquivos novos.
- Integrado ao `rodar-testes.sh` na seção **sempre-ativa** (não atrás de `--full`) —
  roda em ~800ms, mais rápido que o próprio `node --check` dos estáticos do backend.
- Validado com falha proposital (assert trocado em `whatsapp.test.ts`, revertido em
  seguida): runner saiu com exit 1.

## Estado ao sair / handoff

- Backend: T1–T8 DONE + auditoria de lacunas fechada (147 testes). Frontend: infra de
  teste criada do zero + 56 testes de lógica pura. T9 (CI em GitHub Actions) não
  disparada — opcional, fora do pedido desta sessão; `origin` existe no repo mas fica a
  critério do Daniel habilitar.
- Nenhum arquivo de **produção** foi alterado em nenhuma das 3 rodadas — só testes,
  settings de teste, config do Vitest, runner e docs.
- Pendência natural (não pedida, só registrada): componentes interativos do frontend
  (`LeadForm`, `AvaliacaoExperience`, `CarteirinhaExperience`, `Countdown`) e E2E de
  browser real seguem sem teste automatizado — precisam de jsdom+Testing Library ou
  Playwright, um investimento maior. Fica pra quando/se o Daniel quiser.
- Arquivos desta sessão ainda **não commitados** (Daniel não pediu commit ainda).
