# Plan 022 — Memória de conversa persistente (Redis)

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| n8n | `mag-fase-0-sdr.json`: 2 nós de memória trocam de tipo (`memoryBufferWindow` → `memoryRedisChat`), ganham `sessionTTL` e a credencial `redis` | `plataforma/n8n/workflows/README.md` |
| Docs | `workflows/README.md` (tabela de nós/credenciais) + `.context/decisoes.md` (ADR) + `.context/status.md` + `historico/` | regra de higiene do CLAUDE.md |
| Backend | **nenhum** — esta spec não toca no Django | — |

Nenhuma migração, nenhuma ação nova, nenhum escopo novo. É uma spec de
infraestrutura de workflow.

## Decisões desta feature

- **Redis, não Postgres**: a credencial `redis` já existe em dev **e** em
  prod (mapeada em `ids-prod.json`), então `promover-prod.sh` remapeia
  sozinha e a promoção não precisa de nenhum passo manual. Postgres Chat
  Memory exigiria criar credencial à mão no editor de produção — o único
  passo do projeto que nunca deu pra automatizar com segurança. Somando
  a isso o `sessionTTL` nativo (expiração sem cron), Redis ganha em todos
  os critérios que importam aqui.

- **`sessionTTL: 21600` (6h), igual à janela de sessão da spec 021**: os
  dois sistemas precisam concordar sobre o que é "uma conversa". Se a
  memória durasse mais que a janela do registro, o agente lembraria de
  algo que o registro já classificou como conversa passada — incoerência
  que apareceria justamente na hora de analisar por que ele respondeu o
  que respondeu.

- **Reusar a credencial do buffer em vez de criar uma segunda**: aponta
  pro mesmo container, mesmo banco lógico. Criar uma credencial separada
  só pra "ficar organizado" custaria um passo manual em prod e não
  isolaria nada de verdade.

- **Sem mudança no `contextWindowLength` (10)**: trocar o *onde* a
  memória mora e o *quanto* ela guarda ao mesmo tempo tornaria impossível
  saber a qual mudança atribuir qualquer diferença de comportamento.
  Uma variável por vez.

- **Trocar o tipo do nó via `n8n-mcp`, não pela API crua**: bug conhecido
  já documentado (spec 010, achado 2) — node com `typeVersion` trocado
  pela API fica "não instalado" no editor visual, mesmo executando
  normal.

## Riscos / pontos de atenção

- **Caminho crítico.** Esta é a diferença de risco em relação à spec 021:
  se o nó novo estiver mal configurado, o agente para de responder — não
  é uma falha silenciosa de registro. Por isso os dois testes reais são
  critério de aceite, não "nice to have": continuidade multi-turno **e**
  sobrevivência a `docker restart`.
- **Colisão de chaves no Redis**: o buffer (spec 016) usa chaves próprias
  por número; o `memoryRedisChat` usa o `sessionKey` (também o número).
  Conferir com `redis-cli KEYS *` que os dois conjuntos coexistem e que
  a memória não sobrescreve a lista do buffer — se houver colisão,
  prefixar o `sessionKey` da memória (ex.: `mem:{{ $json.numero }}`).
- **Ordem de implementação**: fazer a 021 primeiro. Com o registro de
  conversas já funcionando, o teste de continuidade da 022 fica
  verificável no Admin (dá pra ler a conversa inteira e confirmar que o
  agente lembrou), em vez de depender só de olhar a resposta no WhatsApp.
- **Promoção junto com a 021**: as duas mexem no mesmo arquivo
  (`mag-fase-0-sdr.json`) e as duas precisam ir pra prod. Promover juntas
  = um restart só do n8n de produção.
- Cuidados de n8n já documentados: `patchNodeField` pra campo aninhado,
  nunca `updateNode` bruto (spec 013); conferir com `mode: filtered`
  depois de editar.
