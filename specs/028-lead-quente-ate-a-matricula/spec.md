# Spec 028 — Lead quente vai até a matrícula (e o gestor aprova pelo WhatsApp dele)

> Nasce de uma leitura do Daniel sobre a bateria de 6 conversas simuladas
> (`.context/historico/2026-07-25-simulacoes-sdr-6-perfis.md`):
>
> *"Em uma das conversas estava claro que tinha uma pessoa que o que mais
> ela queria era fazer parte do curso, e isso dá para descobrir nas
> primeiras mensagens (...) para aproveitar isso, ao invés de escalar o
> contato, quero ter uma forma de introduzir mais ainda o futuro aluno no
> curso, então a partir daí enviar mídias personalizadas que irão ainda
> mais reforçar o gosto, e posteriormente mandar o link de matrícula, até
> pq imagina o cliente querer muito iniciar, receber o 'material' e ainda
> fazer sua carteirinha digital com a melhor UI/UX. Esse estaria garantido
> para próxima turma. Agora para outros perfis isso tem que ser
> equilibrado."*

## Problema / oportunidade

A conversa da **Bianca** abriu assim:

> *"oi! me falaram do curso de socorrista de vcs eu já decidi que quero
> fazer, só me diz quando começa e quanto é"*

Não há dúvida, não há objeção, não há comparação de preço. É a pessoa mais
fácil de matricular que apareceu nas seis conversas. E o que o sistema fez
com ela foi **parar de falar**: a regra de handoff manda escalar em
"intenção clara de fechar matrícula em QUALQUER formulação", então a MAG
avisou a equipe, marcou `ContatoEscalado` e silenciou. A partir dali a
Bianca esperava um humano que talvez demorasse horas — no melhor momento
que ela ia ter.

O sistema já tem tudo o que falta pra atendê-la sozinho, só não está ligado
no lugar certo:

| Peça | Onde está | Situação |
|---|---|---|
| Link de matrícula estável (`/carteirinha/nova/{token_cadastro}`) | `gerar_link_matricula`, spec 014 | Existe, mas só ligado na **Operadora** (gestor) |
| Carteirinha digital pronta ao preencher o CPF | spec 014 | Pronta |
| Mídia escolhida a dedo pelos gestores | spec 026 | Especificada, não implementada |
| Cobrança real no Asaas | `gerar_cobranca`, spec 015 | Existe, exige gestor confirmar valor e destinatário |
| Histórico da conversa pra resumir | `apps/conversas`, spec 021 | Pronto |
| Régua de follow-up T+1/3/7 | spec 020 | Pronta e ativa |

## O caminho novo

```
lead quente detectado (sem objeção aberta)
    ↓
mídia curada  ────────────────────────────── reforça o desejo (spec 026)
    ↓
link de matrícula ────────────────────────── pessoa preenche CPF
    ↓
vira Aluno + Matrícula + CARTEIRINHA ──────── "esse estaria garantido"
    ↓
MAG resume a conversa e pergunta AO GESTOR:
"posso mandar o link de pagamento de R$ X pra ela?"
    ↓
gestor responde NO CHAT DELE com o bot ────── não abre o WhatsApp da escola
    ↓
MAG gera a cobrança e manda o link PRA LEAD
```

### A decisão que manda nesta spec

O Daniel recusou as três opções que foram oferecidas (parar na matrícula /
ir até o pagamento sozinha / só mídia e chamar humano) e desenhou uma
quarta:

> *"Quero que o link de pagamento seja um webhook do agente explicando e
> perguntando o gestor se deve mandar o link de pagamento (acredito que se
> o bot conseguir resumir a conversa, enquanto confirma com o humano,
> seria uma forma perfeita e rápida, com o humano respondendo e o bot
> replicando/agindo baseado nessa resposta) aí evita que o humano tenha
> que acessar o wpp do curso. Ele como gestor responde diretamente ao bot
> que reorganiza/encaminha."*

Isso **preserva** a trava da spec 015 (cobrança nunca sai sem um humano
confirmar valor e destinatário) e ao mesmo tempo tira o atrito que a trava
custava: o gestor não precisa abrir o WhatsApp da escola, procurar a
conversa, ler tudo e responder. Ele recebe um resumo no **próprio chat**,
responde "pode mandar", e o bot faz o resto.

E encaixa numa pista que já existe: **quando um gestor fala com a MAG, ele
já cai na Operadora** (`É gestor ou instrutor?` → `Operadora - Secretária
Digital`). A aprovação não precisa de canal novo — precisa que a Operadora
saiba o que é uma aprovação pendente.

## O que muda para o usuário

- **Lead quente:** deixa de bater num muro no melhor momento. Recebe
  material, se matricula sozinha, sai da conversa com a carteirinha
  digital na mão e o link de pagamento em minutos, não em horas.
- **Gestor:** para de ser a etapa que atrasa a venda. Recebe um resumo do
  que aconteceu e decide com uma palavra, do próprio celular, sem trocar
  de conversa. Continua sendo ele quem autoriza o valor.
- **Quem NÃO é lead quente:** nada muda. Objeção de preço, reclamação,
  assunto sensível e pedido explícito de humano continuam indo pro
  handoff normal, como o Daniel confirmou na análise da bateria.

## Onde fica o equilíbrio

O Daniel pediu explicitamente: *"para outros perfis isso tem que ser
equilibrado"*. O caminho novo **só abre** quando as duas coisas valem ao
mesmo tempo:

1. **Intenção declarada** de fazer o curso — não é "quanto custa?", é
   "quero fazer", "já decidi", "quero garantir minha vaga".
2. **Nenhuma objeção aberta** na conversa: ninguém achou caro, ninguém
   pediu desconto, ninguém reclamou, ninguém pediu pra falar com alguém.

Se aparecer objeção **depois** de o caminho abrir (ela recebe o link e
responde "ah, mas 650 tá caro"), o caminho fecha e vira handoff normal na
hora. A regra do Daniel continua valendo acima de tudo: *"é muito
importante que o gestor tome a frente quando o cliente não aceita o preço
sugerido pela empresa"*.

| Perfil da bateria | Hoje | Com a 028 |
|---|---|---|
| **Bianca** — "já decidi que quero fazer" | handoff, silêncio | **caminho novo** |
| **Rafael** — "650 tá salgado pra mim mano" | handoff | handoff (inalterado) |
| **Marcos** — reclamação de atendimento | handoff | handoff (inalterado) |
| **Sandra** — mãe insegura sobre emprego | handoff | handoff (inalterado) |
| **Thiago** — quer turma que não existe | handoff | handoff (inalterado) |
| **Juliana** — compara preço, pede desconto | handoff | handoff (inalterado) |

Ou seja: **1 dos 6**. É pouco de propósito — é o perfil em que o humano não
acrescenta nada e só atrasa.

## Se a pessoa não concluir a matrícula

Decisão do Daniel: **fica com a Nutridora**, a régua T+1/3/7 que já existe
(spec 020). Zero código novo. Ela virou `Lead` no `registrar_lead` e não
está escalada (o caminho novo não cria `ContatoEscalado`), então a régua a
pega naturalmente.

## Critérios de aceite

- [ ] **Lead quente não é mais escalado.** Contato que declara intenção sem
      objeção recebe mídia + link de matrícula, e **não** existe
      `ContatoEscalado` pro número dele.
- [ ] **Matrícula de verdade.** Abrir o link, preencher o CPF e virar
      `Aluno` + `Matrícula` + carteirinha acessível, sem gestor no meio.
- [ ] **O gestor recebe um resumo útil**, não um despejo: quem é, que curso,
      o que ela disse, o valor proposto, e a pergunta objetiva.
- [ ] **O gestor aprova no chat dele.** Responder "pode mandar" (ou
      variações) na conversa dele com a MAG gera a cobrança e manda o link
      **pra lead**, não pro gestor.
- [ ] **O gestor pode recusar ou mudar o valor.** "não", "manda 600" e
      "deixa que eu falo com ela" têm efeitos distintos e corretos.
- [ ] **O modelo nunca escolhe o destinatário.** O número pra onde o link
      de pagamento vai sai do registro de aprovação no banco, nunca de um
      parâmetro produzido pela IA.
- [ ] **Aprovação não fica pendurada.** Passado o prazo sem resposta de
      nenhum gestor, vira handoff normal e o contato não fica no vácuo.
- [ ] **Objeção depois do link fecha o caminho** e escala.
- [ ] **Uma aprovação, um efeito.** Dois gestores respondendo "sim" não
      geram duas cobranças.
- [ ] Suíte completa continua verde.

## Critério de aceite do gestor

O Daniel recebe no WhatsApp: *"Bianca (21 9xxxx-xxxx) acabou de se
matricular na turma 026 (Socorrista APH). Ela chegou dizendo que já tinha
decidido fazer o curso e não levantou nenhuma objeção. Posso mandar o link
de pagamento de R$ 650,00 pra ela?"* — responde **"pode"** e não precisa
fazer mais nada.

## Fora de escopo

- **Capacidade genérica de "mandar mensagem por você".** O prompt da
  Operadora diz hoje que ela não faz isso, e continua não fazendo. O que
  entra é estreito: relatar uma cobrança aprovada ao contato **daquela**
  aprovação. Abrir o caso geral (gestor manda a MAG falar com qualquer
  número) é outra spec, com outros riscos.
- **Cobrança recorrente / parcelamento negociado.** O gestor aprova um
  valor; negociação de condição continua sendo conversa humana.
- **Detectar lead quente por modelo treinado ou score no backend.** Aqui é
  leitura de intenção, que é justamente o que LLM faz bem — ao contrário
  de montar identificador, que é o que ele erra (spec 023).
