# Tasks 005 — estados: PENDENTE → EM ANDAMENTO → ENTREGUE → DONE

| ID | Tarefa | Estado | Agente |
|---|---|---|---|
| 005-T1 | Registry + `/api/acoes/` + `TokenAgente`/`LogAcao` + auth agente + ações v1 + `agendada_para` + testes | DONE | A3 (onda A) |

Notas T1: escopos `"app:acao"`/`"app:*"`/`"*"`; `gerar_link_avaliacao` reusa
ConviteAvaliacao (não duplica convite válido); catálogo mescla registry executável +
CATALOGO_ACOES do midia (`executavel:false`); contrato completo no retorno do agente
→ consolidar em docs/03 na integração final.

BUG (RESOLVIDO na rodada de correção, mesma data — campo `id` removido do retorno,
teste ajustado, doc 03 atualizado; Postagem não tem uuid, identificação prática por
`turma_codigo` + `agendada_para`): `listar_postagens_agendadas`
(apps/midia/acoes.py) retorna `"id": postagem.id` (PK sequencial) — viola o critério 6
da spec ("IDs públicos: código da turma/uuid — nunca PK") e a constituição. Corrigir
para identificador público (uuid/código) + ajustar teste. Contratos consolidados em
docs/plataforma/03-api-contratos.md (seção Studio 2.0).

- Independente da 002/003 (backend). Cuidado com arquivos compartilhados
  (`config/urls.py`, `apps/midia/*`): edits aditivos, re-ler antes de editar.
- Pré-matrícula pública fica para spec futura (006+).
