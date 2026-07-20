# Tasks 012 — Handoff: escalar pro humano e silenciar o bot

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | Modelo `ContatoEscalado` + migration + admin | DONE | claude |
| T2 | `identificar_contato` ganha campo `escalado` + ação `escalar_contato` + testes | DONE | claude |
| T3 | `TokenAgente agente-recepcionista-mag` ganha escopo `nucleo:escalar_contato` | DONE | claude |
| T4 | Workflow: IF "Está escalado?" (silêncio) + tools `escalar_contato`/`avisar_equipe` + system prompt | DONE | claude |
| T5 | `docs/plataforma/03-api-contratos.md` — atualizar `identificar_contato`, registrar `escalar_contato` | DONE | claude |
| T6 | Teste real: mensagem de handoff → Daniel avisado → contato silenciado → libera no admin → volta a responder | DONE | claude |

## Ondas

- Onda 1: T1
- Onda 2 (depende de T1): T2, T3
- Onda 3 (depende de T2, T3): T4, T5
- Onda 4 (depende de T4): T6

## Log

- (2026-07-20) Spec criada a pedido do Daniel, depois de perguntar onde no
  plano estava documentada a parte de avisar o gestor / intervenção humana
  no chat — resposta apontou §4 (A0 handoff, B1, B5) e §5 (regra Handoff)
  do plano-mãe; nenhuma das três ainda tinha spec própria. Handoff
  escolhido por ser o que mais falta pro SDR não ficar "sozinho" numa
  conversa que precisa de humano.
- (2026-07-20) Spec ENTREGUE e validada — mas com um bug novo do n8n
  descoberto no caminho (registrar pra não repetir a investigação):
  **`toolHttpRequest` com `sendHeaders: true` e header definido manualmente
  (`headerParameters`, mesmo com `valueProvider: "fieldValue"` explícito)
  quebra o schema de function-calling gerado pro Gemini** — erro
  `GenerateContentRequest.tools[].function_declarations[].parameters.properties[]:
  key cannot be empty`, acontece na hora de montar a lista de tools pro
  Agent, não na chamada HTTP em si. `listar_cursos`/`detalhes_curso`/
  `registrar_lead` (spec 010) nunca tinham testado `sendHeaders`, por isso
  o bug não tinha aparecido antes. **Fix**: em vez de header manual, usar
  credencial `httpHeaderAuth` (`authentication: "genericCredentialType"`,
  `genericAuthType: "httpHeaderAuth"`) — bypassa o código de extração de
  placeholder dos headers que está quebrado. Duas credenciais criadas via
  `n8n-mcp`: "MAG - X-Agente-Token" e "MAG - Evolution apikey". Achado
  secundário: `toolHttpRequest` não entende `$fromAI()` dentro de
  expressão (`={{ }}`) — só o mecanismo próprio de `{placeholder}` em
  texto literal; e um placeholder por valor JSON completo (não dá pra
  misturar texto fixo + `{placeholder}` no mesmo campo de string).
  Ciclo completo testado via `n8n_test_workflow` (webhook direto, sem
  precisar do Daniel reenviar): escalar → avisar equipe (WhatsApp real
  chegou) → silêncio confirmado (mensagem seguinte não gerou resposta) →
  liberado via shell (simulando apagar no admin) → voltou a responder
  normal.
