# Plan 023 — Correções da SDR: handoff, lead duplicado e promessa vazia

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| Backend | `apps/leads/serializers.py::LeadPublicoSerializer.create` — busca-ou-atualiza por `whatsapp` em vez de sempre criar | `docs/plataforma/03-api-contratos.md` |
| Testes | `apps/leads/tests.py` — dedup, campo vazio não apaga, whatsapp em branco não colapsa, `criado_em` preservado | `apps/nucleo/testing.py` |
| n8n | `mag-fase-0-sdr.json`: só o `systemMessage` do nó `SDR - Capitã de Matrículas` (5 regras novas) — nenhum nó novo, nenhuma conexão nova | `plataforma/n8n/workflows/README.md` |
| Docs | `.context/status.md` + `historico/` + ADR curto em `.context/decisoes.md` | regra de higiene do CLAUDE.md |

## Decisões desta feature

- **Dedup no backend, não (só) no prompt.** O prompt **já dizia** "uma
  vez só por conversa" e o agente chamou duas vezes assim mesmo. Prompt
  é orientação probabilística; a integridade da base de leads não pode
  depender disso. A regra do prompt continua (evita a chamada
  desnecessária, economiza token), mas quem garante é o banco.

- **Dedup por `whatsapp`, sem janela de tempo.** Cogitei "só deduplica se
  for do mesmo dia/30 dias" e descartei: é um número mágico a explicar
  pra sempre, e o caso real é duplicata dentro da mesma conversa. `Lead`
  passa a significar "pessoa interessada", não "cada vez que alguém
  falou com a gente" — o histórico de interações agora vive em
  `apps/conversas` (spec 021), que é o lugar certo pra isso.

- **Nunca deduplicar com `whatsapp` em branco.** Sem essa guarda, todo
  lead sem número (formulário da LP permite) colapsaria num único
  registro — um bug muito pior que o que estou corrigindo.

- **Preservar `criado_em` e `nutridora_ultimo_toque` do lead original.**
  Reencontrar um lead não pode: (a) reiniciar a régua da Nutridora
  (spec 020), nem (b) inflar "leads das últimas 24h" do Radar
  (spec 019). Só os campos de conteúdo são atualizados, e só quando vêm
  preenchidos — dado bom não é sobrescrito por vazio.

- **Handoff: amarrar a promessa à ação, não listar mais gatilhos.** O
  problema não foi a IA deixar de entender que era hora de chamar
  alguém — ela **falou isso em texto**. Foi dizer sem fazer. Então a
  regra nova é sobre coerência ("se você disser, você chama"), com os
  gatilhos ampliados como reforço secundário. Listar mais frases
  literais só empurraria o mesmo erro pra próxima formulação.

- **Regra de "não narrar a engrenagem" separada da de handoff.** São
  opostas e é fácil o modelo confundir: registro de lead é invisível pro
  contato, chamada de humano é anunciada. O prompt diz as duas coisas
  explicitamente, com a exceção nomeada, pra não virar "nunca fale de
  nada" e a MAG parar de avisar do handoff.

## Riscos / pontos de atenção

- **A falha é intermitente** — é o risco central desta spec. Um teste
  que passa não prova nada; por isso o critério de aceite exige o mesmo
  roteiro de fechamento **3×**. Se ainda falhar, o plano B (registrado
  como fora de escopo) é tirar o handoff das mãos do LLM e torná-lo
  determinístico no workflow.
- **Efeito colateral do dedup na LP**: quem preenche o formulário do
  site duas vezes deixa de virar dois leads. É desejável, mas é mudança
  de comportamento de uma rota pública — precisa estar nos testes e no
  histórico, não descoberta depois.
- **Editar `systemMessage`**: é campo aninhado
  (`parameters.options.systemMessage`) — usar `patchNodeField`, **nunca**
  `updateNode` bruto (a lição da spec 013: `updateNode` reconstrói o
  objeto e apaga os irmãos `promptType`/`text`/`maxIterations`). Conferir
  com `mode: filtered` depois.
- **Não mexer no que funciona**: a MAG não inventou nenhum dado nesta
  conversa. As regras novas são adições; as regras existentes de "nunca
  invente preço/data/vaga" ficam intactas.
