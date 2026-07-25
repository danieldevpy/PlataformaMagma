# Spec 022 — Memória de conversa persistente (Redis)

> Irmã da spec 021 (registro de conversas). Nasceu de uma pergunta do
> Daniel ao revisar a 021: "não daria pra aproveitar o Redis, já que
> subimos um container pra ele?" — daria, e é melhor que a alternativa
> (Postgres) que eu tinha cogitado. Motivador imediato: a campanha de
> tráfego pago (spec 018) traz leads reais pelo WhatsApp.

## Problema / oportunidade

Os dois AI Agents do workflow `MAG - Fase 0 (eco WhatsApp)` usam
`memoryBufferWindow` ("Simple Memory") pra lembrar o que já foi dito na
conversa. Esse nó guarda tudo **na RAM do processo do n8n** — sem banco
por trás. Consequências reais:

- **Todo restart do n8n zera a memória de todo mundo.** E restart não é
  raro: `promover-prod.sh` reinicia o n8n a cada promoção de workflow, e
  o deploy de 24/07 reiniciou. Cada vez, todo lead com conversa em
  andamento vira um estranho pro agente no meio do papo — logo depois de
  ter contado nome, curso de interesse e quando pretende começar.
- Não dá pra inspecionar nem migrar: a memória morre sem deixar rastro.

Com a campanha a poucos dias, um deploy no meio da tarde significa lead
quente sendo tratado do zero. É um jeito silencioso de perder venda.

## Por que Redis (e não Postgres)

O n8n tem o nó `Redis Chat Memory`, que pede credencial do tipo `redis` —
**a mesma** que os 5 nós do buffer (spec 016) já usam. E essa credencial
**já existe nos dois ambientes**: em dev (`MAG - Redis Buffer (dev)`,
`2tBiS9rJlw88WEfj`) e em prod (mapeada em `ids-prod.json`,
`dHFQvHd5Xo7cZE86`, criada à mão pelo Daniel no deploy de 24/07). O
container também já está configurado pra durar (`redis-server
--appendonly yes`, volume `n8n_redis_data`).

Ou seja: **zero infra nova, zero passo manual em produção** — diferente
do Postgres Chat Memory, que exigiria credencial nova criada à mão no
editor de prod.

## O que muda para o usuário

- Um lead que estava conversando com a MAG continua de onde parou mesmo
  que o n8n reinicie (deploy, restart de container, queda).
- A conversa "esquece" sozinha depois de 6 horas de silêncio — mesma
  janela que a spec 021 usa pra considerar que começou uma conversa
  nova. Os dois lados do sistema concordam sobre o que é "uma conversa".
- Nada muda na experiência normal: mesma janela de 10 interações, mesmo
  comportamento do agente.

## Critérios de aceite

- [ ] Os dois nós de memória do `MAG - Fase 0 (eco WhatsApp)` passam de
      `@n8n/n8n-nodes-langchain.memoryBufferWindow` para
      `@n8n/n8n-nodes-langchain.memoryRedisChat`, preservando:
      `sessionIdType: customKey`, `sessionKey: {{ $json.numero }}` e
      `contextWindowLength: 10`.
- [ ] `sessionTTL: 21600` (6h) nos dois — expiração nativa do Redis,
      sem purga, sem cron, sem código.
- [ ] Os dois usam a credencial `redis` já existente (a mesma do buffer).
- [ ] As conexões `ai_memory` continuam ligando cada memória ao seu
      agente (SDR → `SDR - Capitã de Matrículas`; Operadora →
      `Operadora - Secretária Digital`), sem trocar os fios.
- [ ] **Teste real de continuidade**: conversa de vários turnos em que a
      segunda mensagem depende da primeira (ex.: "meu nome é X" → "qual
      curso você quer?" → responde sem repetir o nome) e o agente
      demonstra lembrar.
- [ ] **Teste real de sobrevivência**: `docker restart magma-n8n-dev` no
      meio da conversa e a mensagem seguinte mostra que o contexto
      continua lá — que é exatamente o que hoje NÃO acontece.
- [ ] Chaves visíveis no Redis (`docker exec ... redis-cli KEYS ...`) e
      convivendo com as chaves do buffer sem colisão.
- [ ] `mag-fase-0-sdr.json` reexportado; `workflows/README.md` atualizado.

## Critério de aceite do gestor

O Daniel pode promover um workflow pra produção no meio do dia sem medo
de cortar a conversa de um lead que está prestes a se matricular.

## Riscos assumidos (registrados de propósito)

- **Redis passa a segurar duas funções** (buffer + memória). Se o Redis
  cair, hoje já quebra o fluxo inteiro de mensagens (o buffer da spec 016
  está no caminho crítico de toda mensagem recebida) — então não é um
  ponto único de falha novo, mas o estrago de uma queda fica maior.
- **Mexe no que já funciona.** Diferente da 021 (que só pendura nós no
  fim do fluxo), aqui a alteração é dentro do caminho vivo do
  atendimento. Daí os dois testes reais obrigatórios acima.
- **A memória atual se perde na troca** — irrelevante na prática: ela já
  se perde a cada restart.

## Fora de escopo

- Renomear a credencial `MAG - Redis Buffer (dev)` pra algo mais neutro
  agora que ela serve buffer **e** memória. Renomear em prod é passo
  manual no editor, e o nome não afeta funcionamento — fica documentado
  como dívida cosmética.
- Aumentar a janela de 10 interações. É outra discussão (custo de tokens
  por mensagem), independente de onde a memória mora.
- Memória de longo prazo / CRM ("o que esse lead já perguntou semana
  passada"). Isso é a spec 021 (registro na plataforma) + `Lead`, não
  memória de conversa.
- Trocar a memória de workflows que não têm agente conversacional
  (Nutridoras, Radar, Avisar Equipe não usam memória).
