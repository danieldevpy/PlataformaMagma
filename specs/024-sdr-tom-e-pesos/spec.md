# Spec 024 — A MAG conversa melhor: pesos de tom, escassez e curiosidade

> Segunda spec nascida de análise de conversa (a primeira foi a 023). Base:
> a bateria de 6 conversas simuladas de 25/07 —
> `.context/historico/2026-07-25-simulacoes-sdr-6-perfis.md`.
>
> **Princípio que o Daniel deu junto com a aprovação, e que manda nesta
> spec:** *"quanto mais regra colocamos, mais engessados deixamos... apenas
> mexa alguns pesos, porque na grande maioria do tempo ele foi cirúrgico"*.
> Aqui **não se acrescenta regra nova sem tirar outra** — o alvo é mudar o
> peso do que já existe, não empilhar restrição.

## Problema / oportunidade

Nas 6 conversas simuladas a MAG não errou dado nenhum (preço, data, vagas,
endereço, certificado, instrutor: tudo conferido contra a API, tudo certo)
e não inventou curso. O que ela erra é **peso de conversa**: fala do que
ninguém perguntou, mede escassez que não existe, e despeja ficha técnica
onde cabia curiosidade.

1. **🟠 Escassez irrelevante, cedo demais.** Logo na primeira resposta:
   *"Temos apenas 14 vagas disponíveis"*. São 14 de 15 — a turma está
   praticamente **vazia**. Leitura do Daniel: *"isso representa 70% da
   turma de forma irônica, e torna irrelevante para o usuário; eu mesmo
   acharia até chato"*. Escassez só é argumento quando é escassez de
   verdade. Hoje a MAG dispara o número sempre que ele existe, porque a
   regra 3 do prompt manda "criar senso de urgência legítimo com dado
   real" e ela lê 14 como dado real — e é, mas não é urgência.

2. **🟠 Ficha técnica no lugar de convite.** Pra Sandra (mãe perguntando
   pelo filho), a MAG respondeu com *"turma com início em 08 de agosto,
   sábados e domingos das 09h às 16h, restam 14 vagas"* — sem ninguém ter
   perguntado data nem horário. Daniel: *"eu poderia até sugerir 'gostaria
   de conhecer melhor esse curso? acredito que seu filho iria gostar' e aí
   a pessoa querer saber mais que o normal"*. A informação existe pra ser
   entregue **quando puxada**, não despejada de largada.

3. **🟠 Curso que não existe fecha a porta em vez de abrir outra.** Thiago
   pediu resgate veicular com desencarceramento. A MAG negou corretamente
   (ótimo) mas ofereceu **só o APH**: *"Hoje nós somos especialistas em
   APH, com foco no Socorrista APH 120h"*. Daniel: *"se for pra falar de
   cursos, por que não citou todos? mesmo não tendo turma, tem outros
   cursos que poderiam ser citados — obviamente o APH continuaria como
   carro-chefe"*. Ela **já tinha** `listar_cursos` na mão com BLS,
   Primeiros Socorros (Lei Lucas) e Punção Venosa — três cursos que
   conversam direto com um bombeiro civil.

4. **🟠 A regra de "não narrar cadastro" vazou de novo.** A spec 023
   proibiu "registrei/cadastrei/salvei/vou registrar". O modelo achou a
   variação: *"qual o seu sobrenome, **para eu deixar seu cadastro
   certinho aqui**?"* (Thiago). E versões mais leves em todas as outras:
   "assim posso te dar mais detalhes", "para eu te passar os detalhes
   certinhos", "para eu poder te atender melhor". Confirma a lição da
   própria 023: **regra proibitiva por lista de exemplos vaza** — o modelo
   contorna com sinônimo.

5. **🟠 Prometeu apuração que nenhuma tool sustenta.** *"vou verificar se
   já temos o calendário das próximas turmas (setembro/outubro) pra te
   passar"* — não existe tool que responda isso. Efeito prático: o lead
   pegou a deixa (*"então me passa esse calendário aí que eu me organizo"*)
   e a venda de agosto morreu ali. É o primo do problema 4 da spec 023:
   lá era **opção** inexistente, aqui é **promessa de apuração**.

6. **🟠 Rechamou tool já usada, até 4× na mesma conversa.** Thiago:
   `listar_cursos` 4×, `detalhes_curso` 3×, sempre o mesmo curso, e no
   último turno nem usou o resultado. A regra 8 do prompt já proíbe.
   Suspeita de causa real: `contextWindowLength: 10` na memória Redis —
   o resultado sai da janela e o modelo "esquece" que já consultou.

7. **🟡 O nome que o WhatsApp já entrega é jogado fora.** A Evolution manda
   `pushName` em todo payload. `Extrair dados` captura, `Consolidar
   mensagens` carrega — e `Preparar contexto SDR` **sobrescreve** com o
   nome vindo do `identificar_contato`, vazio pra desconhecido. Resultado:
   a MAG gasta um turno perguntando o nome de quem já se identificou, em 5
   das 6 conversas. E quando pediu o **sobrenome** separado (item 4), passou
   a chamar o contato de *"Nunes"*.

8. **🟡 Muro de texto.** As respostas foram de 163 a 1.135 caracteres, sem
   nenhum teto. A da Sandra teve 4 parágrafos com a pergunta do nome **no
   meio** e mais informação depois dela.

### O que NÃO muda (confirmado pelo Daniel)

- **Objeção de preço continua escalando.** Eu tinha classificado a escalada
  do Rafael (*"650 tá salgado pra mim mano"*) como falso positivo. O Daniel
  corrigiu: *"é muito importante que o gestor tome a frente quando o
  cliente não aceita o preço sugerido pela empresa"*. **Está certo como
  está** — a distinção que entra aqui é fina: *pergunta neutra* sobre
  formas de pagamento a MAG responde pelo FAQ; *resistência ao preço*
  (achou caro, pede desconto, pede condição especial) vai pro humano.
- **Não existe um tom único.** *"cada resposta funciona para tipos
  diferentes de pessoas"* — nada aqui tenta padronizar voz. Os ajustes são
  de **quando** falar cada coisa, não de como soar.

## O que muda para o usuário

- Deixa de ouvir "restam 14 vagas" quando a turma está cheia de vaga — o
  número só aparece quando aperta de verdade.
- Recebe convite antes de ficha técnica: primeiro o motivo pra querer,
  depois data/horário/preço, quando ele puxar.
- Se pedir um curso que não existe, sai da conversa sabendo **os quatro**
  cursos que existem, com o APH em destaque — não com uma porta fechada.
- Não é mais chamado pelo sobrenome nem perguntado o nome que ele já
  colocou no perfil do WhatsApp.
- Lê mensagens de tamanho de WhatsApp, com uma pergunta por vez.

## Critérios de aceite

- [ ] **Escassez com limiar.** Com `vagas_restantes > 3`, a MAG **não cita
      o número de vagas** em nenhuma mensagem. Com `≤ 3`, cita. Verificado
      nos dois cenários (mexendo `vagas_restantes` da turma em dev).
- [ ] **Convite antes de ficha.** Na primeira resposta a um contato que só
      demonstrou interesse genérico ("vi a propaganda", "quero saber do
      curso"), a MAG **não** entrega data + horário + preço + vagas de uma
      vez; ela responde o que foi perguntado e convida a conhecer.
- [ ] **Curso inexistente abre leque.** Pedido de curso fora da grade →
      resposta nega o pedido **e cita os outros cursos reais** vindos de
      `listar_cursos`, com o APH posicionado como carro-chefe.
- [ ] **Nome sem pretexto.** Em 5 conversas de teste, nenhuma menção a
      cadastro/registro/"pra te atender melhor" ao pedir o nome. E a MAG
      **não pede sobrenome**.
- [ ] **`pushName` aproveitado.** Contato novo cujo perfil do WhatsApp tem
      nome → a MAG já o chama pelo nome, sem gastar turno perguntando.
- [ ] **Sem promessa de apuração.** Pergunta sobre turma futura →
      a MAG diz que a turma aberta é a de agosto e **não promete verificar
      calendário**; se o contato insistir, aí sim é caso de humano.
- [ ] **Tool não repetida.** Numa conversa de 5+ turnos sobre o mesmo
      curso, `detalhes_curso` é chamada no máximo 1× (2× tolerável se o
      contato mudar de curso e voltar).
- [ ] **Teto de tamanho.** Nenhuma resposta acima de ~600 caracteres nas
      conversas de teste; no máximo uma pergunta por mensagem.
- [ ] Suíte completa continua verde.

## Critério de aceite do gestor

Não toca painel. O teste é conversar pelo WhatsApp e **não sentir vontade
de pular parágrafo** — nas palavras do Daniel, "o foco tem que ser em
instruir e cativar o interesse de forma criativa".
