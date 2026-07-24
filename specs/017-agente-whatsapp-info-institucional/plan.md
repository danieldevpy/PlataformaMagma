# Plan 017 — Agente WhatsApp: info institucional (SDR)

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| API (ações) | `apps/nucleo/acoes_institucional.py` novo — ação `info_institucional`, lê `ConfiguracaoSite.obter()`, respeita `exibir_nota_google`/`exibir_total_formados`. Registrada em `apps/nucleo/apps.py::ready()` (mesmo padrão de `acoes_contato.py`) | `docs/plataforma/03-api-contratos.md` |
| Testes | `apps/nucleo/tests.py` — nova `TestCase` (`InfoInstitucionalTests`), mirror de `CamadaDeAcoesTests`/`ListarTurmas` | `apps/nucleo/testing.py` |
| n8n | `plataforma/n8n/workflows/mag-fase-0-sdr.json` — novo nó `toolHttpRequest` `info_institucional` ligado ao AI Agent do SDR, mesma credencial `MAG - X-Agente-Token`/`httpHeaderAuth`, sem parâmetros | `plataforma/n8n/workflows/README.md` |
| TokenAgente (dev) | `agente-recepcionista-mag` ganha escopo `nucleo:info_institucional` | via shell/admin dev |
| Docs | `.context/status.md` + `historico/` + `plataforma/n8n/workflows/README.md` (checklist de prod) | regra de higiene do CLAUDE.md |

## Decisões desta feature

- **Ação nova em vez de reusar `GET /api/site/config/` direto**: mantém o
  padrão único de acesso do agente (`X-Agente-Token` + `/api/acoes/executar/`)
  em vez de abrir mais uma rota pública pro agente chamar sem token — mesma
  razão pela qual `status_turma`/`listar_turmas` existem ao lado da API
  pública de cursos.
- **Ação respeita os toggles em vez de expor os campos crus**: diferente do
  serializer público (que expõe `nota_google`/`total_alunos_formados` sempre,
  deixando o front decidir exibir ou não), a ação do agente omite o valor
  quando o toggle está desligado — um agente de IA não tem "CSS escondido",
  se o dado chega no prompt ele pode acabar falando. Sem isso, desligar a
  nota no site não desligaria a nota na boca da MAG.
- **Sem parâmetros**: `ConfiguracaoSite` é singleton (`obter()`), não precisa
  de nenhum input do agente.

## Riscos / pontos de atenção

- Repetir os cuidados já documentados do n8n: `toolHttpRequest` quebra o
  schema do Gemini se usar header manual (`sendHeaders`) em vez da
  credencial `httpHeaderAuth`; e quebra se o campo `url` usar expression
  `{{ }}` — usar valor literal (`http://magma-backend-interno:8000/...`),
  igual aos outros 15 nós já wired.
- Editar o node via `n8n-mcp` (nunca só o JSON à mão) pra não cair no bug
  de `typeVersion` documentado no `.context/status.md`.
- `n8n_update_partial_workflow` com campo aninhado (`options.systemMessage`)
  já corrompeu o prompt do agente antes (spec 013) — só usar `updateNode`
  bruto se for realmente preciso; adicionar um tool node novo não deveria
  tocar o system prompt.
