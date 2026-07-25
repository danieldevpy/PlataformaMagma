# Tasks 022 — Memória de conversa persistente (Redis)

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | Trocar o nó `Memória da conversa` (SDR) por `memoryRedisChat` + `sessionTTL 21600` + credencial redis, preservando a conexão `ai_memory` | ENTREGUE | claude |
| T2 | Idem pro nó `Memória da conversa (Operadora)` | ENTREGUE | claude |
| T3 | Conferir chaves no Redis (`redis-cli KEYS`) — memória e buffer coexistindo sem colisão | ENTREGUE | claude |
| T4 | Teste real de continuidade: conversa multi-turno em que a 2ª mensagem depende da 1ª | ENTREGUE | claude |
| T5 | Teste real de sobrevivência: `docker restart magma-n8n-dev` no meio da conversa, contexto continua | ENTREGUE | claude |
| T6 | Reexportar `mag-fase-0-sdr.json` + atualizar `workflows/README.md` | ENTREGUE | claude |
| T7 | ADR em `.context/decisoes.md` + `.context/status.md` + `historico/` | ENTREGUE | claude |
| T8 | Promover pra prod junto com a spec 021 (um restart só do n8n) | PENDENTE | — (decisão do Daniel) |

## Ondas

- Onda 1: T1, T2 (mesmo workflow, uma edição)
- Onda 2: T3 → T4 → T5
- Onda 3: T6, T7
- T8 junto com a promoção da spec 021

## Dependência com a spec 021

Implementar **depois** da 021: com o registro de conversas funcionando, o
teste de continuidade (T4/T5) fica verificável no Admin — dá pra ler a
conversa inteira e confirmar que o agente lembrou —, em vez de depender
só de olhar a resposta no WhatsApp.

## Log

- (2026-07-24) Spec criada a partir da pergunta do Daniel ao revisar a
  spec 021: "não daria pra aproveitar o Redis, já que subimos um
  container pra ele?". Confirmado antes de escrever: o nó
  `@n8n/n8n-nodes-langchain.memoryRedisChat` (v1.6) existe nesta build,
  pede credencial tipo `redis` — a mesma dos 5 nós do buffer — e essa
  credencial já existe nos dois ambientes (dev `2tBiS9rJlw88WEfj`, prod
  `dHFQvHd5Xo7cZE86` em `ids-prod.json`). Isso derrubou a alternativa
  Postgres que estava cogitada, porque elimina o único passo manual da
  promoção. Implementação começa depois da 021.
- (2026-07-24, noite) **ENTREGUE em dev (T1-T7)**. Os 2 nós viraram
  `@n8n/n8n-nodes-langchain.memoryRedisChat` v1.6 com `sessionTTL: 21600`
  (6h) e a credencial `redis` já existente. Troca feita por
  `removeNode` + `addNode` + `addConnection` com `sourceOutput:
  "ai_memory"` (em vez de `updateNode` no campo `type`) pra garantir nó
  limpo, sem resto do tipo antigo — e conferida com `mode: filtered`
  depois, como manda a lição da spec 013.
  **Achado real, que o plano previu como risco e aconteceu**: com
  `sessionIdType: customKey` a chave no Redis é literalmente o valor da
  expression — como os dois nós usavam o mesmo `{{ $json.numero }}`, SDR
  e Operadora passariam a **compartilhar a mesma memória**. Isso é uma
  regressão silenciosa em relação à Simple Memory, onde cada nó tinha
  store próprio em RAM e a colisão não existia. Corrigido prefixando por
  agente: `mag:sdr:{numero}` e `mag:operadora:{numero}`. Só apareceu
  porque fui olhar as chaves com `redis-cli KEYS` (T3) em vez de aceitar
  "funcionou". Sem colisão com o buffer da spec 016, que usa `wpp:*`.
  **T4/T5 — o teste que justifica a spec**: mandei "trabalho como
  segurança em eventos e pretendo começar em setembro", rodei
  `docker restart magma-n8n-dev`, esperei o healthcheck e perguntei "você
  lembra em que mês eu falei que pretendo começar, e onde eu trabalho?" —
  a MAG respondeu **setembro** e **segurança em eventos**. Com
  `memoryBufferWindow` isso seria impossível: o restart zerava tudo.
  **Pendente**: T8 — promover junto com a spec 021 (um restart só).
  **Resíduo em dev**: a chave `5521979070319` (sem prefixo), da primeira
  versão do nó antes da correção, expira sozinha em 6h pelo TTL.
