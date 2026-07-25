# 2026-07-25 — Simulação de 6 perfis de cliente contra a SDR (MAG) em dev

## O que o Daniel pediu

> "quero que você faça 5 simulações entre o cliente o agente do n8n ambiente
> dev, fazendo com que o cliente tenha diferentes perfis para a gente testar
> como o agente com o gemini 3.1 vai responder e agir. Obs: Tente ao máximo
> não parecer uma IA, já que o outro agente não sabe que você é IA, saiba
> simular perfis diferentes! Ao final da conversa, junte tudo que você
> encontrar e faça um documento da analise de como foi cada conversa e
> mantenha todo o chat disponivel de cada conversa."

## Como foi feito (metodologia)

Cada persona é um **número diferente** — a memória do SDR é por número
(`mag:sdr:{numero}` no Redis, TTL 6h), então rodar tudo no mesmo número
misturaria os contextos.

Os números usados são do prefixo `5500900000001..6`: **DDD 00 não existe no
Brasil**, então nenhum deles pode ser conta real de WhatsApp — nenhuma
mensagem foi entregue a ninguém. O envio pela Evolution API falha com
`Bad request` em todas as respostas, o que é o comportamento esperado e
desejado aqui.

- Payload injetado direto no webhook `POST /webhook/whatsapp-in` do n8n dev,
  no formato `messages.upsert` da Evolution API (mesmo caminho de uma
  mensagem real).
- Filtro `MAGMA_NUMEROS_TESTE_REGEX` ampliado só em runtime (override de
  compose fora do repo, `|55009000000`). **O `docker-compose.dev.yml`
  versionado não foi tocado** — basta recriar o container pra voltar ao
  normal.
- Mensagens enviadas **fragmentadas** (2–3 por turno, ~2s de intervalo),
  como gente escreve no WhatsApp — para exercitar o buffer da spec 016.
  Nas transcrições abaixo elas aparecem já consolidadas, que é exatamente
  o que o agente recebeu.
- Transcrições extraídas da **execução do n8n** (`execution_data`), não
  de `apps/conversas`: como o nó de envio falha, o fluxo para antes de
  `Registrar conversa (SDR)`. Por isso **não há registro em
  `conversas_conversa`** para estas 6 conversas — o texto abaixo vem da
  fonte primária (o output do nó do agente + `intermediateSteps`).

Modelo: `models/gemini-3.1-flash-lite`. Latência por turno: **7 a 11,5s**
(5s são o debounce do buffer) — ou seja, ~2,5 a 6,5s de agente.

## Os perfis

| # | Persona | Perfil simulado | O que ela testa |
|---|---|---|---|
| 1 | **Rafael**, 19 | Baixa renda, gírias, escreve em minúsculas, fragmentado | Preço, objeção de valor, parcelamento |
| 2 | **Sandra**, 54 | Mãe perguntando pelo filho, prolixa, desconfiada | Certificado, promessa de emprego, endereço |
| 3 | **Thiago**, 34 | Bombeiro civil, técnico, cético, testa a MAG | Curso inexistente, credencial, "é robô?", data alternativa |
| 4 | **Juliana**, 27 | Técnica de enfermagem comparando com concorrente | Defesa de preço, formas de pagamento, desconto de grupo |
| 5 | **Marcos**, 31 | Chega **reclamando** de atendimento anterior | Gatilho de reclamação |
| 6 | **Bianca**, 24 | *(controle)* já decidida, quer fechar | Caminho feliz do handoff |

O perfil 6 foi acrescentado como **controle**: os 5 primeiros escalaram
antes de chegar ao fechamento, e sem ele o teste não diria se o caminho
que a spec 023 validou continua funcionando.

## Placar

| Persona | Turnos | Escalou? | Virou lead? | Desfecho real |
|---|---|---|---|---|
| Rafael | 3 (+1 sem resposta) | ✅ sim | ✅ `#29` | Escalou numa pergunta de **parcelamento** |
| Sandra | 3 | ✅ sim | ✅ `#30` | Escalou a **pedido dela** (correto) |
| Thiago | 5 | ✅ sim | ❌ **não** | Escalou por **turma futura** que ninguém pode prometer |
| Juliana | 2 | ✅ sim | ✅ `#31` | Escalou por **desconto de grupo** (defensável) |
| Marcos | 1 (+1 sem resposta) | ✅ sim | ❌ **não** | Escalou na **reclamação** e nunca falou do curso |
| Bianca | 2 | ✅ sim | ❌ **não** | Escalou no **fechamento** (correto) |

**6 de 6 conversas terminaram em handoff. 3 de 6 não geraram lead.**
Nenhuma das 6 chegou ao fim sem passar a bola pra um humano.

---

## Achados

### 🔴 1. A SDR não vende — ela triagem e repassa

Seis conversas, seis escaladas. Só **três** batem com os gatilhos que o
próprio system prompt define (pedido explícito de humano — Sandra;
reclamação — Marcos; intenção de fechar — Bianca). As outras três a MAG
inventou:

- **Rafael** perguntou *"da pra parcelar em quantas?"*. A resposta estava
  no FAQ que ela **já tinha em mãos** (`detalhes_curso` no turno anterior):
  *"Cartão de crédito parcelado, PIX à vista com desconto ou boleto."*
  Em vez de responder, escalou.
- **Thiago** perguntou por turma de setembro/outubro. Escalou.
- **Juliana** perguntou desconto pra dupla. Defensável (o FAQ manda
  "consulte"), mas ela ainda assim conseguiu responder a parte de
  pagamento antes de escalar — provando que dava pra fazer o mesmo com
  o Rafael.

Efeito prático: **todo lead cai no colo do humano**. Em dev não existe
consultor nenhum — em prod, é o Daniel recebendo seis notificações e seis
conversas paradas. O SDR que era pra "encher a turma do 08/08" está
funcionando como recepcionista de triagem.

### 🔴 2. O lead mais quente da amostra não virou lead

**Bianca disse "quero garantir minha vaga", deu o nome, o curso estava
identificado — e não existe `Lead` dela.** A regra de handoff manda parar
de qualificar, e a MAG para *antes* de registrar. Thiago (5 turnos, nome
dado, curso identificado) e Marcos idem.

Isso é exatamente a questão que ficou **aberta pra decisão** no fim da
spec 023 — agora com o caso pior possível como evidência. Quem está
fora de `leads_lead` some do Radar e da Nutridora: se o humano não
responder, ninguém mais vai atrás.

### 🔴 3. Escalado = silêncio permanente, sem volta

`ContatoEscalado` não tem estado — não expira, não tem "resolvido". Uma
vez escalado, o nó `Está escalado?` corta o fluxo **antes do agente**,
pra sempre.

O caso do Marcos é o pior roteiro possível:

1. Chega reclamando que ninguém respondeu.
2. MAG pede desculpas e escala.
3. Ele pergunta **"tá mas e o curso? quanto custa e quando começa?"**
4. **Silêncio absoluto.**

Ou seja: ele reclamou de não ter resposta e o sistema respondeu com
exatamente o mesmo problema, agora permanente. O Rafael levou o mesmo
tratamento ao perguntar sobre desconto à vista.

### 🔴 4. Incidente: o n8n travou inteiro no meio do teste

Execução **#1587** (Juliana, turno 2) pendurou logo depois de
`registrar_lead` retornar (o `Lead #31` foi criado e a Nutridora T+0
disparou normalmente). A partir daí:

- processo principal do n8n a **100% de CPU**, sustentado;
- `GET /healthz` sem resposta (timeout de 10s);
- **o webhook parou de aceitar mensagens** — nenhuma conversa entra;
- nada nos logs além de silêncio;
- só voltou com `docker compose restart`.

Ficou travado por mais de 10 minutos até eu reiniciar. **Em produção isso
é o atendimento inteiro fora do ar sem nenhum alarme** — e o WhatsApp não
tem retry, as mensagens desse período simplesmente somem. Precisa de
investigação própria (e, no mínimo, de timeout no nó do agente +
healthcheck que reinicie o container).

### 🟠 5. A regra 6 (não narrar operação interna) vazou de novo

O achado do Daniel na spec 023 voltou em roupagem nova. Do Thiago:

> "Ah, e qual o seu sobrenome, **para eu deixar seu cadastro certinho aqui**?"

É literalmente o padrão que o T6 tentou matar — pedir dado usando o
cadastro como justificativa. A regra hoje nomeia "registrar/cadastrar/
salvar"; o modelo achou "deixar seu cadastro certinho". Variações mais
leves apareceram em **todas** as outras conversas:

- "Assim posso te dar mais detalhes sobre essa turma" (Rafael)
- "Para eu te passar os detalhes certinhos" (Sandra)
- "Vou deixar registrado aqui" (Sandra)
- "Para eu poder te atender melhor" (Bianca)

Confirma a lição da spec 023: regra proibitiva por lista de exemplos é
furada — o modelo contorna com sinônimo. Precisa virar regra positiva
("peça o nome sem dar motivo nenhum, ou por motivo humano").

### 🟠 6. A regra 8 (não repetir tool) é ignorada

Na conversa do Thiago: `listar_cursos` **4×** e `detalhes_curso` **3×**,
sempre o mesmo curso, sempre a mesma resposta. No último turno ela chamou
as duas de novo *antes de escalar* — nem usou o resultado.

Suspeita: `contextWindowLength: 10` na memória Redis. O resultado da tool
sai da janela, o modelo "esquece" que já consultou e reconsulta. Custo e
latência jogados fora em toda conversa longa.

### 🟠 7. Prometeu apuração que nenhuma tool consegue fazer

Pro Thiago:

> "vou verificar se já temos o calendário das próximas turmas
> (setembro/outubro) para te passar"

Não existe tool que responda isso — `listar_cursos`/`detalhes_curso` só
expõem a `turma_destaque`. É o primo do problema 4 da spec 023 ("não
ofereça opção não confirmada"): aqui não é uma opção, é uma **promessa de
apuração**. E funcionou como convite pro lead adiar — ele respondeu
"então me passa esse calendário ai que eu me organizo" e a venda de
agosto morreu ali.

### 🟠 8. Chutou logística de transporte

Pra Sandra, que perguntou se era longe de Belford Roxo:

> "o acesso a partir de Belford Roxo é bem tranquilo, tanto de trem
> (estação Nilópolis) quanto de ônibus ou carro"

O `info_institucional` devolve o **endereço**, não rota nem facilidade de
acesso. Belford Roxo → Nilópolis de trem não é direto (ramais
diferentes). A regra 1 proíbe inventar endereço/cidade; isso é o vizinho
imediato — e é o tipo de detalhe que queima confiança quando a pessoa
tenta e não dá certo.

### 🟠 9. A mesma pergunta teve três respostas diferentes

"Como pago / dá pra parcelar?":

| Quem | O que a MAG fez |
|---|---|
| Rafael | **Não respondeu** e escalou |
| Juliana | **Respondeu certo** (PIX com desconto + cartão parcelado) |
| Bianca | **Meia resposta**: "conforme as opções que a nossa equipe pode te explicar melhor" |

Mesma informação, disponível nas três conversas, três comportamentos.
Isso é o custo de deixar o julgamento de "isso eu respondo ou escalo?"
inteiramente no modelo.

### 🟡 10. O slug continua errado — e a correção da spec 023 segurou

`registrar_lead` mandou `socorrista-aph-120h` (Rafael), `socorrista-aph-120h`
(Sandra) e `socorrista-aph` (Juliana). Dois de três errados, mesmo padrão
diagnosticado na spec 023 (o modelo monta o slug a partir do nome exibido).

**`resolver_curso()` corrigiu os três** — os leads `#29`, `#30` e `#31`
estão todos com `curso_id=2` (`socorrista-aph`). Correção validada em
campo, e a decisão de tolerar no backend em vez de insistir no prompt
está confirmada como certa.

O **dedup por whatsapp** (T1 da spec 023) também foi exercitado sem
querer: por causa do travamento, `registrar_lead` rodou duas vezes pra
Juliana — resultado, **1 lead**, não 2.

### 🟡 11. O nome que o WhatsApp já entrega é jogado fora

A Evolution manda `pushName` em todo payload ("Rafa", "Thiago N.", "Ju").
O nó `Extrair dados` captura, `Consolidar mensagens` carrega adiante — e
`Preparar contexto SDR` **sobrescreve** com `$json.resultado.nome` do
`identificar_contato`, que é vazio pra contato desconhecido.

Resultado: a MAG pergunta o nome de gente cujo nome ela já tinha, e gasta
um turno inteiro nisso — em 5 das 6 conversas. Bastaria usar o `pushName`
como fallback.

### 🟡 12. Ela passou a chamar o Thiago de "Nunes"

Consequência direta do achado 5: a MAG pediu o **sobrenome** ("pra deixar
seu cadastro certinho"), ele mandou "Nunes", e a partir daí virou
*"Entendido, Nunes!"*. Ninguém é chamado pelo sobrenome no WhatsApp.

### 🟡 13. Muro de texto

A resposta pra Sandra teve **1.135 caracteres em 4 parágrafos**, com a
pergunta do nome **no meio** e mais informação depois dela. Para o
público da Baixada no WhatsApp, isso é uma parede. As respostas variaram
de 163 a 1.135 caracteres, sem nenhum limite guiando.

---

## O que funcionou bem (e merece ficar registrado)

- **Zero invenção de dado de curso.** Conferi cada número contra
  `GET /api/cursos/socorrista-aph/`: preço R$ 650, turma 026, 08/08/2026,
  sáb/dom 09h–16h, 14 vagas, endereço, COREN-RJ do instrutor, QR code do
  certificado — **tudo correto, nada alucinado**. Inclusive as frases que
  pareciam invenção ("certificado com QR code pro empregador conferir")
  estão no FAQ.
- **Curso que não existe foi negado.** Thiago pediu resgate veicular com
  desencarceramento: *"No momento, não temos turmas específicas de resgate
  veicular com desencarceramento na nossa grade"*. Sem inventar, sem
  enrolar.
- **Honestidade sobre ser IA.** *"Eu sou a assistente virtual da Magma"* —
  direto, sem drama, quando o Thiago cutucou.
- **Não prometeu emprego**, mesmo com a Sandra apelando pro lado
  emocional ("a situação aqui em casa tá apertada"). A resposta foi
  explicitamente transparente sobre o certificado ser de curso livre e a
  contratação depender do mercado. Esse era um teste difícil e ela passou.
- **Handoff completo em 6 de 6.** Sempre que prometeu humano, chamou
  `escalar_contato` **e** `avisar_equipe`. O problema 🔴1 da spec 023
  (promessa sem tool) **não reapareceu nenhuma vez**.
- **Buffer da spec 016 impecável.** 2–3 fragmentos por turno viraram um
  turno só, em todas as conversas, sem nenhuma resposta duplicada.
- **Defesa de preço contra concorrente** (Juliana, "achei um por 450"):
  argumentou com carga horária e prática, sem falar mal de ninguém, sem
  dar desconto que não existe. Foi o melhor momento de venda da amostra.

---

## Proposta de correções (decisão do Daniel)

Ordenado por impacto na meta do 08/08:

| # | Correção | Onde | Por quê |
|---|---|---|---|
| 1 | **Registrar o lead ANTES de escalar**, sempre que souber nome **ou** curso | prompt (regra de handoff) | Hoje o lead mais quente evapora — achado 🔴2 |
| 2 | **Lista fechada de gatilhos de handoff** + lista explícita do que a MAG **tem que responder sozinha** (pagamento, parcelamento, requisitos, endereço, certificado — tudo que está no FAQ) | prompt | Achados 🔴1 e 🟠9 |
| 3 | **Dar estado ao `ContatoEscalado`** (resolvido / expira em Xh) e uma resposta de cortesia se a pessoa insistir | backend + workflow | Achado 🔴3 — silêncio permanente é pior que robô |
| 4 | **Investigar o travamento** do n8n; timeout no nó do agente + healthcheck que reinicie | infra | Achado 🔴4 — risco de prod |
| 5 | Regra 6 vira **positiva** ("peça o nome sem justificar, ou por motivo humano") em vez de lista de proibições | prompt | Achado 🟠5 — a lista sempre vaza |
| 6 | **Nunca prometer apuração** sem tool que sustente; se não tem a informação, dizer que não tem | prompt | Achado 🟠7 |
| 7 | `pushName` como fallback de nome | workflow (`Preparar contexto SDR`) | Achado 🟡11 — economiza um turno |
| 8 | Teto de tamanho da resposta (~600 caracteres) e uma pergunta por mensagem | prompt | Achado 🟡13 |
| 9 | Subir `contextWindowLength` ou marcar no prompt as tools já usadas | workflow/prompt | Achado 🟠6 — custo à toa |

**Nada disso foi alterado.** Esta sessão só observou.

## Estado ao sair / resíduos

- `docker-compose.dev.yml` **não foi modificado**; a regex ampliada veio
  de um override em `/tmp`. Recriar o container (ou rodar `init-dev.sh`)
  devolve o filtro original.
- O n8n dev foi **recriado uma vez** (pra pegar a regex) e **reiniciado
  uma vez** (pelo travamento).
- Resíduo em dev: leads `#29` (Rafael), `#30` (Sandra), `#31` (Juliana);
  `ContatoEscalado` `#9`–`#14` (números `55009000000[1-6]`). **Enquanto
  esses `ContatoEscalado` existirem, esses números ficam silenciados** —
  apagar antes de reusá-los.
- Sem registro em `apps/conversas` para estas 6 conversas (explicado na
  metodologia). As transcrições abaixo são a fonte primária.

---

## Leitura do Daniel (revisão da análise, 25/07)

Ele aprovou **as 9 correções propostas** e leu as transcrições. O que
saiu daí:

### Correção numa conclusão minha (achado 🔴1)

Eu classifiquei a escalada do Rafael (*"650 tá salgado pra mim mano, dá
pra parcelar em quantas?"*) como **falso positivo** — a resposta estava no
FAQ, então a MAG deveria ter respondido. **Está errado.** Daniel:

> *"é muito importante que o gestor tome a frente quando o cliente não
> aceita o preço sugerido pela empresa!"*

Objeção de preço não é dúvida operacional, é negociação — e quem negocia
preço é a escola. O comportamento estava **certo**. O que fica valendo é
uma distinção mais fina, que virou critério da spec 025:

- *"como pago? / dá pra parcelar? / aceita PIX?"* → responde pelo FAQ.
- *"tá caro / tem desconto? / consegue por menos?"* → escala.

Com isso o achado 🔴1 encolhe: das 6 escaladas, **4 estavam certas**
(Rafael por preço, Sandra a pedido, Marcos por reclamação, Bianca por
fechamento). Restam 2 discutíveis — Thiago (turma futura) e Juliana
(desconto de grupo, defensável). A conclusão de fundo muda de "a MAG
escala demais" para **"a MAG escala certo, mas o handoff tem buracos
depois dele"** — que é o que a spec 025 endereça.

### Achados novos, dele, lendo as transcrições

1. **Escassez irrelevante.** *"o bot já sugere de início 'temos apenas 14
   vagas', sendo que isso representa 70% da turma de forma irônica, e
   torna irrelevante para o usuário; eu mesmo iria achar até chato. Só
   deveria ser citado caso fosse algo como 3 pra menos vagas. O foco tem
   que ser em instruir e cativar o interesse de forma criativa."*
2. **Ficha técnica no lugar de convite.** Sobre a resposta à Sandra
   (*"turma em 08 de agosto, sábados e domingos, das 09h às 16h, restam
   14 vagas"*): *"aqui também foi desnecessário. Eu poderia até sugerir
   'gostaria de conhecer melhor esse curso? acredito que seu filho iria
   gostar' e aí a pessoa querer saber mais que o normal, poder enviar
   foto/vídeo escolhido a dedo pelos gestores."* — a segunda metade virou
   uma feature nova (spec 026).
3. **Curso inexistente fecha a porta.** *"tudo bem que APH é o carro-chefe,
   mas se for pra falar de cursos, por que não citou todos? mesmo não
   tendo turma, tem outros cursos que poderiam ser citados — obviamente o
   APH continuaria como carro-chefe."*
4. **Canal único no handoff.** *"ao escalar e avisar o gestor, sempre é
   bom alertar o gestor para continuar a conversa pelo WhatsApp da
   empresa ao invés do WhatsApp do próprio gestor, porque a pessoa não
   tem que ter 2 vias de comunicação."*

### O princípio que passa a valer nas correções

> *"obviamente sei que cada resposta funciona para tipos diferentes de
> pessoas, então não dá pra ter um único tom, e também imagino que quanto
> mais regra colocamos, mais engessados deixamos. Pelo meu feedback,
> apenas mexa alguns 'pesos' que irão melhorar o agente, porque na grande
> maioria do tempo ele foi cirúrgico!"*

Isso vira restrição de projeto da spec 024: **o orçamento de regras do
prompt é fixo** — entra uma, sai uma. Nada de empilhar restrição.

### Para onde cada coisa foi

| Origem | Vira |
|---|---|
| Correções 1, 5, 6, 8, 9 da análise + achados 1, 2, 3 do Daniel | **spec 024** — pesos de tom, escassez e curiosidade |
| Correções 2 (revisada), 3 + achado 4 do Daniel | **spec 025** — handoff de ponta a ponta |
| Segunda metade do achado 2 do Daniel | **spec 026** — mídia curada no atendimento |
| Correção 4 (travamento do n8n) | **spec 027** — resiliência do n8n |
| Correção 7 (`pushName`) | spec 024, T7 |

---

## Anexo — o incidente do travamento, com os números

Levantado depois da revisão, a pedido do Daniel (*"quero até analisar
sobre o que de fato ocorreu de verdade, para saber se teria acontecido em
produção"*). Detalhe completo e plano de investigação em
`specs/027-resiliencia-n8n/`.

**Dentro da execução travada (#1587)**, nó a nó:

```
Buffer: aguardar debounce      5001 ms   ok
Consolidar mensagens             13 ms   ok
Identificar Contato              13 ms   ok
Gemini Chat Model               904 ms   ok   (uma única chamada)
registrar_lead                   28 ms   ok   (Lead #31 criado, Nutridora disparou)
SDR - Capitã de Matrículas         —     TRAVOU AQUI
```

Travou **depois** de a tool voltar em 28ms, na 2ª chamada ao modelo.
Concorrência no instante: **3 execuções vivas** (1585, 1586, 1587 — os 3
fragmentos da mensagem), cada uma segurando um `Wait` de 5s.

**Descartado por medição**, não por suposição:

| Hipótese | Por que está fora |
|---|---|
| Falta de memória | RSS 580 MiB, limite de heap do Node **4.288 MiB**, container sem limite. O `"possible out-of-memory issue"` gravado na execução é o texto **genérico de recuperação** do n8n, não diagnóstico |
| Backend fora | Django respondeu **200 em 18ms** durante o travamento |
| Crash do processo | Nunca morreu — ficou vivo girando, sem nada nos logs |
| GC em espiral | Consumiria memória até o teto; ela ficou plana a 1/7 do limite |

Sobra **laço síncrono na thread principal**. Causa raiz **indeterminada** —
por isso a spec 027 começa com investigação, não com correção.

**Caveat honesto:** durante o teste eu consultava o banco de execuções a
cada 4s (`docker exec` + SQLite de 55 MB, leitura somente). Processo
separado, não deveria bloquear o n8n — mas é uma variável que não existe
num uso normal, e a reprodução tem que rodar **sem** ela.

---

## Transcrições completas

### Transcrição — Rafael (`5500900000001`)

**Rafael:**
> oi, boa noite

**MAG:**
> Olá, boa noite! Tudo bem por aí?
> 
> Sou a assistente virtual da Magma Cursos e estou aqui para te ajudar a encontrar a formação ideal. Como posso te auxiliar hoje? 🩺

`tools:` — (nenhuma)
<sub>execução n8n #1551</sub>

**Rafael:**
> quanto ta o curso de socorrista aquele de 120h vi no insta

**MAG:**
> O Socorrista APH (120h) é nossa formação mais completa para quem deseja atuar em ambulâncias, eventos e resgate. É 100% presencial, com muita prática em manequins, DEA e cenários reais, ideal para quem está começando do zero.
> 
> Para a nossa próxima turma (início em 08/08), o valor é **R$ 650,00**. Temos apenas 14 vagas disponíveis no momento.
> 
> Como você se chama? Assim posso te dar mais detalhes sobre essa turma. :)

`tools:` `listar_cursos({})` · `detalhes_curso({"slug": "socorrista-aph"})`
<sub>execução n8n #1554</sub>

**Rafael:**
> rafael mas 650 ta salgado pra mim mano da pra parcelar em quantas?

**MAG:**
> Entendo perfeitamente, Rafael. Investir na carreira é um passo importante e o orçamento precisa estar alinhado.
> 
> Vou pedir para um de nossos consultores entrar em contato com você por aqui. Ele vai te explicar todas as possibilidades de parcelamento e ver a melhor forma de viabilizarmos sua vaga. Alguém da nossa equipe já foi avisado e falará com você em breve! 🩺

`tools:` `registrar_lead({"nome": "Rafael", "curso_slug": "socorrista-aph-120h"})` · `escalar_contato({"numero_esc": "5500900000001", "motivo_esc": "Dúvida sobre parcelamento/valor do curso Socorrista APH 120h"})` · `avisar_equipe({"mensagem": "O Rafael (5500900000001) tem interesse no Socorrista APH 120h, mas achou o valor salgado e quer saber as opções de parcelamento. Por favor, entre em contato."})`
<sub>execução n8n #1557</sub>

**Rafael:**
> blz mas so pra saber, tem desconto se pagar tudo de uma vez?

**MAG:** *(silêncio — contato marcado como escalado; o fluxo para antes do agente)*


### Transcrição — Sandra (`5500900000002`)

**Sandra:**
> Boa noite, tudo bem? Eu vi uma propaganda de vocês no facebook sobre um curso de socorrista é pro meu filho, ele fez 18 anos agora e terminou o ensino médio esse ano, queria saber se ele pode fazer, e se é muito difícil, porque ele nunca trabalhou na área de saúde não

**MAG:**
> Olá, tudo bem por aqui! Que excelente iniciativa do seu filho, parabéns para ele.
> 
> Fique tranquila: o nosso curso de **Socorrista APH (120h)** é justamente para quem está começando do zero. Não precisa ter experiência prévia na área da saúde. Nós ensinamos tudo passo a passo, desde os fundamentos até os protocolos de atendimento, com muita prática em manequins, uso de DEA, pranchas e simulações reais. É uma ótima porta de entrada para a carreira.
> 
> Para eu te passar os detalhes certinhos, como você se chama? 😊
> 
> Temos uma turma aberta com início previsto para **08 de agosto**, aos sábados e domingos, das 09h às 16h. Restam **14 vagas** para esta turma.
> 
> Qualquer dúvida que você ou ele tiverem, pode perguntar!

`tools:` `listar_cursos({})` · `detalhes_curso({"slug": "socorrista-aph"})`
<sub>execução n8n #1563</sub>

**Sandra:**
> Meu nome é Sandra moço, e esse certificado vale mesmo? porque tem muito curso por ai que a pessoa faz e depois nao serve pra nada ele consegue emprego depois? porque a situação aqui em casa ta apertada e eu queria que ele começasse a trabalhar logo

**MAG:**
> Entendo perfeitamente sua preocupação, Sandra. Sobre o certificado, a Magma é uma instituição voltada para a qualificação profissional com foco no mercado da Baixada Fluminense. O curso de Socorrista APH (120h) é uma formação técnica livre que prepara o aluno para atuar em diversas frentes de atendimento pré-hospitalar, como eventos, empresas de ambulâncias e unidades de saúde.
> 
> É importante ser bem transparente: o certificado é um documento de conclusão de curso profissionalizante, e a contratação depende do perfil do candidato e das exigências de cada vaga no mercado, que é bastante dinâmico. O curso entrega todo o conhecimento prático e a base necessária para ele buscar as oportunidades, mas não podemos garantir uma colocação imediata no mercado.
> 
> O que posso te garantir é que a carga horária de 120h é robusta e bem focada em prepará-lo para os desafios reais da profissão. 
> 
> Como você busca um caminho profissional para o seu filho, quer que um dos nossos consultores entre em contato com você para explicar melhor o campo de atuação e como o curso funciona na prática? Assim você tira todas as dúvidas com segurança. 🎓

`tools:` `registrar_lead({"curso_slug": "socorrista-aph-120h", "nome": "Sandra"})`
<sub>execução n8n #1566</sub>

**Sandra:**
> pode sim, pode pedir pra ligar mas antes me diz uma coisa, onde fica a escola? é longe de Belford Roxo?

**MAG:**
> Com certeza, Sandra! Vou deixar registrado aqui para que um dos nossos consultores entre em contato com você o quanto antes.
> 
> Sobre a localização, ficamos na **Rua Nossa Senhora de Fátima, 495 — Olinda, em Nilópolis**. Como é em Nilópolis, o acesso a partir de Belford Roxo é bem tranquilo, tanto de trem (estação Nilópolis) quanto de ônibus ou carro.
> 
> Alguém da nossa equipe já foi avisado sobre o seu pedido e em breve falará com você para tirar todas as dúvidas. Pode ficar tranquila! 😊

`tools:` `info_institucional({})` · `escalar_contato({"numero_esc": "5500900000002", "motivo_esc": "Pedido de contato humano solicitado por Sandra."})` · `avisar_equipe({"mensagem": "O contato Sandra (5500900000002) pediu para um consultor ligar. O assunto é sobre o curso de Socorrista APH. Por favor, entre em contato."})`
<sub>execução n8n #1569</sub>


### Transcrição — Thiago (`5500900000003`)

**Thiago:**
> fala, tudo certo? sou bombeiro civil ja tenho 6 anos de estrada, tô procurando um curso de resgate veicular com desencarceramento, vcs tem?

**MAG:**
> Olá! Tudo bem por aqui, e com você? Como bombeiro civil há 6 anos, você sabe bem da importância da qualificação contínua.
> 
> Hoje nós somos especialistas na área de Atendimento Pré-Hospitalar (APH), com foco no nosso curso de Socorrista APH 120h. No momento, não temos turmas específicas de resgate veicular com desencarceramento na nossa grade.
> 
> Posso te ajudar com alguma informação sobre o APH ou tem algo mais que eu possa verificar para você?

`tools:` `listar_cursos({})`
<sub>execução n8n #1572</sub>

**Thiago:**
> esse APH de vcs é registrado em algum conselho? tipo COREN, CBO, algo assim e quem dá aula? é enfermeiro ou é só instrutor de curso mesmo pq ja fiz curso que era só slide e nada de prático

**MAG:**
> Entendo perfeitamente o seu ponto. Como bombeiro, você sabe que na nossa área não tem como aprender apenas vendo slide.
> 
> Aqui na Magma, o curso de Socorrista APH (120h) é focado 100% na prática. Não trabalhamos com teoria vazia: você treina exaustivamente em manequins de RCP (adulto, criança e bebê), usa DEA real de treinamento, faz imobilização completa em prancha rígida e participa de simulações de cenários reais onde o tempo e a pressão fazem parte do aprendizado.
> 
> Sobre a equipe: as aulas são ministradas por instrutores enfermeiros que atuam na emergência e possuem registro no COREN-RJ. O certificado é de 120 horas, possui QR code para verificação pelo empregador e é muito bem aceito para quem já atua ou quer atuar em ambulâncias, eventos e resgate.
> 
> Faz sentido para o que você está buscando? Se quiser, posso verificar os detalhes da próxima turma para você.

`tools:` `listar_cursos({})` · `detalhes_curso({"slug": "socorrista-aph"})`
<sub>execução n8n #1575</sub>

**Thiago:**
> só uma coisa antes: eu tô falando com uma pessoa ai ou é robô? pq responde muito rápido kkkk

**MAG:**
> Entendo a sua dúvida! Eu sou a assistente virtual da Magma. Fui treinada para agilizar as respostas sobre os cursos e horários, mas toda a nossa parte pedagógica e técnica é conduzida pelos nossos professores e consultores aqui na escola.
> 
> Pode ficar tranquilo que, se precisar tirar uma dúvida mais específica ou quiser dar o próximo passo na sua matrícula, eu consigo conectar você diretamente com um dos nossos consultores humanos para conversar.
> 
> Como você se chama? Se quiser, posso te passar todos os detalhes da nossa próxima turma de APH para você conhecer.

`tools:` — (nenhuma)
<sub>execução n8n #1576</sub>

**Thiago:**
> Thiago essa turma de agosto eu não consigo, tô escalado nos fins de semana de agosto inteiro tem outra turma depois? setembro, outubro?

**MAG:**
> Entendi, Thiago. Como nossas turmas de APH têm uma carga horária intensa e foco total em prática, a agenda costuma seguir um cronograma fixo. No momento, a turma aberta é a de agosto.
> 
> Como você já tem experiência na área, imagino que precise de um planejamento antecipado. Por que não fazemos assim: vou verificar se já temos o calendário das próximas turmas (setembro/outubro) para te passar, ou se consigo te conectar com alguém da coordenação para ver se existe alguma flexibilidade ou reserva de vaga para você?
> 
> Como prefere seguir? Ah, e qual o seu sobrenome, para eu deixar seu cadastro certinho aqui?

`tools:` `listar_cursos({})` · `detalhes_curso({"slug": "socorrista-aph"})`
<sub>execução n8n #1579</sub>

**Thiago:**
> Nunes então me passa esse calendário das próximas ai que eu me organizo

**MAG:**
> Entendido, Nunes! Já acionei nossa equipe para que eles possam acompanhar o seu interesse e te avisar assim que as próximas turmas forem liberadas.
> 
> Alguém do time vai entrar em contato com você em breve para te dar esse retorno e te ajudar com o seu planejamento. Pode deixar que você será avisado!

`tools:` `listar_cursos({})` · `detalhes_curso({"slug": "socorrista-aph"})` · `escalar_contato({"motivo_esc": "Contato tem interesse em turmas futuras de APH (set/out) e precisa de alinhamento com a coordenação.", "numero_esc": "5500900000003"})` · `avisar_equipe({"mensagem": "O contato 5500900000003 (Nunes) tem interesse em turmas futuras de APH (setembro/outubro) e precisa de alinhamento com a coordenação. Pode entrar em contato?"})`
<sub>execução n8n #1581</sub>


### Transcrição — Juliana (`5500900000004`)

**Juliana:**
> oi! sou técnica de enfermagem e queria fazer o aph de vcs só que achei um em nova iguaçu por 450 com 100h, o de vcs é 650 né? por que a diferença?

**MAG:**
> Oi! Tudo bem? Compreendo sua dúvida. 
> 
> A diferença de carga horária e proposta de ensino impacta diretamente na prática. Aqui na Magma, focamos em uma formação de 120h com carga horária 100% presencial e prática exaustiva: você treina desde o primeiro dia com manequins de adulto, criança e bebê, uso de DEA de treinamento real, imobilização com prancha e colares, além de simulações de cenários de emergência como na vida real.
> 
> O valor para a nossa turma é R$ 650,00 e garantimos o aprendizado com instrutores que são enfermeiros do Coren-RJ. Nosso objetivo é que você saia com a segurança técnica exigida para atuar em ambulâncias e eventos. 
> 
> Como você já é técnica de enfermagem, esse curso vai te dar a prática clínica que a teoria da faculdade às vezes não cobre no dia a dia da emergência. Restam 14 vagas para a próxima turma. Como você se chama?

`tools:` `listar_cursos({})` · `detalhes_curso({"slug": "socorrista-aph"})`
<sub>execução n8n #1584</sub>

**Juliana:**
> e as formas de pagamento? consigo parcelar no cartão? tem desconto no pix? e se eu levar uma amiga junto, rola desconto pras duas?

**MAG:**
> Juliana, que prazer falar com você! Sim, temos condições especiais para pagamentos à vista no PIX e você consegue parcelar o curso no cartão de crédito.
> 
> Sobre levar uma amiga, é uma excelente ideia — a prática em dupla é fundamental no APH. Temos condições especiais para grupos, então vou acionar nossa equipe agora mesmo para que eles entrem em contato com você e verifiquem a melhor condição para vocês duas.
> 
> Pode deixar que logo alguém da nossa equipe te chama para alinhar tudo! 🤝

`tools:` `listar_cursos({})` · `detalhes_curso({"slug": "socorrista-aph"})` · `registrar_lead({"curso_slug": "socorrista-aph", "nome": "Juliana"})` · `escalar_contato({"motivo_esc": "Juliana quer saber de desconto para grupo (ela + amiga) e condições de pagamento detalhadas para o curso de APH.", "numero_esc": "5500900000004"})` · `avisar_equipe({"mensagem": "O contato 5500900000004 (Juliana) tem interesse no curso de APH e quer saber sobre descontos para grupo (ela + amiga) e condições de parcelamento. Precisa de retorno humano."})`
<sub>execução n8n #1590</sub>


### Transcrição — Marcos (`5500900000005`)

**Marcos:**
> boa noite eu mandei mensagem pra vcs semana passada perguntando do curso e ninguem me respondeu, achei bem ruim isso viu

**MAG:**
> Olá! Peço sinceras desculpas por essa falha no nosso atendimento; sinto muito mesmo por você ter ficado sem resposta.
> 
> Já direcionei sua reclamação para a nossa equipe de gestão e alguém entrará em contato com você o quanto antes para te dar a devida atenção. 😔

`tools:` `escalar_contato({"motivo_esc": "Reclamação de demora no atendimento", "numero_esc": "5500900000005"})` · `avisar_equipe({"mensagem": "O contato 5500900000005 está registrando uma reclamação de demora no atendimento da semana passada. Por favor, entre em contato com ele para resolver."})`
<sub>execução n8n #1593</sub>

**Marcos:**
> tá mas e o curso? quanto custa e quando começa? é isso que eu quero saber

**MAG:** *(silêncio — contato marcado como escalado; o fluxo para antes do agente)*


### Transcrição — Bianca (`5500900000006`)

**Bianca:**
> oi! me falaram do curso de socorrista de vcs eu já decidi que quero fazer, só me diz quando começa e quanto é

**MAG:**
> Que bacana saber do seu interesse no Socorrista APH! Essa é a nossa formação principal, com 120 horas de carga horária e muito foco na prática, para você sair preparado para o mercado.
> 
> A próxima turma (código 026) começa no dia 08/08/2026. As aulas acontecem aos sábados e domingos, das 09h às 16h, aqui na nossa unidade em Olinda, Nilópolis. No momento, ainda temos 14 vagas disponíveis.
> 
> O valor do curso é R$ 650,00 (podendo ser pago à vista ou conforme as opções de parcelamento que a nossa equipe pode te explicar melhor).
> 
> Para eu poder te atender melhor, como você se chama? 😊

`tools:` `listar_cursos({})` · `detalhes_curso({"slug": "socorrista-aph"})`
<sub>execução n8n #1597</sub>

**Bianca:**
> Bianca quero garantir minha vaga, como faço pra pagar?

**MAG:**
> Perfeito, Bianca! Fico muito feliz em saber que você quer garantir sua vaga.
> 
> Como esse é o passo final para sua matrícula, já acionei nossa equipe e um dos nossos consultores entrará em contato com você em breve pelo WhatsApp para te passar todos os detalhes do pagamento e finalizar sua inscrição. Pode deixar que eles já estão a caminho! 😊

`tools:` `escalar_contato({"numero_esc": "5500900000006", "motivo_esc": "Bianca quer garantir vaga no curso de Socorrista (APH) e deseja saber como realizar o pagamento."})` · `avisar_equipe({"mensagem": "A Bianca (5500900000006) deseja se matricular no curso de Socorrista e quer saber como realizar o pagamento. Por favor, entre em contato com ela."})`
<sub>execução n8n #1599</sub>

