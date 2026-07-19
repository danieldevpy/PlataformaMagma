# 2026-07-18 — Studio 2.0: implementação das specs 002..005 (orquestração de agentes)

## Prompt do Daniel (essência)
> Implementar o plano mestre do Studio 2.0 parte a parte, sem quebrar o código,
> funcionando em dev e prod. Claude atua só como arquiteto/orquestrador delegando
> a agentes Sonnet (máx. 4 simultâneos, reutilizar agentes), revisando criticamente
> cada entrega, com tudo documentado para retomada entre sessões.

## Como foi (2 sessões — a 1ª caiu no meio da onda B)
- **Sessão 1**: grounding + specs 002..005 escritas (spec/plan/tasks) + Onda A completa
  (4 agentes, áreas disjuntas): motor declarativo + formacao.js; app `apps.ia`;
  camada de ações no `nucleo`; endpoint de avaliações + `marca.js`. Onda B disparada e perdida.
- **Sessão 2 (esta)**: auditoria do disco (só `depoimento.js` da onda B sobreviveu),
  Onda B redisparada (UI declarativa do Studio; vagas.js; formatura/educativo/capa_reel),
  003-T4 (integração: picker contextual por `fontes`, script tags, MAGMA_TURMA estendido,
  resolverLegenda), Onda C (página "Integrações de IA" + ✨), validação de integração
  (agente dedicado: harness headless 62/62, test client 9/9, dev server 8123, browser
  Brave isolado 6/6 templates), consolidação de contratos no doc 03, e rodada de
  correção dos 4 achados (abaixo).

## Bugs achados na validação e corrigidos
1. (MÉDIA) CSS: preview 9:16 vazava sobre a barra de variantes (v2 do fix ainda distorcia
   a arte quando `max-height` clampava; v3 final: eixo de referência = height + `object-fit:contain`
   — aprovado no browser com 0% de desvio em 4 cenários). Ver comentário-histórico no `studio.css`.
2. (SPEC) `listar_postagens_agendadas` vazava PK — removido (constituição: IDs públicos).
3. (BAIXA) `renderizar()` não validava formato pedido vs declarado — guard adicionado.
4. (INFO) Aviso operacional: rotação de `DJANGO_SECRET_KEY` invalida credenciais de IA
   cifradas (doc 03 + comentário no `crypto.py`).

## Estado ao sair / handoff
- Specs **002, 003, 004, 005: DONE** (trackers em `specs/*/tasks.md`). Suíte: **39/39**.
- Contratos novos consolidados em `docs/plataforma/03-api-contratos.md` (seção Studio 2.0).
- `.context/status.md`, `backend.md` e `decisoes.md` atualizados nesta sessão.
- **Nada commitado** (Daniel pede o commit). Próximos passos: teste manual do Daniel
  no Studio + configurar provedor de IA real; specs 006/007 (imagem/vídeo IA,
  pré-matrícula pública, render server-side); spec 001 (suíte ampla) segue recomendada.
- Nota: a 1ª tentativa de browser da validação pode ter aberto 1-2 abas `about:blank`
  no Brave real do Daniel (single-instance) — inofensivo, pode fechar.
