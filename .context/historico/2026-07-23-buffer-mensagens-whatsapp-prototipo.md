# 2026-07-23 (madrugada seguinte) — Buffer de mensagens fragmentadas (protótipo)

## Prompt do Daniel

Perguntou sobre um padrão que viu na internet: n8n "aguardar e juntar"
mensagens fragmentadas do WhatsApp (ex.: usuário manda o CPF numa
mensagem e o valor na mensagem seguinte) antes do bot responder, em vez
de reagir a cada fragmento isolado. Depois de eu explicar o padrão
(debounce/message buffer) e mapear onde encaixaria no workflow real,
confirmou pra eu prototipar direto no n8n dev.

## Decisões tomadas com o Daniel (`AskUserQuestion`)

- **Storage**: Redis novo e dedicado (não reaproveitar o Redis da
  Evolution API — mantém o padrão "infra dedicada" já usado no projeto).
- **Escopo**: protótipo direto no n8n dev primeiro, spec formal só depois
  de validar o comportamento.

## O que foi feito

- **Container novo** `magma-n8n-redis-dev` (`redis:7-alpine`, AOF) em
  `plataforma/n8n/docker-compose.dev.yml`, volume próprio
  (`n8n_redis_dev_data`) — não compartilha nada com
  `magma-evolution-redis-dev`. Credencial n8n criada (`MAG - Redis Buffer
  (dev)`, host `n8n-redis`, porta 6379, sem senha).
- **9 nós novos** no workflow `MAG - Fase 0 (eco WhatsApp)` (id
  `ypeJKZLsGq1WxkQB`), inseridos entre `Extrair dados` e
  `Identificar Contato` (cobre SDR e Operadora de uma vez, já que os dois
  passam por ali):
  1. `Buffer: guardar mensagem` (Redis `push`, RPUSH em
     `wpp:buffer:{numero}`, guarda `{texto, recebidoEm}`)
  2. `Buffer: marcar visto` (Redis `set`, `wpp:lastseen:{numero}` =
     `$execution.id`, TTL 30s de segurança)
  3. `Buffer: aguardar debounce` (Wait, fixo — não é dinâmico por tamanho
     de mensagem ainda, deliberado pro protótipo; começou em 10s, o
     Daniel pediu 5s depois de testar e ficou nesse valor)
  4. `Buffer: consultar visto` (Redis `get`)
  5. `Buffer: sou a última mensagem?` (IF: `lastSeenAtual ==
     $execution.id`)
  6. **TRUE** → `Buffer: ler mensagens` (Redis `get`, `keyType: list`) →
     `Buffer: limpar` (Redis `delete`) → `Consolidar mensagens` (Code:
     parseia, ordena por `recebidoEm`, junta os textos com espaço) →
     `Identificar Contato` (segue o fluxo original)
  7. **FALSE** → `Buffer: descartar (mensagem já absorvida)` (NoOp, para
     — a execução mais nova é quem vai processar)
- **Fix necessário**: `Preparar contexto SDR` lia `numero`/`texto`
  direto de `$('Extrair dados')` (referência por nome de nó, não pela
  cadeia de conexões) — sem esse ajuste o buffer juntaria as mensagens
  só pra `Identificar Contato` receber o número certo, mas o SDR/Operadora
  continuariam recebendo o fragmento cru. Troquei as 2 expressions pra
  `$('Consolidar mensagens')` via `patchNodeField` (a 1ª tentativa com
  path `assignments.assignments[0].value` falhou — a ferramenta espera
  notação por ponto `assignments.assignments.0.value`, não colchetes).

## Teste real (`n8n_test_workflow`, 2 mensagens fragmentadas de verdade)

Reproduzi o exemplo exato do Daniel: `"18714933748"` seguida de
`"650"` ~2s depois, mesmo número de teste
(`5521964946079`). Resultado (execuções 1264 e 1265):

- Execução da 1ª mensagem: **abortou sozinha** no branch FALSE (`Buffer:
  descartar`) assim que a 2ª mensagem chegou e sobrescreveu o
  `lastseen` — sem gerar resposta duplicada/prematura.
- Execução da 2ª mensagem: seguiu até `Consolidar mensagens`, que
  produziu `texto: "18714933748 650"` — **as duas mensagens juntas**,
  exatamente o comportamento pedido. Seguiu normal até o agente SDR
  (chamou `registrar_lead`/`escalar_contato`/`avisar_equipe` — entrou em
  handoff porque o texto batia com intenção de matrícula).

**Erro esperado no fim** (não é bug do buffer): `Responder no WhatsApp
(SDR)` falhou com `400 Text is required` porque o agente SDR terminou em
handoff sem gerar texto final pro contato (`$json.output` veio vazio) —
comportamento pré-existente do agente quando só chama tools de handoff,
não relacionado à mudança desta sessão. Vale investigar depois (o
protocolo de handoff do system prompt do SDR diz "responda avisando que
alguém foi chamado", mas não há garantia de que o agente sempre emite
esse texto final).

## Fora do escopo (deliberado)

- Janela de debounce dinâmica (curta pra mensagem longa, mais longa pra
  fragmento curto, como no template de referência) — fixo em 10s por
  ora.
- Não mexi no workflow de prod nem no `Nutridora (T+0)`.
- Não investiguei o bug pré-existente do output vazio do SDR em handoff.
- Dados de teste (lead "João", escalonamento) ficaram no banco dev —
  aceitável, mesmo padrão de testes reais anteriores (specs 013/014/015).

## Depois do teste

Daniel testou pelo WhatsApp de verdade e confirmou que funcionou; pediu
pra trocar a janela de 10s pra 5s (`updateNode` no `Buffer: aguardar
debounce`) e reexportar o workflow atualizado pra
`plataforma/n8n/workflows/mag-fase-0-sdr.json` (39 nós, era 30).

## Pendente

- Daniel decidir, depois de usar mais: formalizar como spec
  (`specs/016-...`) e promover pra prod, ou seguir ajustando no dev
  (janela dinâmica, aplicar o mesmo padrão em outros pontos se precisar).
- Se for pra prod: replicar o container Redis dedicado no
  `docker-compose.prod.yml` + credencial lá + o mesmo checklist de
  promoção de workflow já usado nas specs 013/014/015.
- Investigar o output vazio do agente SDR em cenário de handoff (achado
  incidental do teste, não corrigido).
