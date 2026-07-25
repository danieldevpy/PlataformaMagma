# 2026-07-24 (noite) — Specs 021 (registro de conversas) e 022 (memória no Redis)

## O que o Daniel pediu

> "uma coisa que parei pra pensar, é que eu acho que preciso gravar as sessões
> de conversas do agente com os 'alunos' que virão, porque tenho que analisar se
> ele vai conseguir responder certo, converter vendas e etc, e hoje para eu
> conseguir eu tenho que olhar as execuções, porém não da pra fazer uma analise
> mais ampla, nem uma LLM analisar. Então quero pensar em uma estratégia de
> armazenar a conversa entre o bot e usuário por pelo menos alguns dias para eu
> poder fazer essa analise, o que acha disso?"

Depois, sobre a retenção:

> "vamos escrever essa spec, penso em no maximo 15 dias por enquanto, se tiver
> algo configuravel seria melhor, para caso eu quiser manter por mais tempo eu
> apenas mudar uma config."

E, ao revisar a spec (o que virou a spec 022):

> "não daria para aproveitar o redis então, já que subimos um container pra ele?"

Por fim: "certo, escreve e já começa a implementar as duas!"

## Diagnóstico antes de escrever

Três coisas pareciam já resolver e nenhuma resolvia:

- **Execuções do n8n** (o que ele olhava): 1 execução = 1 mensagem, não agrupam
  por conversa, são podadas e não dá pra exportar.
- **Postgres da Evolution API** (persistência ligada em 21/07): guarda a mensagem
  crua, mas é schema de terceiro, não sabe qual agente respondeu nem quais
  ferramentas ele chamou, e não liga com `Lead`/`Aluno`.
- **`memoryBufferWindow`**: volátil (RAM do processo), 10 turnos, morre no
  restart — serve pra continuidade, nunca pra análise. Isso virou a spec 022.

## O que foi entregue (dev)

### Spec 021 — registro de conversas

- App novo `apps/conversas/`: `Conversa` (número, papel, vínculo opcional com
  `Lead`/`Usuario`, agente, `escalada`, `desfecho`) + `Turno` (papel, texto,
  `ferramentas` com argumentos, execução n8n). Sessão por **6h de inatividade**.
- 3 ações: `registrar_turnos`, `exportar_conversas` (transcrição em texto
  corrido), `purgar_conversas`.
- `ConfiguracaoSite.conversas_retencao_dias` (padrão 15, `0` = nunca), editável
  no Admin — **não** entra em `CAMPOS_CONFIG`, então não vaza pro site público.
- Admin somente leitura (registro de conversa é prova, não se edita).
- n8n: 1 nó por pista depois do envio (SDR e Operadora), 1 em cada Nutridora
  (T+0 e T+1/3/7, papel `sistema`), 1 de purga no fim do Radar. Todos com
  `onError: continueRegularOutput`.
- 29 testes novos; suíte completa **278** (era 249).

### Spec 022 — memória no Redis

- Os 2 nós `memoryBufferWindow` viraram `memoryRedisChat` (v1.6), `sessionTTL`
  21600 (6h, igual à janela da 021), credencial `redis` já existente.

## Achados reais desta sessão

1. **Bug pego por teste, no código novo**: `params.get("dias") or 7` transformava
   `dias=0` em 7 silenciosamente em vez de recusar. Corrigido com checagem
   explícita de `None`/`""` (mesmo tratamento pro `limite`).

2. **Formato do `intermediateSteps` inspecionado antes de escrever o parser**
   (era tarefa própria no tasks.md, T9): é
   `[{action: {tool, toolInput, toolCallId, log, messageLog}, observation}]`.
   O `observation` carrega o payload inteiro da tool (detalhes do curso = ~4KB)
   — de propósito **não** é gravado; só nome + argumentos.

3. **Chave compartilhada entre agentes (spec 022)**: com `sessionIdType:
   customKey`, a chave no Redis é literalmente o valor da expression. Como SDR e
   Operadora usavam o mesmo `{{ $json.numero }}`, os dois passariam a dividir a
   MESMA memória — regressão silenciosa em relação à Simple Memory, onde cada nó
   tinha store próprio em RAM. Corrigido prefixando: `mag:sdr:{numero}` e
   `mag:operadora:{numero}`. Só apareceu porque olhei as chaves com
   `redis-cli KEYS` em vez de confiar que "funcionou".

4. **Credencial errada por chute**: adicionei os 2 primeiros nós com um ID de
   credencial inventado em vez de conferir no JSON versionado. Corrigido no ato
   (o ID real de dev é `9aPJmxbhrMSs5qYJ`), mas é exatamente o tipo de coisa que
   passaria batido se eu não tivesse conferido com `mode: filtered` depois.

5. **Diff de export ilegível**: reexportar os workflows gerava ~1200 linhas de
   diff cosmético (indentação e ordem de chave) que escondiam a mudança real.
   Tentei reproduzir o estilo antigo (prettier com heurística de preservar
   quebras de linha em objetos) e não valia o tempo. Decisão: formato canônico +
   **script versionado** `exportar-dev.sh` (+ `_limpar_export.py`), contrapartida
   do `promover-prod.sh`. Churn acontece uma vez; daqui pra frente reexportar sem
   mudar nada dá zero diff. Conferi com um diff **semântico** (por nó) que a
   mudança real é só o que eu pretendia — e `mag-avisar-equipe.json` foi
   revertido por não ter mudança nenhuma.

## Testes reais (dev, não só automatizados)

- **Registro**: 2 mensagens do número de teste → 1 conversa, 4 turnos, vinculada
  ao `Lead`, ferramentas capturadas. Desfecho subiu de `lead_registrado` pra
  `handoff` quando o agente chamou `escalar_contato` — exatamente a regra de
  "não retroceder no funil".
- **Memória sobrevivendo a restart** (o teste que a spec 022 existe pra provar):
  mandei "trabalho como segurança em eventos e pretendo começar em setembro" →
  `docker restart magma-n8n-dev` → perguntei "você lembra em que mês eu falei que
  pretendo começar, e onde eu trabalho?" → a MAG respondeu **setembro** e
  **segurança em eventos**. Com a Simple Memory isso seria impossível.
- **Purga**: envelheci uma conversa pra 40 dias, criei outra recente, disparei o
  nó por webhook temporário (removido depois, técnica da spec 019 — `Schedule
  Trigger` não dá pra testar via `n8n_test_workflow`): apagou só a vencida, com
  os turnos em cascata, e `LogAcao` registrou `{'apagadas': 1, 'retencao_dias': 15}`.

## Estado ao sair

Tudo em **dev**, nada em produção. Suíte 278/278. Workflows reexportados.

**Pendente**: promover as duas specs pra prod juntas (mesmo arquivo
`mag-fase-0-sdr.json`, um restart só do n8n) — escopos `conversas:*` no
`TokenAgente` de prod + migrações + `promover-prod.sh` nos 4 workflows.
Decisão do Daniel.

**Resíduo de teste em dev**: sobrou 1 conversa de teste (`5521888887777`,
criada à mão pra provar a seletividade da purga) e a chave Redis
`5521979070319` sem prefixo, da primeira versão do nó de memória — expira
sozinha em 6h pelo TTL.
