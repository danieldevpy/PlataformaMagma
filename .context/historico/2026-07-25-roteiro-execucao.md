# 2026-07-25 — Análise de estado, T20 decidida e roteiro de execução

## Prompts do Daniel

1. *"esse foi o último prompt, quero que você analise sugira onde devemos começar"*
   (colando o handoff da sessão anterior, que terminava oferecendo duas
   opções: a spec 028 Onda 1 ou a 027-T3/T4).
2. *"me resuma o que foi feito até agora"*
3. *"então vamos resolver a questão da t20 colocar o que tem que colocar
   logo em produção, desenvolver o que falta, investigar o travamento e
   logo em seguida continuar a questão do pixel, sobre a cobrança real do
   assas já está tudo certo em produção. então caso não esteja
   documentado, o faça, para que eu siga sequencialmente essas etapas!"*

## O que foi feito

**Sessão de análise e documentação — nenhum arquivo de código alterado.**

Li `status.md`, as duas specs candidatas (027 e 028) e o código do
`processar_nutridora` antes de responder.

### Achado 1 — a T20 é maior do que estava registrada

A spec 028 tinha registrado que `processar_nutridora` exclui
`utm_source="whatsapp"` e propunha uma exceção estreita. Conferindo o
código, o buraco é de outra ordem:

- `apps/leads/acoes.py:146-148` exclui `utm_source="whatsapp"`
  permanentemente;
- o `registrar_lead` do SDR carimba `utm_source: "whatsapp"` como
  `valueProvider: fieldValue` no próprio workflow
  (`mag-fase-0-sdr.json`, nó `tool-registrar-lead`) — **não é a IA que
  escolhe, é valor fixo**.

Logo: **todo** lead nascido de conversa com a MAG fica fora da régua
T+1/3/7, para sempre — não só o caso da spec 028. E a campanha do Meta é
**Click-to-WhatsApp**, então 100% do lead pago cairia nessa faixa. A
Nutridora T+1/3/7 está ativa em produção desde 24/07 nutrindo, na prática,
só lead de formulário.

### Achado 2 — nada disso está versionado

`git log` para em `b90fc95` (24/07). Depois dele: specs 021, 022, 023,
024, 025, as blindagens da 027 e o pixel da 018 (T1–T4) — 2.207 linhas em
26 arquivos modificados + 26 caminhos não rastreados, incluindo o
`apps/conversas/` inteiro e as migrações. Enquanto isso a produção roda o
SDR de antes da 023/024/025: quem é escalado **não vira lead**, fica
silenciado até liberação manual e some do Radar e da Nutridora.

Recomendei promover antes de construir. O Daniel concordou com a ordem
geral e a fixou.

### Decisão dele — T20: atividade, não origem

Ofereci três formas (atividade / exceção estreita / remover a exclusão) e
ele escolheu **trocar origem por atividade**: a exclusão por `utm_source`
sai e entra a exclusão de quem teve conversa nos últimos
`ConfiguracaoSite.nutridora_silencio_dias` (padrão proposto: 2), lida de
`apps.conversas`. A regra antiga usava origem como proxy de atividade — e
origem não muda nunca. Só é possível agora porque a spec 021 criou
`Conversa.ultima_atividade_em`, com o índice
`("numero", "-ultima_atividade_em")` já pronto.

### Correção de registro — Asaas

O Daniel informou que **a cobrança real do Asaas já está configurada em
produção**. O `status.md` afirmava o contrário desde 23/07 e isso vinha
sendo repetido em cada resumo. Corrigido nos três pontos onde aparecia.
*Não verificado a partir da máquina de dev* — registrado como informação
dele.

## Arquivos criados/alterados

- `.context/roteiro.md` — **novo**. As 5 etapas na ordem dele, cada uma
  com tarefas, o que trava, e definição de pronto.
- `.context/index.md` — ponteiro pro roteiro em "onde vive cada verdade".
- `.context/decisoes.md` — 3 ADRs: a T20, a ordem de execução, e o Asaas.
- `.context/status.md` — data, entrada desta sessão, e as 3 correções do
  Asaas.
- `specs/028-lead-quente-ate-a-matricula/tasks.md` — seção da T20 reescrita
  com o achado do valor fixo no workflow e a decisão; a tarefa saiu da
  spec e virou a etapa 1 do roteiro.

## Etapa 1 executada na mesma sessão

Prompt do Daniel: *"comece a etapa 1"*.

**Entregue em dev:**

- `ConfiguracaoSite.nutridora_silencio_dias`, padrão **2** — migração
  `nucleo/0008`, aplicada em dev.
- `Conversa.numeros_ativos_desde(dias)` — contrapartida explícita de
  `ContatoEscalado.numeros_ativos()`: um exclui quem o humano assumiu, o
  outro exclui quem a MAG está atendendo agora. `dias=0` devolve conjunto
  vazio (o Admin desligou a checagem).
- `processar_nutridora`: saiu `.exclude(utm_source="whatsapp")`, entrou
  `.exclude(whatsapp__in=numeros_em_conversa)`.
- `docs/plataforma/03-api-contratos.md` atualizado.

**Testes:** 300 → 304. O teste
`test_exclui_lead_nascido_de_conversa_whatsapp`, que afirmava o
comportamento antigo, foi **substituído** (não só removido) por cinco:
lead de WhatsApp sem conversa recente entra; quem falou agora não entra;
conversa mais velha que o silêncio não exclui; silêncio 0 desliga a
checagem; conversa de outro número não exclui.

**Verificação com dado real de dev** (além da suíte): os **12 leads do
banco têm `utm_source="whatsapp"`** — a régua antiga nutriria **zero**,
o que dimensiona o furo melhor do que qualquer teste sintético. Rodando a
ação de verdade com o lead #32 retro-datado em 3 dias: sem conversa
recente **entra na régua** (texto T+1 com as habilidades reais do
Socorrista APH); criando uma `Conversa` de agora pro mesmo número, **não
entra**. `criado_em`, `nutridora_ultimo_toque` e a `Conversa` de teste
foram restaurados/apagados ao fim.

**O que NÃO foi re-exercitado:** a camada HTTP (`/api/acoes/executar/`,
auth por `TokenAgente` e escopo). A ação foi chamada direto no shell
porque essa camada não foi tocada por esta mudança — nenhum parâmetro,
escopo ou formato de resposta mudou.

## Estado ao sair

Etapa 1 feita em dev; nada commitado. O working tree continua com as 5
specs não versionadas **mais a T20** — **este é o risco número um do
projeto agora** (a sessão anterior já perdeu o harness de simulação num
diretório temporário).

A ordem combinada:

1. ~~**T20** — Nutridora por atividade.~~ **Feita em dev (25/07).**
2. **Produção** — commitar e promover 021→025 + blindagens da 027 + T20.
3. **Desenvolver o que falta** — spec 026 (bloqueada em 2 decisões dele),
   depois a 028 pela Onda 1.
4. **Investigar o travamento** — spec 027, T1 sob carga concorrente.
5. **Pixel e campanha** — 018-T5 (só ele consegue) e o Meta Ads.

**Dependência que não pode ser esquecida:** a T20 não funciona sozinha em
produção — sem `apps.conversas` (spec 021) o filtro novo não excluiria
ninguém e todo lead de WhatsApp receberia toque, inclusive quem está no
meio de uma conversa. Ela viaja junto com a 021, na etapa 2.

**Ponto em aberto na etapa 1:** a janela de silêncio — 2 dias (proposto)
ou 1. Com 2, o lead de WhatsApp recebe o T+1 no 2º dia de silêncio em vez
do dia seguinte ao cadastro.
