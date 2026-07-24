# Tasks 017 — Agente WhatsApp: info institucional (SDR)

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | Ação `info_institucional` em `apps/nucleo/acoes_institucional.py` + registro em `apps.py` | DONE | claude |
| T2 | Testes (`InfoInstitucionalTests`) — sempre presentes, toggle ligado/desligado | DONE | claude |
| T3 | `docs/plataforma/03-api-contratos.md` — entrada da ação | DONE | claude |
| T4 | n8n dev: subir stack, adicionar tool `info_institucional` ao SDR via n8n-mcp, escopo novo no `TokenAgente` dev | DONE | claude |
| T5 | Teste via `n8n_test_workflow` (payload sintético, pergunta de endereço/Instagram) | DONE | claude |
| T6 | Reexportar `mag-fase-0-sdr.json`, atualizar `workflows/README.md` (checklist prod) | DONE | claude |
| T7 | `.context/status.md` + `historico/2026-07-24-...md` | DONE | claude |
| T8 | Promover pra prod (escopo no TokenAgente prod + `promover-prod.sh`) | PENDENTE | — (decisão do Daniel) |

## Ondas

- Onda 1 (paralelo): T1, T3
- Onda 2 (depende de T1): T2
- Onda 3 (depende de T1): T4 → T5 → T6
- Onda 4: T7
- T8 fica pra quando o Daniel decidir promover (mesmo padrão das specs 013-016)

## Log

- (2026-07-24) Spec criada a partir da análise de ferramentas do n8n pedida
  pelo Daniel — gap já estava registrado em `.context/status.md` ("lacunas
  conhecidas"). Iniciando implementação.
- (2026-07-24) **ENTREGUE (T1-T7)**. Ação `info_institucional` implementada
  e testada (4 testes novos, 230/230 na suíte completa). n8n dev precisou
  subir do zero (container não estava rodando); achado no caminho: a porta
  8000 do host está ocupada por **outro projeto** (não a Magma — um sistema
  de APAC hospitalar, processo `root` alheio a esta sessão), então o
  backend real de dev não estava no ar. Sem mexer nesse processo, rodei um
  `runserver` de teste em `0.0.0.0:8001` só pra validar o fluxo, apontando
  temporariamente os 2 nós que precisavam responder (`Identificar Contato`
  + o novo `info_institucional`) pra `:8001` via `n8n-mcp`, e revertendo os
  dois pra `:8000` (padrão real) antes de reexportar o JSON — nenhum outro
  nó foi tocado. Achado no meio do teste: a tool nova retornava 403 porque
  o `TokenAgente agente-recepcionista-mag` (dev) ainda não tinha o escopo
  `nucleo:info_institucional` — adicionado via shell. Teste real via
  `n8n_test_workflow` (pergunta "onde fica a escola... tem Instagram?"):
  a SDR respondeu com endereço e Instagram reais, sem inventar, e sem
  mencionar nota do Google/total de formados (toggles desligados em dev —
  comportamento certo). Único erro da execução foi o esperado (Evolution
  API não roda nesta sessão), igual às specs anteriores.
  **Pendente**: T8 — promover pra prod (escopo `nucleo:info_institucional`
  no `TokenAgente` de prod + `promover-prod.sh mag-fase-0-sdr.json`),
  decisão do Daniel.
