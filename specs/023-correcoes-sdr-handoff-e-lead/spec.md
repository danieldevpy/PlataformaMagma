# Spec 023 — Correções da SDR: handoff, lead duplicado e promessa vazia

> Primeira spec nascida **de uma análise de conversa real** — o que a spec
> 021 (registro de conversas) foi criada pra viabilizar. Os quatro
> problemas abaixo saíram de uma única conversa de teste do Daniel
> (24/07, 5 trocas, 3 minutos), e nenhum deles apareceria olhando as
> execuções do n8n uma a uma: cada execução terminou em "sucesso".

## Problema / oportunidade

A MAG vende bem e não inventa dado (preço, vagas e datas vieram todos de
`detalhes_curso`). Mas a conversa analisada morreu exatamente no
fechamento, e a base de leads saiu suja:

1. **🔴 Prometeu humano e não chamou ninguém.** Última mensagem ao lead:
   *"preciso te passar para um consultor... Vou chamar alguém agora
   mesmo"*. Ferramentas realmente chamadas: só `registrar_lead`. Nem
   `escalar_contato`, nem `avisar_equipe`. Resultado: ninguém da equipe
   avisado, lead esperando um retorno que não foi acionado, e a MAG
   **não silenciada** — segue respondendo como se nada tivesse
   prometido. **É intermitente**: no teste das 19:17 do mesmo dia, a
   mesma intenção disparou as duas tools corretamente. O prompt já tem a
   regra de handoff; ela lista gatilhos literais ("quero pagar", "como
   faço pra me matricular") e o lead disse *"estou interessado nessa
   turma mesmo"* — a IA entendeu que era hora de passar pra um humano
   (falou isso em texto!) mas não executou.
2. **🔴 Lead duplicado.** `registrar_lead` foi chamado 2× e criou 2
   `Lead` pro mesmo número (`#22` e `#23`). O prompt **já pede** "uma vez
   só por conversa" e mesmo assim aconteceu — prompt não é garantia. A
   causa raiz está no backend: `LeadPublicoSerializer.create` faz
   `Lead.objects.create` puro, sem nenhuma checagem.
3. **🟠 Lead sem curso.** Os dois registros saíram com `curso=None`
   mesmo com a conversa inteira sendo sobre o APH — a IA não passou
   `curso_slug`. Isso degrada a Nutridora T+1 (spec 020), que monta a
   mensagem com as habilidades reais do curso do lead.
4. **🟠 Pergunta que fabrica objeção.** *"você já tem planos de começar
   nessa próxima turma de agosto ou prefere ver outras datas?"* — não
   existem outras datas. A própria MAG abriu uma saída que desmonta a
   escassez que ela tinha acabado de criar ("as vagas acabam rápido"), e
   o lead pegou a deixa: a mensagem seguinte dele foi *"quais as outras
   datas?"*. Custou 2 trocas e diluiu a urgência, por uma opção
   inexistente. **Achado do Daniel** ao ler a análise.
5. **🟠 Narrou a engrenagem pro cliente.** *"Já registrei seu interesse
   aqui no nosso sistema"* — vocabulário de CRM na cara do lead. Nas
   palavras do Daniel: *"tem gente que já imagina que vai começar a ser
   perturbada; o 'cliente' não precisa saber que ele é um lead — apenas
   uma mensagem que mostra que entendeu o interesse dele no curso já
   bastava"*. Registrar é engrenagem interna; o que a pessoa tem que
   sentir é acolhimento. Mesma família dos itens 1 e 4: o agente falando
   de mecanismo em vez de conversar.

Com a campanha de tráfego pago (spec 018) prestes a trazer leads reais,
os problemas 1 e 2 são perda de venda e base suja em escala.

## O que muda para o usuário

- Quando a MAG disser que vai chamar alguém, **alguém é chamado de
  verdade** — e ela para de responder aquele contato até a equipe
  liberar.
- Um mesmo WhatsApp deixa de virar vários leads: a segunda mensagem
  atualiza o lead que já existe, em vez de criar outro.
- O lead nasce com o curso certo, então a régua da Nutridora consegue
  falar do curso que a pessoa quis.
- A MAG para de oferecer alternativa que não existe — a pergunta de
  fechamento aponta pra venda, não pra uma saída inventada.

## Critérios de aceite

- [ ] **Backend (defesa em profundidade)**: `LeadPublicoSerializer.create`
      busca-ou-atualiza por `whatsapp` em vez de sempre criar. Atualiza
      só os campos que vieram preenchidos (nunca apaga dado que já
      existia) e **nunca deduplica quando `whatsapp` está em branco**
      (senão todo lead sem número colapsaria num só).
- [ ] Preserva `criado_em` e `nutridora_ultimo_toque` do lead original —
      reencontrar um lead não pode reiniciar a régua nem bagunçar a
      contagem de "leads das últimas 24h" do Radar.
- [ ] Testes cobrindo: 2 chamadas com o mesmo WhatsApp = 1 lead;
      campo vazio na 2ª chamada não apaga o valor da 1ª; dois leads sem
      WhatsApp continuam sendo dois leads distintos; `criado_em` intacto.
- [ ] **Prompt do SDR** ganha quatro regras:
      (a) se você disser ao contato que vai chamar/passar pra alguém da
      equipe, as tools `escalar_contato` + `avisar_equipe` são
      **obrigatórias no mesmo turno** — prometer sem chamar é o pior erro
      possível; e o gatilho de handoff passa a incluir intenção clara de
      fechar em qualquer formulação ("quero essa turma", "é essa mesmo"),
      não só as frases literais de hoje;
      (b) ao registrar o lead, **sempre** mandar `curso_slug` quando o
      curso já foi identificado na conversa;
      (c) **nunca oferecer opção que você não confirmou que existe** — se
      só há uma turma aberta, a pergunta de fechamento aponta pra ela;
      (d) não repetir `listar_cursos`/`detalhes_curso` do mesmo curso já
      consultado na conversa (custo de token à toa);
      (e) **nunca narrar operação interna** ("registrei no sistema",
      "cadastrei", "salvei seus dados", nome de ferramenta) — o registro
      é invisível pro contato; responder acolhendo o interesse dele. A
      **única** exceção é o handoff: aí o contato precisa saber que
      alguém da equipe vai falar com ele, porque isso é promessa feita a
      ele, não mecânica interna.
- [ ] **Teste real repetido 3×** do mesmo roteiro de fechamento — a falha
      é intermitente, então uma passada não prova nada. Em todas: o
      contato termina em `ContatoEscalado`, a conversa com
      `desfecho=handoff` e `escalada=True`.
- [ ] Teste real confirmando lead único e com curso preenchido.
- [ ] Suíte completa verde.

## Critério de aceite do gestor

O Daniel conversa com a MAG até dizer que quer a turma, e: recebe no
WhatsApp o aviso de handoff, a MAG para de responder aquele número, e no
Admin existe **um** lead — com o curso certo.

## Fora de escopo

- Tornar o handoff determinístico no workflow (um nó que detecta a
  promessa no texto e força as tools, sem depender do LLM). É o plano B
  se o ajuste de prompt não segurar depois dos 3 testes — fica
  registrado, não implementado agora.
- Deduplicar os leads que já existem no banco (`#22`/`#23` em dev são
  resíduo de teste). Fica como limpeza manual, não migração.
- Mudar o comportamento do formulário da LP além do efeito colateral
  (bem-vindo) do dedup: quem preenche o site duas vezes também para de
  virar dois leads.
- Reescrever a persona/tom da MAG. As correções são cirúrgicas; o que
  ela já faz bem (não inventar dado, qualificar, criar urgência real)
  não se mexe.
