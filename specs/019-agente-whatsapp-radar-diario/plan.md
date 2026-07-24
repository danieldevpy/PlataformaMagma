# Plan 019 — Agente WhatsApp: B5 Radar (resumo diário)

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| API (ações) | `apps/nucleo/acoes_resumo.py` novo — ação `resumo_diario`, agrega `Lead`/`Turma`/`Avaliacao`/`Postagem`/`ExecucaoIA` (imports protegidos pros apps opcionais, mesmo padrão de `status_turma`) | `docs/plataforma/03-api-contratos.md` |
| Testes | `apps/nucleo/tests.py` — nova `TestCase` (`ResumoDiarioTests`) | `apps/nucleo/testing.py` |
| n8n | Workflow novo `plataforma/n8n/workflows/mag-radar-resumo-diario.json`: `Schedule Trigger` → `HTTP Request` (chama a ação) → `Code` (formata texto) → `HTTP Request` (Evolution sendText pro gestor) | `plataforma/n8n/workflows/README.md` |
| TokenAgente (dev) | `agente-recepcionista-mag` ganha escopo `nucleo:resumo_diario` | via shell/admin dev |
| Docs | `.context/status.md` + `historico/` + `plataforma/n8n/workflows/README.md` (tabela de workflows + checklist de prod) | regra de higiene do CLAUDE.md |

## Decisões desta feature

- **Sem AI Agent no Radar**: diferente da SDR/Operadora, o Radar não
  precisa de LLM — é um relatório factual com estrutura fixa (contagens e
  listas), formatado por código determinístico (`Code` node). Usar IA
  aqui só custaria tokens/latência e abriria risco de o modelo "floreio
  demais" um número que devia ser exato. Se um dia quiser tom mais
  caloroso no texto, dá pra trocar o `Code` por um agente depois — não é
  decisão irreversível.
- **Workflow separado, não um ramo do `MAG - Fase 0`**: o gatilho é
  `Schedule Trigger`, não `Webhook` — natureza diferente do fluxo de
  mensagem recebida. Mesmo padrão já usado pra `MAG - Nutridora (T+0)`
  (workflow próprio, ativado por evento diferente).
- **Manda só pro Daniel (número hardcoded, igual `avisar_equipe`)**: não
  existe grupo interno configurado ainda (mesma limitação já registrada
  na spec 012/handoff); reavaliar quando houver.
- **Sem AI Agent = sem tool/escopo por "chamada de ferramenta"**: a ação
  `resumo_diario` é chamada direto por um nó `HTTP Request` comum (não
  `toolHttpRequest`), com a mesma credencial `httpHeaderAuth` das demais
  chamadas autenticadas — o escopo ainda é checado do lado do Django
  (`X-Agente-Token`), só não passa pelo crivo de "o LLM decidiu chamar".

## Riscos / pontos de atenção

- `Schedule Trigger` é node novo neste projeto (nenhum workflow existente
  usa) — conferir timezone (`GENERIC_TIMEZONE: America/Sao_Paulo` já está
  no `docker-compose.dev.yml`) pra não disparar na hora errada.
- Mesmos cuidados já documentados: não usar expression `{{ }}` no campo
  `url` de nó que dependa do parser de `{placeholder}` (não se aplica aqui
  — a chamada de `resumo_diario` é `HTTP Request` comum, não
  `toolHttpRequest`, então pode usar expression `{{ }}` normalmente).
- Testar a execução manual antes de confiar no cron (não dá pra esperar
  até amanhã de manhã pra descobrir que quebrou).
