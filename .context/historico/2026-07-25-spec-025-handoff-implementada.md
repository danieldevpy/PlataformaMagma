# 2026-07-25 — Spec 025 implementada (handoff de ponta a ponta) + spec 028 escrita

## Prompts do Daniel

Sobre o lead quente, que gerou a spec 028:

> "Em uma das conversas estava claro que tinha uma pessoa que o que mais
> ela queria era fazer parte do curso (...) para aproveitar isso, ao invés
> de escalar o contato, quero ter uma forma de introduzir mais ainda o
> futuro aluno no curso, então a partir daí enviar mídias personalizadas
> (...) e posteriormente mandar o link de matrícula (...) Agora para
> outros perfis isso tem que ser equilibrado."

Sobre a aprovação da cobrança, respondendo a uma pergunta de múltipla
escolha e **recusando as três opções oferecidas** com uma quarta melhor:

> "Quero que o link de pagamento seja um webhook do agente explicando e
> perguntando o gestor se deve mandar o link de pagamento (...) com o
> humano respondendo e o bot replicando/agindo baseado nessa resposta, aí
> evita que o humano tenha que acessar o wpp do curso. Ele como gestor
> responde diretamente ao bot que reorganiza/encaminha."

E depois: *"Então analise a sessão para começar a desenvolver"* / *"segue"*.

## Spec 028 escrita (não implementada)

`specs/028-lead-quente-ate-a-matricula/`. Caminho novo: mídia curada →
`gerar_link_matricula` → carteirinha → pedido de aprovação ao gestor →
cobrança enviada à lead.

**A decisão de desenho que sustenta o resto:** o modelo **nunca escolhe o
destinatário**. O gestor responde "pode mandar" e nada nessa frase diz pra
quem; se houvesse uma tool `enviar_mensagem(numero, texto)`, o modelo
teria que **produzir** o número — a classe de erro que a spec 023
documentou três vezes. Ali o estrago era um lead sem curso; aqui seria um
link de pagamento no telefone errado. Então o número vive na
`AprovacaoPendente` e quem envia é o backend, chamando um webhook do n8n
(mesmo padrão da Nutridora T+0).

**Equilíbrio medido contra a bateria: 1 perfil dos 6** abre o caminho
(Bianca). Os outros 5 seguem no handoff. Virou critério de aceite.

Decisões do Daniel: prazo de aprovação **2h**, sempre a `turma_destaque`,
e **pagamento só depois da matrícula** — esta última simplificou o model
(`aluno_token` deixou de ser opcional e virou pré-requisito, matando o
caso da cobrança órfã na origem).

## Spec 025 implementada em dev (T1–T15)

### Backend

- **`ContatoEscalado` ganhou estado** — `resolvido_em`, `expira_em`,
  `ativo`, `ativo_para()`, `numeros_ativos()`. O `unique` do `numero`
  **caiu**: o mesmo contato pode ser escalado de novo meses depois sem
  colidir com o registro resolvido.
- **`ConfiguracaoSite.handoff_expira_horas`** (24h, `0` = nunca), mesmo
  padrão da retenção de conversas da 021.
- **`garantir_lead()`** extraída de `LeadPublicoSerializer.create` — o
  formulário da LP e o handoff passam pelo mesmo dedup.
- **`escalar_contato` garante o `Lead`**, aceita `nome`/`curso_slug`
  opcionais, devolve `expira_em` e `lead_id`.
- **`processar_nutridora`** exclui só os escalados **ativos**.
- **Admin** com ações "Resolver" e "Reabrir" em lote.
- **11 testes novos** (289 → 300, todos verdes).

### n8n

- **Ramo de cortesia** no `Está escalado?`: Redis GET → IF primeira vez →
  Redis SET (TTL 24h) → envio de mensagem fixa pela Evolution. Sem LLM.
- **`avisar_equipe`** passou a mandar `numero_contato` do **contexto da
  execução** (`valueProvider: fieldValue`), e o `mag-avisar-equipe.json`
  ganhou um nó que monta o texto final com o número em linha copiável + a
  instrução de responder pelo WhatsApp da Magma.
- **`escalar_contato`** ganhou os placeholders `nome_esc`/`curso_esc`.
- **`systemMessage`**: critério pagamento-neutro × objeção-de-preço.
- **T8 saiu de graça** — como `identificar_contato` resolve o estado no
  backend, o nó `Está escalado?` não precisou mudar.

### Resultado em conversa real

| Contato | Pergunta | Antes | Agora |
|---|---|---|---|
| Rafael | *"650 tá salgado... dá pra parcelar?"* | escalava, **sem virar lead** | escala **e vira o `Lead #37`** |
| Juliana | *"parcelo no cartão? tem desconto no pix?"* | respondia | responde com dado real (10x, 10% PIX) |
| Bianca | *"como faço pra pagar?"* | *"conforme as opções que a equipe pode te explicar"* | responde |

Ciclo completo verificado: escalar → 1ª mensagem recebe cortesia → 2ª
mensagem cai em silêncio (correto) → expirar → **a MAG volta a atender**,
já reconhecendo `papel=lead` porque agora ele existe na base.

## Dois tropeços que valem mais que o código

### 1. O plano da 027 estava errado sobre timeout (visto na sessão anterior)

O nó de agente do n8n **não tem** opção de timeout. Virou
`settings.executionTimeout` do workflow.

### 2. A decisão "deixa com a Nutridora" da 028 é um no-op

Descoberto ao mexer no `processar_nutridora`: ele exclui
`utm_source="whatsapp"`. Todo lead nascido de conversa com a MAG — que é
exatamente quem recebeu o link e não preencheu — **nunca entra na régua
T+1/3/7**. A resposta do Daniel ("fica com a Nutridora, zero código
novo") não funciona como está. Anotado como **028-T20**, com proposta de
exceção estreita.

**O padrão comum aos dois:** decisão de produto que parecia "zero código"
e o código dizia o contrário. Virou ADR: antes de fechar decisão que
depende de comportamento existente, ler o código que implementa esse
comportamento.

## O harness foi apagado no meio do trabalho

O diretório temporário com os scripts de simulação sumiu durante a
implementação, e precisou ser reconstruído na hora. Foi versionado em
**`plataforma/n8n/simulacao/`** (README + `conversar.py` +
`ler_execucoes.js` + `override.dev.yml`). Eu tinha sinalizado esse risco
duas vezes; desta vez ele custou tempo de verdade.

## Estado ao sair

- **Dev restaurado**: regex de números de teste no valor original,
  override da simulação fora, n8n saudável, workflows reexportados.
- **Django dev caiu** durante a sessão (autoreload depois da migração) e
  foi subido de novo — vale saber que isso acontece: o sintoma foi o
  fluxo do n8n morrendo em `Identificar Contato`.
- **Nada commitado, nada promovido pra prod.**

### Resíduo em dev

Leads e `ContatoEscalado` dos números `55009000000{41..44}`, somados aos
das rodadas anteriores. Continua **decisão do Daniel** se apaga.

### Pendências

1. **028-T20** — a exceção da Nutridora (decisão do Daniel).
2. **026** — 2 decisões dele (tag nova × `destaque`, vídeo ou não).
3. **027-T3/T4** — watchdog e alarme.
4. **027-T6/T7 em prod** — dependem de `n8n --version` e `free -m` na VPS.
5. **Promoção pra prod** — 021/022/023/024/025 mexem no mesmo
   `mag-fase-0-sdr.json`; um restart do n8n de prod cobre todas.
6. **Registrar a conversa no ramo escalado** — hoje a mensagem de quem
   está escalado não entra em `apps/conversas`.
