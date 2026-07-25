# Tasks 024 — A MAG conversa melhor: pesos de tom, escassez e curiosidade

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | Reescrever o bloco "SEU OBJETIVO" do `systemMessage` do SDR **mantendo o número de regras** — transportar literalmente as regras que a spec 023 provou (handoff amarrado à ação, `curso_slug` no `registrar_lead`, nunca oferecer opção inexistente) | ENTREGUE | claude |
| T2 | Regra 3: escassez só com `vagas_restantes ≤ 3`; acima disso não mencionar vagas em nenhuma forma | ENTREGUE | claude |
| T3 | Regra nova de ordem: interesse genérico → responde + gancho + convite; interesse específico → responde direto. Exemplo do Daniel como referência de tom, não frase pronta | ENTREGUE | claude |
| T4 | Curso fora da grade: negar **e** apresentar os outros cursos reais de `listar_cursos`, APH como carro-chefe | ENTREGUE | claude |
| T5 | Regra 6 vira positiva: "pergunte o nome e mais nada"; proibir pedido de sobrenome | ENTREGUE | claude |
| T6 | Regra 7 absorve a promessa de apuração ("nunca prometa verificar o que nenhuma tool responde") | ENTREGUE | claude |
| T7 | `Preparar contexto SDR`: `nome` ganha fallback `|| pushName` (cadastro sempre ganha do apelido) | ENTREGUE | claude |
| T8 | `Memória da conversa`: `contextWindowLength` 10 → 20; remover a regra 8 do prompt | ENTREGUE | claude |
| T9 | Orientação de formato: ~600 caracteres, uma pergunta por mensagem | ENTREGUE | claude |
| T10 | **Teste real — escassez nos dois lados**: rodar com `vagas_restantes=14` (não cita) e `=3` (cita), mesma pergunta | ENTREGUE | claude |
| T11 | **Teste real — rerodar os 6 perfis** da bateria de 25/07 e comparar turno a turno com as transcrições originais | ENTREGUE | claude |
| T12 | Reexportar `mag-fase-0-sdr.json` (`exportar-dev.sh`) | ENTREGUE | claude |
| T13 | `.context/status.md` + ADR em `.context/decisoes.md` + `historico/` | ENTREGUE | claude |
| T14 | Promover pra prod (junto com 021/022/023, que já estão pendentes no mesmo arquivo) | PENDENTE | — (decisão do Daniel) |

## Ondas

- Onda 1: T1–T6, T9 (uma edição só do `systemMessage` — não fatiar, o
  arquivo é um texto único e edições parciais se atropelam)
- Onda 2 (paralelo com a 1): T7, T8 (nós diferentes)
- Onda 3 (depende de tudo): T10, T11
- Onda 4: T12, T13
- T14 com a promoção conjunta

## Como testar (T11)

O harness da bateria de 25/07 está descrito em
`.context/historico/2026-07-25-simulacoes-sdr-6-perfis.md` §"Como foi
feito": números com DDD 00 (não chegam em WhatsApp real), payload
`messages.upsert` injetado no webhook, transcrição lida da execução do
n8n. **Limpar entre rodadas**: `ContatoEscalado` dos números de teste,
chave `mag:sdr:{numero}` no Redis e os `Lead` gerados — senão o contato
entra silenciado e a memória contamina o teste.

## Log

- (2026-07-25) **T1–T13 entregues em dev.** O bloco "SEU OBJETIVO" saiu de
  8 regras pra 7 (a regra 8, de tool repetida, virou o ajuste de
  `contextWindowLength`), e as inegociáveis foram de 4 pra 5 (ganharam o
  teto de formato) — saldo de 12 pra 12, orçamento respeitado.
  Resultado dos aceites, medido em conversa real:

  | Critério | Resultado |
  |---|---|
  | Escassez com limiar | ✅ com 14 vagas a mesma pergunta não citou vaga; com 3, citou "apenas 3 vagas" |
  | Convite antes de ficha | ✅ Sandra recebeu motivo + convite, sem data/horário/preço/vagas de bandeja |
  | Curso inexistente abre leque | ✅ **só depois de afiar a regra 1** — ver abaixo |
  | Nome sem pretexto, sem sobrenome | ✅ nenhum "Nunes", nenhuma justificativa de cadastro |
  | `pushName` aproveitado | ✅ chamou "Rafa"/"Thiago" no 1º turno, sem gastar turno perguntando |
  | Sem promessa de apuração | ✅ Thiago pediu calendário de setembro/outubro e ela **escalou** em vez de prometer levantar |
  | Tool não repetida | ⚠️ melhorou (2–3× vs 4× antes), não zerou |
  | Teto de ~600 caracteres | ⚠️ maioria entre 250 e 450; uma resposta do Thiago foi a ~830 numa pergunta tripla |
  | Suíte verde | ✅ 289 testes, OK |

  **O aceite do curso inexistente falhou na 1ª rodada** e só passou depois
  de afiar a regra 1: a primeira redação dizia "apresente os cursos que
  existem, com o APH em destaque como carro-chefe" e o modelo leu isso
  como licença pra falar só do APH — exatamente o vício que a regra
  existia pra corrigir. Trocado por "LISTE PELO NOME TODOS os cursos que
  vieram de `listar_cursos` — todos mesmo, não só o APH", com o erro
  nomeado explicitamente ("responder 'nosso foco é o APH' e parar por aí
  é exatamente o erro"). Aí passou. Lição repetida da 023: **instrução
  vaga sobre ênfase o modelo resolve a favor da ênfase.**

  Nota de leitura pros aceites: dev tem só **2 cursos publicados** (APH e
  BLS), então "abrir o leque" aqui é citar os dois. Os outros cursos que a
  spec menciona (Primeiros Socorros/Lei Lucas, Punção Venosa) existem na
  base mas não estão publicados, então `listar_cursos` não os devolve.

  `resolver_curso()` da spec 023 confirmado em campo de novo: o modelo
  inventou `socorrista-aph-120h` e o lead #34 nasceu com `curso_id=2`
  (`socorrista-aph`) mesmo assim.

  **Achado que não é desta spec:** em 3 dos 6 perfis o contato mandou uma
  mensagem depois de ser escalado e recebeu **silêncio** — Rafael
  perguntando de desconto, Sandra perguntando onde fica a escola, Thiago
  pedindo o calendário. É a spec 025, e a bateria mostra que ela é mais
  urgente do que parecia: a pergunta que fica sem resposta costuma ser
  trivial ("é longe de Belford Roxo?").

- (2026-07-25) Spec criada a partir da bateria de 6 conversas simuladas
  e do feedback do Daniel sobre elas. Ele aprovou as 9 correções
  propostas na análise e acrescentou 4 achados próprios (escassez
  irrelevante, ficha técnica no lugar de convite, curso inexistente
  fechando a porta, e a confirmação de que **objeção de preço deve
  mesmo escalar** — corrigindo uma classificação errada minha).
