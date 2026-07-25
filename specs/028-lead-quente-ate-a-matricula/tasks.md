# Tasks 028 — Lead quente vai até a matrícula

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | Model `AprovacaoPendente` + migração (`status` explícito, `unique` condicional só entre pendentes, `expira_em`) | PENDENTE | — |
| T2 | Helper de resumo da conversa em `apps/conversas` (o que a MAG conta pro gestor) | PENDENTE | — |
| T3 | Ação `pedir_aprovacao` — cria a pendência com o número vindo do **contexto da execução**, nunca da IA; devolve o texto pro gestor | PENDENTE | — |
| T4 | Ação `listar_aprovacoes_pendentes` — o que a Operadora consulta pra saber a qual aprovação o gestor está respondendo | PENDENTE | — |
| T5 | Ação `resolver_aprovacao(aprovacao_id, decisao, valor_ajustado?)` — trava otimista no `status`, gera `Cobranca` quando aprovada | PENDENTE | — |
| T6 | Expiração das pendências (pendurar no Radar diário, onde a purga da 021 já mora) + queda pro handoff normal | PENDENTE | — |
| T7 | Testes de backend das 3 ações, incluindo dois gestores respondendo a mesma aprovação | PENDENTE | — |
| T8 | Sub-workflow `mag-enviar-ao-contato.json` (webhook `enviar-ao-contato`, manda `{numero, mensagem}` pela Evolution) | PENDENTE | — |
| T9 | Disparo do backend pro webhook ao aprovar (mesmo padrão do `N8N_LEAD_WEBHOOK` da spec 011) | PENDENTE | — |
| T10 | SDR: regra do lead quente no `systemMessage` (duas condições juntas + saída por objeção) | PENDENTE | — |
| T11 | SDR: ligar `gerar_link_matricula` e `pedir_aprovacao` como tools da pista da SDR | PENDENTE | — |
| T12 | Operadora: entender aprovação pendente no `systemMessage` + tool `resolver_aprovacao` | PENDENTE | — |
| T13 | Escopos novos no `TokenAgente` (dev e prod) e `docs/plataforma/03-api-contratos.md` | PENDENTE | — |
| T14 | **Teste real — o lado da lead**: perfil da Bianca até a carteirinha | PENDENTE | — |
| T15 | **Teste real — o lado do gestor**: aprovar, recusar, e ajustar valor ("manda 600") | PENDENTE | — |
| T16 | **Teste real — o equilíbrio**: rodar os 6 perfis da bateria; aceite é **1 abre o caminho, 5 vão pro handoff** | PENDENTE | — |
| T17 | Reexportar `mag-fase-0-sdr.json` + `mag-enviar-ao-contato.json` (`exportar-dev.sh`) | PENDENTE | — |
| T18 | `.context/status.md` + ADR em `.context/decisoes.md` + `historico/` | PENDENTE | — |
| T19 | Promover pra prod (workflow novo precisa de import + ativação, ver README dos workflows) | PENDENTE | — (decisão do Daniel) |

## Ondas

- Onda 1: T1 → T2 → T3, T4, T5 → T6 → T7 (backend inteiro, validável por `curl`, sem n8n)
- Onda 2: T8 → T9
- Onda 3: T10, T11 (uma edição só do `systemMessage` do SDR — não fatiar)
- Onda 4: T12
- Onda 5: T14, T15, T16 → T17, T18
- T19 com a promoção conjunta

## Dependências

- **A spec 025 vem primeiro.** Ela conserta o handoff (lead garantido no
  `escalar_contato`, `ContatoEscalado` com estado, cortesia). A 028 usa
  esse alicerce na saída — quando o lead quente levanta objeção e cai no
  handoff normal.
- **A spec 026 é opcional aqui.** Se a mídia curada estiver pronta, entra
  na Onda 3 como o passo que antecede o link. Se não estiver, o caminho
  funciona sem ela e só perde o reforço de desejo.
- **T10 e T11 mexem no mesmo `systemMessage`** que as specs 024 (feita),
  025 e 026 — a ordem entre elas continua valendo.

## Decisões do Daniel (2026-07-25) — não são mais perguntas

1. **Prazo da aprovação: 2h**, configurável em `ConfiguracaoSite`. Passado
   o prazo sem resposta de nenhum gestor, vira handoff normal.
2. **Turma do link: sempre a `turma_destaque`**, sem perguntar ao contato.
3. **Não se aprova pagamento antes da matrícula** — a `AprovacaoPendente`
   só pode ser criada depois de a pessoa preencher o CPF e virar `Aluno`
   + `Matrícula`, senão a cobrança nasce órfã.

## ⚠️ Correção necessária na decisão "deixa com a Nutridora" — DECIDIDA

Descoberto ao implementar a 025: **`processar_nutridora` exclui
`utm_source="whatsapp"`** (`apps/leads/acoes.py`). Todo lead nascido de
conversa com a MAG — que é exatamente o caso de quem recebeu o link e não
preencheu — **nunca entra na régua T+1/3/7**. A decisão do Daniel de
"deixa com a Nutridora, zero código novo" é, como está, um **no-op**: a
pessoa não receberia nada.

**O buraco é maior do que esta spec.** Conferido em 25/07: o
`registrar_lead` do SDR carimba `utm_source="whatsapp"` como
`valueProvider: fieldValue` no próprio workflow
(`mag-fase-0-sdr.json`, nó `tool-registrar-lead`) — não é a IA que
escolhe. Então **nenhum** lead nascido de conversa entra na régua, não só
o da 028. E como a campanha do Meta é Click-to-WhatsApp, 100% do lead pago
cairia nessa faixa morta.

**Decisão do Daniel (2026-07-25): trocar origem por atividade.** A regra
usava a **origem** como proxy da **atividade** ("quem está falando com a
MAG agora não precisa de toque"), e origem não muda nunca. A exclusão por
`utm_source` sai; entra exclusão de quem teve conversa nos últimos
`ConfiguracaoSite.nutridora_silencio_dias` (padrão 2), lida de
`apps.conversas` — possível só agora, porque a spec 021 criou
`Conversa.ultima_atividade_em` (com índice `("numero", "-ultima_atividade_em")`).
A exceção estreita foi **descartada**: resolveria o caso desta spec e
deixaria o funil pago aberto.

**Efeito colateral aceito:** para lead de WhatsApp a régua passa a contar
da última conversa, não da criação.

**A T20 saiu desta spec.** Virou a etapa 1 de `.context/roteiro.md`, feita
antes da 028 e promovida junto com a 021 na etapa 2 (sozinha em prod ela
não funciona: sem a tabela de conversas, o filtro não excluiria ninguém).

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T20 | Nutridora exclui por atividade, não por origem | **ENTREGUE em dev (25/07)** | claude |

**Como ficou:** `ConfiguracaoSite.nutridora_silencio_dias` (padrão 2,
migração `nucleo/0008`), `Conversa.numeros_ativos_desde(dias)` e
`processar_nutridora` trocando `.exclude(utm_source="whatsapp")` por
`.exclude(whatsapp__in=numeros_em_conversa)`. Suíte 300 → 304. Medido em
dev: **os 12 leads do banco têm `utm_source="whatsapp"`**, então a régua
antiga nutriria zero. Só vale em prod depois de a spec 021 subir (etapa 2
do roteiro) — sem a tabela de conversas o filtro novo não excluiria
ninguém.

## Log

- (2026-07-25) Spec criada a partir de uma leitura do Daniel sobre a
  bateria de 6 conversas: a Bianca (*"já decidi que quero fazer"*) foi
  **escalada e silenciada** no melhor momento dela. Pedido dele:
  aproveitar esse momento com mídia + link de matrícula + carteirinha em
  vez de handoff. O desenho da aprovação é dele e substituiu as três
  opções oferecidas: *"o gestor responde diretamente ao bot que
  reorganiza/encaminha"*, evitando que o humano tenha que abrir o WhatsApp
  da escola. Decisão sobre não-conclusão também dele: **fica com a
  Nutridora**, sem tratamento especial (zero código novo).
