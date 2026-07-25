# Tasks 025 — Handoff de ponta a ponta

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | `ContatoEscalado` ganha `resolvido_em` + `expira_em`; `unique` do `numero` vira índice não único; helper "ativo pra este número" | ENTREGUE | claude |
| T2 | `ConfiguracaoSite`: prazo de expiração do handoff (default 24h, `0` = nunca) + migração | ENTREGUE | claude |
| T3 | `escalar_contato` garante o `Lead` (cria-ou-atualiza por WhatsApp, reusando o dedup da spec 023) e aceita `nome`/`curso_slug` opcionais via `resolver_curso()` | ENTREGUE | claude |
| T4 | Status próprio pro lead escalado (`em_atendimento`) — **depende da decisão do Daniel** (pergunta aberta 2 da spec) | ENTREGUE | claude |
| T5 | `processar_nutridora`: excluir só os escalados **ativos** (senão quem já foi atendido nunca mais é nutrido) | ENTREGUE | claude |
| T6 | Admin: resolver `ContatoEscalado` pelo celular, listar por estado, filtro ativo/resolvido | ENTREGUE | claude |
| T7 | Testes: lead garantido no handoff · não duplica em 2 escaladas · expiração devolve o contato · Nutridora volta a alcançar quem foi resolvido | ENTREGUE | claude |
| T8 | n8n: `Está escalado?` passa a olhar só ativos — **sem mudança no n8n**: o `identificar_contato` já resolve o estado no backend | ENTREGUE | claude |
| T9 | n8n: ramo de cortesia (mensagem fixa pela Evolution, **1× por handoff**, marca no Redis `mag:cortesia:{numero}`) | ENTREGUE | claude |
| T10 | n8n: `mag-avisar-equipe.json` — aviso com "responda pelo WhatsApp da Magma" + número do contato em linha copiável | ENTREGUE | claude |
| T11 | `systemMessage`: critério pagamento-neutro (responde) × objeção-de-preço (escala) — **coordenar com a spec 024, mesmo arquivo** | ENTREGUE | claude |
| T12 | **Teste real**: as 3 formulações de pagamento (Rafael / Juliana / Bianca) dão os 3 comportamentos esperados | ENTREGUE | claude |
| T13 | **Teste real**: escalar → mandar 2 mensagens (cortesia só na 1ª) → expirar na mão → confirmar que a MAG volta a atender | ENTREGUE | claude |
| T14 | Reexportar `mag-fase-0-sdr.json` e `mag-avisar-equipe.json` (`exportar-dev.sh`) | ENTREGUE | claude |
| T15 | `docs/plataforma/03-api-contratos.md` (payload de `escalar_contato`) + `.context/backend.md` + status/historico/ADR | ENTREGUE | claude |
| T16 | Promover pra prod | PENDENTE | — (decisão do Daniel) |

## Ondas

- Onda 0: ✅ **decidida em 25/07** — prazo 24h configurável e status
  próprio `em_atendimento`, as duas propostas do plano (o Daniel mandou
  seguir com elas)
- Onda 1: T1, T2, T3, T5 (backend, mesma migração de `nucleo`) → T7
- Onda 2: T6 · T8, T9, T10 (n8n, nós independentes)
- Onda 3: T11 (só depois da 024 ter fechado o `systemMessage`)
- Onda 4: T12, T13 → T14, T15
- T16 com a promoção conjunta (021/022/023/024/025 mexem no mesmo
  `mag-fase-0-sdr.json` — um restart só do n8n de prod cobre todas)

## Sequência com a spec 024

As duas editam o mesmo `systemMessage`. **024 primeiro** (ela reescreve o
bloco inteiro), **025 depois** (ela acrescenta um critério dentro do bloco
de handoff). Nunca em paralelo — a lição do `updateNode` em campo aninhado
da spec 013 vale aqui em dobro.

## Emenda da spec 028 (2026-07-25)

A 028 muda **quem** chega no handoff, não como ele funciona: intenção de
matrícula **sem objeção** deixa de escalar e passa a ser conduzida até a
matrícula (mídia → link → carteirinha → aprovação do gestor). Tudo o que
esta spec conserta continua valendo e fica ainda mais importante — a 028
usa o handoff consertado como **caminho de saída**, pra quando o lead
quente levanta uma objeção no meio. O critério pagamento-neutro ×
objeção-de-preço não muda.

**A 025 vem antes da 028.**

## Log

- (2026-07-25) **T1–T15 entregues em dev.** Suíte de 289 → **300 testes**,
  todos verdes. Placar dos aceites, medido em conversa real:

  | Critério | Resultado |
  |---|---|
  | Lead garantido no handoff | ✅ Rafael escalou por preço e virou o `Lead #37` — antes não virava nada |
  | Nome e curso aproveitados | ✅ o modelo mandou `nome_esc="Rafa"` e `curso_esc="socorrista-aph-120h"`; o `resolver_curso()` corrigiu pra `socorrista-aph` |
  | `ContatoEscalado` com estado | ✅ `expira_em` = +24h na criação |
  | Volta automática | ✅ expirado na mão, a MAG voltou a atender no turno seguinte — e já como `papel=lead`, porque agora ele existe na base |
  | Resposta de cortesia 1× | ✅ 1ª mensagem percorre até `Cortesia: responder`; a 2ª para no `Cortesia: primeira vez?` |
  | Gestor resolve pelo Admin | ✅ ações "Resolver" e "Reabrir" em lote |
  | Aviso com canal único | ✅ número anexado pelo workflow, não redigitado pela IA |
  | Pagamento neutro × objeção | ✅ os 3 casos (ver abaixo) |
  | Suíte verde | ✅ 300 testes |

  **As 3 formulações de pagamento**, o aceite mais fino da spec:

  | Contato | Pergunta | Antes | Agora |
  |---|---|---|---|
  | Rafael | *"650 tá salgado... dá pra parcelar?"* | escalou | **escala** (certo) |
  | Juliana | *"parcelo no cartão? tem desconto no pix?"* | respondeu | **responde** com dado real (10x sem juros, 10% PIX) |
  | Bianca | *"como faço pra pagar?"* | meia resposta (*"conforme as opções que a equipe pode te explicar"*) | **responde** |

  **T8 saiu de graça:** como `identificar_contato` passou a resolver o
  estado no backend, o nó `Está escalado?` não precisou mudar — ele lê
  `$json.escalado` e a semântica mudou na origem.

  **Efeito colateral que precisou de cuidado:** tornar `Lead.nome`
  `blank=True` (pro handoff criar lead sem nome) afrouxou a validação do
  formulário público da LP e quebrou um teste existente. Corrigido
  declarando `nome` como obrigatório no `LeadPublicoSerializer`: o
  handoff pode criar lead magro, o formulário continua exigindo nome.

  **Fora de escopo, anotado:** o ramo de cortesia **não** registra a
  mensagem do contato em `apps/conversas` (o fluxo escalado morre antes do
  `Registrar conversa`). Por isso o texto da cortesia não promete repassar
  nada — seria mentira. Fazer o registro no ramo escalado é barato e
  valeria uma tarefa própria.

- (2026-07-25) Spec criada a partir da bateria de 6 conversas simuladas
  de 25/07. Fecha a questão que a **spec 023 deixou explicitamente aberta
  pra decisão do Daniel** ("no handoff a MAG escala sem registrar lead"),
  agora com evidência do pior caso: o contato que disse "quero garantir
  minha vaga" ficou fora da tabela de leads. O item de canal único no
  aviso ao gestor é pedido direto do Daniel na revisão da análise.
