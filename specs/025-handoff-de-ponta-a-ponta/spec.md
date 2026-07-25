# Spec 025 — Handoff de ponta a ponta: o lead não some, o contato não fica no vácuo, o gestor não abre segunda via

> Base: bateria de 6 conversas simuladas de 25/07 —
> `.context/historico/2026-07-25-simulacoes-sdr-6-perfis.md`. **6 de 6
> conversas terminaram em handoff**, então o handoff deixou de ser o caso
> de exceção do fluxo: ele *é* o fluxo. E hoje ele tem três buracos.

## Problema / oportunidade

### 1. 🔴 O lead mais quente da amostra não virou lead

A Bianca disse *"quero garantir minha vaga"*, deu o nome, o curso estava
identificado — e **não existe `Lead` dela**. Thiago (5 turnos, nome dado,
curso identificado) e Marcos idem. Três dos seis contatos ficaram só em
`ContatoEscalado` + `Conversa`, fora de `leads_lead`.

A causa é a própria regra de handoff: ela manda *parar de qualificar*, e a
MAG para **antes** de registrar. Quem está fora da tabela de leads some do
Radar (spec 019) e da Nutridora (spec 020) — se o humano não responder,
não existe segunda rede embaixo.

Isto é exatamente a questão que a **spec 023 deixou aberta pra decisão do
Daniel**, agora com evidência do pior caso possível: perde-se justamente
quem estava pronto pra comprar.

### 2. 🔴 Escalado = silêncio permanente, sem volta

`ContatoEscalado` não tem estado: não expira, não tem "resolvido". Uma vez
escalado, o nó `Está escalado?` corta o fluxo **antes do agente**, pra
sempre. Não existe caminho de volta em lugar nenhum do sistema — nem
Admin, nem ação, nem TTL.

O roteiro do Marcos é o pior possível:

1. Chega reclamando que ninguém respondeu na semana passada.
2. MAG pede desculpas e escala (correto — reclamação é gatilho).
3. Ele pergunta **"tá mas e o curso? quanto custa e quando começa?"**
4. **Silêncio absoluto.**

Ele reclamou de não ter resposta e o sistema respondeu com o mesmo
problema, agora definitivo. O Rafael levou o mesmo tratamento ao perguntar
sobre desconto à vista depois de escalado.

### 3. 🟠 O handoff abre uma segunda via de conversa

Hoje `avisar_equipe` manda a notificação pro WhatsApp **pessoal** de cada
gestor (spec 012 + adendo 019-T9). O gestor lê no celular dele e o
caminho natural é responder dali mesmo — e aí o contato passa a ter duas
conversas abertas com a Magma: uma com o número da escola e outra com o
número pessoal de quem atendeu.

Pedido do Daniel: *"ao escalar e avisar o gestor, sempre é bom alertar o
gestor para continuar a conversa pelo WhatsApp da empresa ao invés do
WhatsApp do próprio gestor, porque a pessoa não tem que ter 2 vias de
comunicação"*.

Não é só estética: com duas vias, o histórico da spec 021 não registra
metade da conversa, a Nutridora não sabe que o assunto andou, e se o
gestor sair da empresa o relacionamento vai junto no aparelho dele.

### 4. 🟠 Pergunta de pagamento ≠ objeção de preço

Confirmado pelo Daniel: **objeção de preço deve mesmo escalar** — *"é
muito importante que o gestor tome a frente quando o cliente não aceita o
preço sugerido pela empresa"*. O que a bateria mostrou é que a MAG não
distingue os dois casos e responde a mesma pergunta de três jeitos:

| Contato | Pergunta | O que a MAG fez |
|---|---|---|
| Rafael | *"650 tá salgado... dá pra parcelar em quantas?"* | escalou (**certo** — tem objeção embutida) |
| Juliana | *"consigo parcelar no cartão? tem desconto no pix?"* | respondeu pelo FAQ (**certo** — é pergunta neutra) |
| Bianca | *"como faço pra pagar?"* | meia resposta: *"conforme as opções que a nossa equipe pode te explicar"* |

O FAQ do curso responde a pergunta neutra (*"Cartão de crédito parcelado,
PIX à vista com desconto ou boleto"*) e estava disponível nas três
conversas. Falta o critério, não a informação.

## O que muda para o usuário

- **Contato:** se a equipe demorar, ele não cai num buraco — ao insistir,
  recebe uma resposta de cortesia (não o silêncio de hoje), e depois de um
  tempo a MAG volta a atender normalmente.
- **Contato:** continua falando com **um** número só, o da escola.
- **Gestor:** recebe o aviso de handoff sabendo exatamente por onde
  responder, com o número do contato pronto pra copiar.
- **Gestor:** todo contato escalado aparece na base de leads — some do
  atendimento automático, não do funil.

## Critérios de aceite

- [ ] **Lead garantido no handoff.** `escalar_contato` cria-ou-atualiza um
      `Lead` pelo número, **mesmo sem nome e sem curso**, com
      `utm_source=whatsapp`. Depois da escalada, todo contato escalado tem
      linha em `leads_lead`. Reexecutar não duplica (reusa o dedup da
      spec 023).
- [ ] **Nome e curso aproveitados quando existirem.** Se a conversa já
      identificou nome e/ou curso, eles entram no lead — via parâmetros
      opcionais de `escalar_contato`, resolvidos com a mesma tolerância de
      `resolver_curso()`.
- [ ] **`ContatoEscalado` tem estado.** Campos novos de resolução e
      expiração; o nó `Está escalado?` só silencia quem está **ativo**.
- [ ] **Volta automática.** Passado o prazo sem resolução, o contato
      volta a ser atendido pela MAG — e ela retoma sem fingir que nada
      aconteceu.
- [ ] **Resposta de cortesia.** Contato escalado que manda mensagem nova
      recebe uma resposta curta e honesta (uma vez, não a cada mensagem),
      em vez de silêncio.
- [ ] **Gestor resolve pelo Admin.** Dá pra marcar um `ContatoEscalado`
      como resolvido sem mexer em banco na mão.
- [ ] **Aviso com canal único.** A mensagem do `avisar_equipe` diz
      explicitamente pra responder pelo WhatsApp da Magma, e traz o número
      do contato em formato copiável.
- [ ] **Pagamento: neutro responde, objeção escala.** Testado com as três
      formulações da tabela acima — Rafael escala, Juliana é respondida,
      Bianca é respondida (e o fechamento escala pelo gatilho de matrícula,
      não pelo de preço).
- [ ] Suíte completa verde, com testes novos pro lead-no-handoff, pra
      expiração e pra "não duplica".

## Critério de aceite do gestor

O Daniel consegue, **pelo celular**, ver quem está escalado, marcar como
resolvido e devolver o contato pro atendimento automático — sem pedir pra
ninguém rodar comando.

## Perguntas abertas (decisão do Daniel na revisão)

1. **Prazo de expiração**: 24h? 48h? Só manual (sem expiração automática)?
   A proposta do plano é 24h com o valor configurável em
   `ConfiguracaoSite`, no mesmo espírito da retenção de conversas da
   spec 021 ("só mudar uma config").
2. **Status do lead escalado**: entra como `novo` (some no meio dos
   outros) ou ganha um status próprio tipo `em_atendimento`? A proposta é
   status próprio — é o lead mais quente da base, não pode se misturar.
