# Tasks 023 — Correções da SDR: handoff, lead duplicado e promessa vazia

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | `LeadPublicoSerializer.create` busca-ou-atualiza por `whatsapp` (nunca com whatsapp em branco; preserva `criado_em`/`nutridora_ultimo_toque`; vazio não sobrescreve) | ENTREGUE | claude |
| T2 | Testes do dedup em `apps/leads/tests.py` | ENTREGUE | claude |
| T3 | Prompt do SDR: handoff prometido ⇒ `escalar_contato` + `avisar_equipe` obrigatórias no mesmo turno, com gatilhos ampliados | ENTREGUE | claude |
| T4 | Prompt do SDR: sempre mandar `curso_slug` no `registrar_lead` quando o curso já foi identificado | ENTREGUE | claude |
| T5 | Prompt do SDR: nunca oferecer opção não confirmada (achado do Daniel — "ou prefere ver outras datas?") | ENTREGUE | claude |
| T6 | Prompt do SDR: nunca narrar operação interna ("registrei no sistema"), com o handoff como única exceção (2º achado do Daniel) | ENTREGUE | claude |
| T7 | Prompt do SDR: não repetir tool já chamada pro mesmo curso na conversa | ENTREGUE | claude |
| T8 | Teste real **3×** do roteiro de fechamento — handoff tem que disparar em todas (falha intermitente) | ENTREGUE | claude |
| T9 | Teste real: lead único, com curso preenchido, e sem narrar o registro | ENTREGUE | claude |
| T10 | Reexportar `mag-fase-0-sdr.json` (`exportar-dev.sh`) | ENTREGUE | claude |
| T11 | `.context/status.md` + ADR em `.context/decisoes.md` + `historico/` | ENTREGUE | claude |
| T12 | Promover pra prod junto com as specs 021/022 | PENDENTE | — (decisão do Daniel) |

## Ondas

- Onda 1 (paralelo): T1 → T2 · T3-T7 (uma edição só do `systemMessage`)
- Onda 2 (depende de T1-T7): T8, T9
- Onda 3: T10, T11
- T12 junto com a promoção das specs 021/022

## Log

- (2026-07-24, noite) Spec criada a partir da **análise de uma conversa
  real** — o primeiro uso prático da spec 021. Cinco problemas, três
  achados por mim na análise (handoff prometido e não executado, lead
  duplicado, lead sem curso) e **dois achados pelo Daniel** lendo a
  transcrição: a pergunta "ou prefere ver outras datas?" (que fabricou
  uma objeção e desmontou a escassez que a própria MAG tinha criado — o
  lead pegou a deixa e perguntou justamente isso) e o "já registrei seu
  interesse aqui no nosso sistema" ("o cliente não precisa saber que ele
  é um lead — apenas uma mensagem que mostra que entendeu o interesse
  dele já bastava"). Nenhum dos cinco apareceria olhando execução por
  execução no n8n: todas terminaram em "sucesso".
- (2026-07-24, madrugada) **ENTREGUE em dev (T1-T11)**. Suíte completa
  **289/289** (era 278, +11).
  **T8 — handoff: 3 de 3.** Rodei o mesmo roteiro com três formulações
  diferentes de fechamento ("estou interessado nessa turma mesmo", "é essa
  mesmo que eu quero", "quero garantir minha vaga"), nenhuma entre os
  gatilhos literais antigos, limpando memória e `ContatoEscalado` entre as
  rodadas. Em todas: `escalar_contato` + `avisar_equipe` chamadas,
  `ContatoEscalado` criado, `desfecho=handoff`, `escalada=True`.
  **T4 virou um achado maior — e a correção não era o prompt.** Depois de
  reforçar a regra 4 do system prompt E de dar descrição ao campo (que não
  tinha nenhuma: era só `{"name": "curso_slug"}`), o lead **continuava**
  nascendo sem curso. Fui olhar o que a tool realmente enviava e a MAG
  **nunca acertou o slug**: mandou `socorrista-aph-120h`, `aph-120h` e
  `socorrista-aph-120h` em três execuções, sempre montando o identificador
  a partir do nome exibido ("Socorrista APH (120h)"), mesmo com
  `"slug": "socorrista-aph"` no contexto vindo de `detalhes_curso`. E o
  backend engolia em silêncio (`filter(slug=...).first()` → `None`), então
  slug errado era indistinguível de slug ausente. Correção real:
  `resolver_curso()` em `apps/leads/serializers.py` — match exato, senão
  sobreposição de termos contra slug+nome de cada curso, exigindo vencedor
  único (empate devolve `None`: lead sem curso é ruim, lead com o curso
  ERRADO é pior), e `logger.warning` nos dois caminhos pra a falha deixar
  de ser silenciosa. Os 3 slugs inventados de verdade viraram caso de
  teste. Confirmado no fluxo real: lead `#28` com `curso='socorrista-aph'`.
  **T5 e T6 confirmados na transcrição real**: a pergunta de fechamento
  virou "quer garantir sua vaga nessa turma que começa dia 08/08?" (sem
  oferecer data inexistente) e o pedido de nome virou "Como você se chama?
  😊" (sem "assim consigo registrar seu interesse"). O T6 precisou de uma
  segunda passada: a primeira versão da regra só cobria passado
  ("registrei") e o modelo achou a brecha do futuro ("assim consigo
  registrar") — a regra agora nomeia as duas formas e o uso como
  justificativa pra pedir dado.
  **Incidente de ambiente (meu erro, vale registrar)**: editei o import
  (`unicodedata`) num passo separado da função que o usa, e o `runserver`
  do Daniel recarregou no estado intermediário — o endpoint ficou
  respondendo `NameError` enquanto **a suíte passava**, porque o teste
  importa o módulo do zero e o servidor tinha a versão velha em memória.
  Lição: teste verde não garante que o processo em execução está com o
  código novo — quando o teste real diverge do automatizado, conferir o
  endpoint direto (`curl`) antes de duvidar da lógica.
  **Observação registrada, fora do escopo desta spec**: nas 3 rodadas de
  handoff a MAG escalou **sem nunca registrar o lead** (o contato não
  tinha dito o nome, e a regra de handoff manda parar de qualificar). O
  resultado é que o lead mais quente possível fica só em
  `ContatoEscalado` + `Conversa`, fora da tabela de leads — some do Radar
  e da Nutridora. Não mexi porque é decisão de produto (o humano assumiu),
  mas precisa de uma escolha consciente do Daniel.
  **Pendente**: T12 — promover pra prod junto com as specs 021/022.
