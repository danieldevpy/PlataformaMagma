# Tasks 001 — Rede de segurança: suíte de testes

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).
> Modelo de execução: o do subsistema 09 — orquestrador NÃO coda; delega, revisa, integra.
> Todo agente lê antes: `CLAUDE.md`, `.context/backend.md`, `spec.md` + `plan.md` desta pasta.
> **Padrão obrigatório:** `django.test.TestCase` nativo, `tests.py` por app, `python manage.py test
> --settings=config.settings.test`. Nada de pytest, nada de pasta central.

## Tarefas

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | **Fundação**: `config/settings/test.py` (herda de `base`; DB de teste via `TEST["NAME"]=":memory:"`, `MEDIA_ROOT` em dir temporário limpo no fim, `PASSWORD_HASHERS=[MD5]`, `SECRET_KEY` fixa p/ a cifra de IA, sem depender de `collectstatic`). Helper compartilhado `apps/nucleo/testing.py` (funções: `criar_gestor`, `criar_instrutor`, `criar_curso_turma`, `jpeg_em_memoria(exif_orientation=None)`). Critério: `python manage.py test --settings=config.settings.test` roda os ~45 testes existentes **verdes**, e `db.sqlite3`/`backend/media/` reais ficam intocados (conferir timestamps antes/depois). | DONE | claude |
| T2 | **Público do site**: `apps/cursos/tests.py` (cursos lista+detalhe+404, toggle `exibir_*`→null, painel cursos/turmas + habilidades/FAQs + 403 sem papel) e o caso de `GET /api/site/config/` **em `apps/nucleo/tests.py`** (shape doc 03). Conforme `plan §T2`. Critério: cada rota com ≥1 caso feliz e ≥1 de erro; asserts de shape citam doc 03 em comentário curto quando divergirem do óbvio. | DONE | claude |
| T3 | **Leads**: `apps/leads/tests.py` conforme `plan §T3` (POST público 201/400, painel exige papel/403). | DONE | claude |
| T4 | **Convites públicos**: `apps/avaliacoes/tests.py` (magic-link) + `apps/educacional/tests.py` (carteirinha, app sem nenhum teste até aqui) conforme `plan §T4` (fotos acervo×fallback **mesmo shape**, POST da avaliação, escopo turma×individual). | DONE | claude |
| T5 | **Mídia / acervo (EXPANDIR `apps/midia/tests.py`)**: upload+EXIF/thumb, dedup **409/`forcar`/case/tamanho** (rota por turma, complementa o teste por camada já existente), curadoria D/C/A + `reordenar` + remover, `consentimento`, **postagem→ZIP válido→`publicada_em`**, **403 em TODAS as rotas `/api/midia/`** (tabela exaustiva), páginas staff da turma (a da marca já existia). Testes antigos de `AcervoEmCamadasTests` intocados. | DONE | claude |
| T6 | **IA + Ações (CONSOLIDAR)**: `apps/ia/tests.py` ganhou `AdaptadorGeminiTests` (mock de `requests.post`, nunca API real: executar, erro HTTP→502, credencial cifrada, registro em `REGISTRO_ADAPTADORES`) + `CredencialNuncaVazaNoJsonTests`. Ações (`nucleo/tests.py`) já estavam consolidadas — sem mudança necessária. | DONE | claude |
| T7 | **Regras da constituição (transversal)**: `apps/contas/tests.py` (novo) — `POST /api/token/` par JWT + credencial errada→401; e `AutenticacaoPainelVsMidiaTests` documentando por teste a divergência real de auth (ver T8/log). `conteudo_origem` template→editado já coberto em T2/T4 (cursos, habilidades, faqs, avaliação). | DONE | claude |
| T8 | **Runner**: `plataforma/rodar-testes.sh` (backend sempre; `node --check` em todo `.js` de `backend/static/`; `--full` roda `tsc --noEmit`+`next build`) + seção "Como rodar os testes" no `docs/plataforma/README.md` + `.context/backend.md` atualizado (linha de testes + nota da divergência de auth). Critério verificado: `./rodar-testes.sh` verde, `./rodar-testes.sh --full` verde (Next 16 buildou 9 páginas), falha proposital (assert trocado por `999` em `leads/tests.py`, revertido depois) → **exit 1** confirmado. | DONE | claude |
| T9 | *(Opcional — só se houver remoto Git ativo)* **CI**: `.github/workflows/testes.yml` rodando `rodar-testes.sh` em push/PR. | PENDENTE — não disparada nesta sessão (fora do pedido do Daniel; `origin` existe mas fica a critério dele habilitar CI em nuvem) | |

## Ondas

- **Onda 0 (sozinha, bloqueia tudo):** T1 — sem o `settings/test.py` e o helper, nada roda isolado.
  Já entrega valor: os ~45 testes existentes passam a rodar sob um settings seguro.
- **Onda 1 (paralelo, até 4 agentes):** T2, T3, T4, T5 — apps independentes (`cursos`+`nucleo` config,
  `leads`, `avaliacoes`, `midia`). Regra: nenhum agente altera `settings/test.py` nem
  `apps/nucleo/testing.py`; se faltar helper, registra no log e o orquestrador decide (evita conflito).
  ⚠️ T2 e T6 ambos tocam `apps/nucleo/tests.py` — coordenar: T2 só **acrescenta** o caso `site/config`,
  T6 mexe na parte de ações; se colidirem, T6 entra depois de T2.
- **Onda 2 (paralelo, 2 agentes):** T6 (consolidar ia/ações), T7 (constituição transversal).
- **Onda 3:** T8 (integra tudo) → revisão do orquestrador rodando a suíte completa 2× (determinismo)
  → T9 se aplicável.

## Regras de revisão do orquestrador (por tarefa)

1. Rodar `python manage.py test apps.<app> --settings=config.settings.test -v 2` — verde, sem
   warnings novos graves.
2. Conferir que o teste falharia: escolher 1 assert central, inverter mentalmente (ou de fato) e
   confirmar que pegaria regressão real — teste que nunca falha não protege nada.
3. Testes não alteram código de produção. Se o agente encontrou BUG real ao testar: NÃO consertar
   silenciosamente — registrar no log abaixo e abrir discussão com o Daniel (pode ser regra de negócio).
4. `db.sqlite3` e `backend/media/` reais intocados após a suíte (timestamps).

## Log

- (2026-07-18, manhã) Spec criada (arquiteto). Motivação: v0.1.0 sem testes persistidos; rede de
  segurança antes das features da campanha 08/08.
- (2026-07-18, noite) **Spec REVISADA** após Studio 2.0 (specs 002–005), Acervo em Camadas (spec 008)
  e app `ia` entrarem no repo. Mudanças: (a) **stack revertida** de pytest+pasta central para
  **Django-nativo per-app** — o código consolidou ~45 testes nesse formato antes desta spec rodar,
  migrar seria retrabalho; (b) premissa "zero testes" corrigida — nucleo/ia/midia já têm ilhas de
  cobertura → tarefas agora dizem **consolidar/expandir/novo**; (c) escopo **ampliado** p/ superfície
  nova (ia, camada de ações, acervo **em camadas**, postagens multi-contexto, Studio 2.0); (d)
  `MidiaTurma`→`Midia` e dedup **por escopo de camada** refletidos no §T5; (e) settings de teste
  isolado (`config/settings/test.py`) vira critério de aceite explícito (não existia). Tarefas
  renumeradas p/ T1–T9.
- (2026-07-19) **T1–T8 implementadas em sequência** (pedido do Daniel: "comece a implantar a spec
  01 completamente em sequência"). Suíte final: **120 testes** (era ~45), todos verdes, 2 execuções
  seguidas idênticas (determinismo), `db.sqlite3`/`backend/media/` intocados (timestamps conferidos
  antes/depois). Achado registrado (não é bug a corrigir silenciosamente — é o comportamento real do
  código, só não documentado): `CursoPainelViewSet`, `TurmaPainelViewSet`, `Habilidade`/`FAQ`
  ViewSets, `LeadPainelViewSet`, `AvaliacaoPainelViewSet`, `CriarConvitePainelView` e
  `ConfigPainelView` **não declaram `authentication_classes`** — usam só o
  `DEFAULT_AUTHENTICATION_CLASSES` global (`JWTAuthentication`), então **sessão sozinha (`force_login`)
  não autentica nessas rotas**, só token JWT. Só `apps/midia/views.py` e `apps/ia/views.py` declaram
  `[SessionAuthentication, JWTAuthentication]` e aceitam os dois. Isso diverge da frase genérica
  "Auth API: Session+JWT" que estava em `.context/backend.md` — corrigida nesta sessão para descrever
  o contrato real por grupo de view. Testes escritos refletem o comportamento real (helper
  `jwt_headers` em `apps/nucleo/testing.py`); nenhum código de produção foi alterado — fica para o
  Daniel decidir se os painéis de `cursos`/`leads`/`avaliacoes`/`nucleo` devem passar a aceitar sessão
  também (hoje "o Admin é o painel", então JWT-only pode ser intencional/sem uso real ainda).
  T9 (CI) não disparada — fora do pedido desta sessão.
- (2026-07-19, mais tarde) **Auditoria de lacunas pós-T1–T8** (pedido do Daniel: "analise se tem mais
  algo que precisa ser testado no código"). Achadas e fechadas 10 lacunas fora do mapa original da
  spec — a maioria lógica de negócio real, não só rota nova: (1) ações do Django Admin em `TurmaAdmin`
  (`gerar_link_carteirinha_turma`/`_individual`, apps/cursos/admin.py) — idempotência do link de turma
  nunca provada; (2) `AvaliacaoPainelViewSet` — a **moderação** (aprovar/rejeitar, peso,
  exibir_na_home) nunca tinha teste, só a criação do convite; (3) `AdaptadorOpenAI` sem teste dedicado
  (Anthropic e Gemini já tinham); (4) `apps/ia/prompts.py::montar_mensagem` — monta o prompt que vai
  pra API paga, zero teste direto; (5) `apps/ia/crypto.py::cifrar/decifrar` isolados (string vazia,
  token inválido→`""` sem exceção); (6) `TurmaPainelViewSet.anotacoes` (@action aninhada GET/POST);
  (7) `listar_postagens_agendadas` branch de contexto **curso** (só turma/marca estavam cobertos);
  (8) `status_turma` — contagens `midias`/`postagens`/`avaliacoes` nunca verificadas; (9)
  `Instrutor`/`InstrutorPublicoSerializer` nunca exercitado; (10) `TokenAgenteAdmin.save_model` — a
  "cola" do admin (mensagem com token uma vez só) sem teste. Suíte: **120→147 testes**, todos verdes
  de primeira, 2 execuções seguidas idênticas, `db.sqlite3`/`backend/media/` intocados. Nenhum código
  de produção alterado.
- (2026-07-19, mesma sessão) **Extensão pro frontend** (pedido do Daniel: "e para o front-end falta
  algo?"). O frontend não tinha NENHUMA infra de teste (só `tsc`+`next build`). Setup mínimo: `Vitest`
  (`frontend/vitest.config.ts`, ambiente `node`, sem jsdom/RTL de propósito) cobrindo só lógica pura —
  componentes/interação e E2E de browser real continuam fora de escopo (mesma decisão da spec para o
  browser real do backend). Testes novos (colocados junto do arquivo-fonte): `lib/format.test.ts`
  (`horasPorExtenso` — números por extenso em PT-BR, caso especial "Cem", concordância feminina),
  `lib/whatsapp.test.ts`, `lib/home-cards.test.ts` (merge card estático×API da home), `lib/jsonld.test.ts`
  (dados estruturados de SEO, parse frágil do endereço), `lib/api.test.ts` (o fetch wrapper único usado
  por toda chamada ao backend — sucesso, erro `{detail}`, corpo não-JSON, falha de rede), e
  `app/api/revalidate/route.test.ts` (o webhook Django→Next: **fail-closed** confirmado — sem
  `REVALIDATE_SECRET` no ambiente, nega sempre, mesmo com qualquer header enviado). 56 testes, todos
  verdes de primeira, ~800ms. Integrado ao `rodar-testes.sh` na seção **sempre-ativa** (não `--full`)
  — é mais rápido que o próprio `node --check`. Validado com falha proposital (assert trocado,
  revertido em seguida): exit 1 confirmado. `npm install -D vitest` foi a única dependência nova
  (nenhuma mudança em código de produção do frontend).
