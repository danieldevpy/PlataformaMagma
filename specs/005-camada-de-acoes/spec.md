# Spec 005 — Camada de Ações (backend agent-first)

> Fase do plano mestre `docs/subsistemas/10-studio-2.0.md` (§6). Backend puro.

## O quê / porquê

Generalizar o `CATALOGO_ACOES` do app `midia` para a plataforma inteira: registry
central de ações descobrível por agentes (n8n/WhatsApp, Manus), auth por token de
agente com escopos, auditoria de toda execução. Primeiras ações: link de avaliação,
status da turma, fila de postagens agendadas. ("gere um link de avaliação para a
turma 027" vira uma chamada de API que o bot faz sozinho.)

## Critérios de aceite

1. `GET /api/acoes/` lista TODAS as ações registradas (nome, descrição, params,
   escopo) — o catálogo do `midia` aparece lá sem quebrar o endpoint antigo.
2. `POST /api/acoes/executar/` `{acao, params}` executa com Session/JWT (humano)
   OU header `X-Agente-Token` (agente); escopo do token é respeitado (403 fora
   dele); TODA execução (sucesso e erro) gera `LogAcao`.
3. Ações v1: `gerar_link_avaliacao(turma_codigo)` → URL pública do convite por
   turma; `status_turma(turma_codigo)` → datas/curso/contagens;
   `listar_postagens_agendadas()` → postagens com `agendada_para` preenchido.
4. `Postagem.agendada_para` (DateTime null) + expor no serializer/PATCH.
5. `TokenAgente` gerenciável no admin (nome, token gerado, escopos, ativo);
   token aparece UMA vez na criação.
6. IDs públicos: código da turma/uuid — nunca PK (constituição §6).

## Critério de aceite do gestor

Daniel cria o token `agente-n8n` no admin, cola no n8n, e um fluxo de teste
responde no WhatsApp o link de avaliação da turma pedida.
