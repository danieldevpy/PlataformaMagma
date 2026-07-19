# Tasks 001 — Rede de segurança: suíte de testes

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).
> Modelo de execução: o do subsistema 09 — orquestrador NÃO coda; delega, revisa, integra.
> Todo agente lê antes: `CLAUDE.md`, `.context/backend.md`, `spec.md` + `plan.md` desta pasta.
> **Padrão obrigatório:** `django.test.TestCase` nativo, `tests.py` por app, `python manage.py test
> --settings=config.settings.test`. Nada de pytest, nada de pasta central.

## Tarefas

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | **Fundação**: `config/settings/test.py` (herda de `base`; DB de teste via `TEST["NAME"]=":memory:"`, `MEDIA_ROOT` em dir temporário limpo no fim, `PASSWORD_HASHERS=[MD5]`, `SECRET_KEY` fixa p/ a cifra de IA, sem depender de `collectstatic`). Helper compartilhado `apps/nucleo/testing.py` (funções: `criar_gestor`, `criar_instrutor`, `criar_curso_turma`, `jpeg_em_memoria(exif_orientation=None)`). Critério: `python manage.py test --settings=config.settings.test` roda os ~45 testes existentes **verdes**, e `db.sqlite3`/`backend/media/` reais ficam intocados (conferir timestamps antes/depois). | PENDENTE | |
| T2 | **Público do site**: `apps/cursos/tests.py` (cursos lista+detalhe+404, toggle `exibir_*`→null, painel cursos/turmas + habilidades/FAQs + 403 sem papel) e o caso de `GET /api/site/config/` **em `apps/nucleo/tests.py`** (shape doc 03). Conforme `plan §T2`. Critério: cada rota com ≥1 caso feliz e ≥1 de erro; asserts de shape citam doc 03 em comentário curto quando divergirem do óbvio. | PENDENTE | |
| T3 | **Leads**: `apps/leads/tests.py` conforme `plan §T3` (POST público 201/400, painel exige papel/403). | PENDENTE | |
| T4 | **Convites públicos**: `apps/avaliacoes/tests.py` conforme `plan §T4` (convite magic-link c/ fotos acervo×fallback **mesmo shape**, POST da avaliação, carteirinha, escopo turma×individual). Antes de escrever, LER as views de `avaliacoes` e da carteirinha — regras de token/reenvio saem do código. | PENDENTE | |
| T5 | **Mídia / acervo (EXPANDIR `apps/midia/tests.py`)**: adicionar o smoke pesado que falta ao que já existe — upload+EXIF/thumb, dedup **409/`forcar`/case/tamanho por escopo de camada**, curadoria D/C/A + capa única + `reordenar`, `consentimento`, **postagem→ZIP válido→`publicada_em`**, **403 em TODAS as rotas `/api/midia/`**, e as páginas staff da turma **e** da marca (200/redirect). Conforme `plan §T5`. **Não** reescrever os testes de camadas que já passam — só somar. | PENDENTE | |
| T6 | **IA + Ações (CONSOLIDAR)**: revisar `apps/ia/tests.py` e `apps/nucleo/tests.py` conforme `plan §T6` — garantir que rodam no runner e fechar lacunas: se `apps/ia/adapters/gemini.py` estiver no merge, smoke **mockado** do `AdaptadorGemini` + `Provedor.GEMINI` cifra credencial; reforçar "credencial nunca volta no JSON" e 403 sem login em `ia/*` e `acoes/*`. | PENDENTE | |
| T7 | **Regras da constituição (transversal)**: cobrir onde ainda não estiver — `POST /api/token/` (par JWT; painel aceita JWT **e** sessão; sem credencial → 401/403) e `conteudo_origem` template→editado no app dono do modelo tocado; erros `{"detail"}`. Conforme `plan §T7`. Pode virar `apps/contas/tests.py` (novo) se for o lar mais natural do teste de auth. | PENDENTE | |
| T8 | **Runner**: `plataforma/rodar-testes.sh` (backend via `manage.py test --settings=config.settings.test` sempre; `node --check` nos estáticos de `midia`/`ia`/`admin` se houver Node; `--full` roda tsc+next build) + seção "Como rodar os testes" no `docs/plataforma/README.md` + atualizar `.context/backend.md` (1 linha: onde ficam os testes e como rodar). Critério: `./rodar-testes.sh` verde; `./rodar-testes.sh --full` verde; falha proposital (quebrar 1 assert) → exit ≠ 0. | PENDENTE | |
| T9 | *(Opcional — só se houver remoto Git ativo)* **CI**: `.github/workflows/testes.yml` rodando `rodar-testes.sh` em push/PR. | PENDENTE | |

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
  renumeradas p/ T1–T9. Aguardando Daniel disparar a Onda 0.
