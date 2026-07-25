# Plan 028 — Lead quente vai até a matrícula

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| Backend | `apps/nucleo/` — model `AprovacaoPendente` + 3 ações (`pedir_aprovacao`, `resolver_aprovacao`, `listar_aprovacoes_pendentes`) | Camada de Ações, spec 005 |
| Backend | `apps/conversas/` — helper de resumo da conversa pro pedido de aprovação | spec 021 |
| n8n | `mag-fase-0-sdr.json` → `systemMessage` do **SDR**: regra do lead quente; tools novas `gerar_link_matricula` + `pedir_aprovacao` | spec 024 (mesmo texto) |
| n8n | `mag-fase-0-sdr.json` → `systemMessage` da **Operadora**: entender e resolver aprovação pendente; tool nova `resolver_aprovacao` | spec 013 |
| n8n | `mag-enviar-ao-contato.json` — sub-workflow novo, webhook, manda mensagem a um número | mesmo padrão de `mag-avisar-equipe.json` |
| Docs | `.context/decisoes.md`, `status.md`, `historico/` | higiene do CLAUDE.md |

## A decisão de desenho que sustenta o resto

### O modelo nunca escolhe pra quem manda

Este é o ponto que separa esta spec de "deixar o bot mandar mensagem".

O gestor responde *"pode mandar"* na conversa **dele**. Nada nessa frase
diz pra quem. Se a Operadora tivesse uma tool
`enviar_mensagem(numero, texto)`, o modelo teria que **produzir** o número
da Bianca — e a spec 023 provou, com três execuções seguidas, que
identificador técnico gerado por LLM é exatamente a classe de erro que ele
comete (lá foi `socorrista-aph-120h` no lugar de `socorrista-aph`; aqui
seria um número de telefone errado recebendo um link de pagamento).

Então o fluxo é:

1. A SDR cria uma `AprovacaoPendente` com o número da lead, a turma, o
   valor e o resumo. **O número entra aqui, vindo do contexto da execução
   (`Preparar contexto SDR`), não da IA.**
2. O gestor aprova. A Operadora chama `resolver_aprovacao(aprovacao_id,
   decisao, valor_ajustado?)`. O único identificador que o modelo produz é
   o **id da aprovação**, e ele vem de uma lista que o backend acabou de
   devolver — não é montado de cabeça.
3. O **backend** gera a cobrança e dispara o envio pro número **que está no
   registro**.

Mesmo princípio que a spec 023 registrou como generalizável: *toda vez que
uma tool receber identificador técnico gerado pelo modelo, o backend
resolve com tolerância*. Aqui a gente vai um passo além — o identificador
mais perigoso (o destinatário) simplesmente **não passa pelo modelo**.

### Quem envia é o backend, pelo webhook do n8n

Já existe precedente exato: a Nutridora T+0 (spec 011) é o backend
chamando um webhook do n8n (`N8N_LEAD_WEBHOOK`) pra mandar WhatsApp. O
mesmo padrão serve aqui — `mag-enviar-ao-contato.json`, webhook simples
que recebe `{numero, mensagem}` e chama a Evolution.

Por que não fazer a Operadora responder direto: o nó `Responder no
WhatsApp (Operadora)` manda pra `$('Preparar contexto SDR').first().json.numero`,
que é **o gestor**. Mudar isso pra um destino variável no meio do fluxo
misturaria "responder a quem falou comigo" com "avisar um terceiro" no
mesmo nó — e o gestor precisa das duas coisas no mesmo turno ("ok, mandei
pra ela" pra ele + o link pra ela).

## Model novo: `AprovacaoPendente`

```
numero_contato   CharField   número da lead (só dígitos com DDI)
aluno_token      UUID        obrigatório — só há aprovação depois da matrícula
turma            FK Turma
valor_sugerido   Decimal     o preço da turma, o que o gestor vai confirmar
resumo           TextField   o que a MAG contou pro gestor
status           choice      pendente | aprovada | recusada | expirada | assumida
decidida_por     FK/null     qual gestor respondeu
decidida_em      datetime/null
expira_em        datetime    prazo pra ninguém ficar no vácuo
cobranca         FK/null     a Cobranca gerada, quando aprovada
```

Três coisas propositais:

- **`status` explícito, não presença/ausência.** O `ContatoEscalado` usa
  "existe = está escalado" e a spec 025 está justamente corrigindo isso
  porque o registro não sabe dizer se já foi resolvido. Não repetir o erro.
- **`unique` em `numero_contato` só entre as pendentes** (constraint
  condicional), não global: a mesma pessoa pode ter uma aprovação resolvida
  de agosto e outra pendente de setembro.
- **`resumo` guardado, não recalculado.** O gestor pode responder 40
  minutos depois; o resumo tem que ser o que ele leu.

## Detecção do lead quente: no prompt, com duas travas

A leitura de intenção é o que o LLM faz bem — não vale inventar score no
backend (é a mesma análise que a spec 024 fez pro limiar de escassez, e
pela mesma razão: não é montagem de string, é julgamento de conversa).

Mas a regra tem **duas condições que precisam valer juntas**, escritas como
teste e não como vibe, porque "entra uma, sai uma" (princípio do Daniel na
spec 024) e porque a bateria mostrou que ênfase vaga o modelo resolve a
favor da ênfase (ADR de 25/07):

> abre o caminho **só se** (a) a pessoa **declarou** que quer fazer o curso
> — não perguntou preço, **declarou**; **e** (b) em nenhum momento da
> conversa ela achou caro, pediu desconto, comparou com concorrente,
> reclamou ou pediu pra falar com alguém. Se qualquer uma das duas falhar,
> é handoff normal.

E a saída: qualquer objeção que apareça **depois** fecha o caminho e vira
handoff. Isso é barato de escrever no prompt e é o que impede a coisa de
virar máquina de empurrar link.

## Emenda à spec 025

A 025 está escrita assumindo que "intenção clara de fechar matrícula" leva
a handoff. Com a 028 isso deixa de ser verdade pro lead quente. A 025
**não precisa ser reescrita** — o critério dela (pagamento-neutro ×
objeção-de-preço) continua igual; o que muda é que a intenção **sem
objeção** passa a ter um destino melhor que o humano. Registrar a emenda no
log da 025 e seguir.

**Ordem entre elas:** a 025 vem primeiro. Ela conserta o handoff (lead
garantido, `ContatoEscalado` com estado, resposta de cortesia) e a 028
depende desse alicerce — inclusive pro caminho de saída, quando o lead
quente levanta objeção e cai no handoff.

## Ondas

- **Onda 1 (backend, sem IA):** model + migração + as 3 ações + testes.
  Dá pra validar inteiro por `curl`, sem n8n.
- **Onda 2 (envio):** `mag-enviar-ao-contato.json` + o disparo do backend.
- **Onda 3 (SDR):** regra do lead quente + `gerar_link_matricula` +
  `pedir_aprovacao` ligados na pista da SDR.
- **Onda 4 (Operadora):** entender aprovação pendente + `resolver_aprovacao`.
- **Onda 5:** teste real de ponta a ponta com o perfil da Bianca, dos dois
  lados (lead e gestor).

A mídia (spec 026) entra na Onda 3 **se já estiver pronta**; se não, o
caminho funciona sem ela — só perde o reforço de desejo. As duas são
independentes de propósito.

## Riscos

- **O caminho abrir pra quem não é lead quente.** É o risco central. Uma
  pessoa em dúvida recebendo link de pagamento é pior que uma pessoa em
  dúvida esperando um humano. Mitigação: as duas condições têm que valer
  juntas, a saída por objeção é explícita, e a Onda 5 testa os 6 perfis da
  bateria — o aceite é **1 abre, 5 não**.
- **Gestor não responder.** Vira `expirada` e cai no handoff normal. O
  prazo precisa ser curto o bastante pra não deixar a lead no vácuo e
  longo o bastante pro gestor estar acordado. **Proposta: 2 horas**, no
  mesmo `ConfiguracaoSite` que a 025 vai usar pro prazo do handoff.
  *Pergunta em aberto pro Daniel.*
- **Dois gestores respondendo.** Resolver com trava otimista no `status`
  (só sai de `pendente` uma vez); o segundo recebe "essa já foi resolvida
  pelo Fulano".
- **Cobrança gerada com valor errado.** O `valor_sugerido` sai do preço da
  turma, não do modelo — e o gestor confirma ou corrige. Se ele disser
  "manda 600", o valor vai como `valor_ajustado` num campo numérico, não
  como texto livre.
- **A pessoa se matricular e não pagar.** Já acontece hoje e não piora:
  `Matrícula` e `Cobranca` são coisas separadas desde a spec 015, e a
  Nutridora cuida do follow-up.

## Decisões do Daniel (2026-07-25)

1. **Prazo da aprovação: 2h**, configurável em `ConfiguracaoSite`.
2. **Turma do link: sempre a `turma_destaque`.** A MAG não pergunta.
3. **Pagamento só depois da matrícula.** `aluno_token` deixa de ser
   opcional na criação da `AprovacaoPendente` — é pré-requisito. Isso
   simplifica o model (o campo vira obrigatório) e fecha o caso da
   cobrança órfã na origem.
