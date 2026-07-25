# 2026-07-24/25 (madrugada) — Spec 023: correções da SDR a partir de conversa real

## O que o Daniel pediu

Depois de testar a MAG pelo WhatsApp de verdade:

> "certo, funcionou muito bem, quero que você faça uma analise nessa ultima
> conversa simulada!"

E, lendo a análise:

> "quero que você conserte esses problemas, e tem uma outra questão, nessa
> parte da conversa (...) 'prefere ver outras datas' acredito que não
> precisava ser citado, já que não tem nem outras datas, o que você acha
> sobre isso?"

> "e também 'já registrei seu interesse no sistema' tem gente que já imagina
> que vai começar a ser perturbada, acredito que o 'cliente' não precisa
> saber que ele é um lead kk, apenas uma mensagem que mostra que entendeu o
> interesse dele no curso já bastava"

## Por que essa sessão importa

É a **primeira spec nascida de uma análise de conversa** — exatamente o que
a spec 021 foi criada pra viabilizar, testado no dia seguinte à entrega. Os
5 problemas estavam espalhados por 5 execuções do n8n que terminaram todas
em "sucesso"; nenhum apareceria olhando execução por execução.

Dois dos cinco foram achados pelo **Daniel** lendo a transcrição — os dois
de qualidade de venda, que são justamente os que nenhuma métrica técnica
pegaria.

## Os 5 problemas e as correções

| # | Problema | Corrigido onde |
|---|---|---|
| 1 🔴 | Prometeu consultor humano e **não chamou** (`escalar_contato`/`avisar_equipe` não foram chamadas). Intermitente. | Prompt: regra que amarra a promessa à ação + gatilhos ampliados |
| 2 🔴 | 2 `Lead` pro mesmo número | Backend: dedup por `whatsapp` |
| 3 🟠 | Lead sem curso | Backend: `resolver_curso()` por semelhança |
| 4 🟠 | "ou prefere ver outras datas?" sem existir outra data (Daniel) | Prompt: nunca oferecer opção não confirmada |
| 5 🟠 | "já registrei seu interesse no sistema" (Daniel) | Prompt: nunca narrar operação interna |

## O achado que mudou o diagnóstico

O problema 3 parecia de prompt. Reforcei a regra no system prompt: não
resolveu. Descobri que o campo `curso_slug` da tool **não tinha descrição
nenhuma** (`{"name": "curso_slug"}`) e adicionei uma bem explícita: **também
não resolveu**.

Aí fui olhar o que a tool realmente enviava, via os `ferramentas` gravados
pela spec 021 — e a MAG **nunca acertou o slug**:

```
23:21:10 -> {"curso_slug": "aph-120h", "nome": "Daniel"}
23:23:17 -> {"curso_slug": "socorrista-aph-120h", "nome": "Daniel"}
23:26:01 -> {"curso_slug": "aph-120h", "nome": "Daniel"}
```

O slug real é `socorrista-aph`, e estava no contexto (veio de
`detalhes_curso`). O modelo montava o identificador a partir do **nome
exibido** ("Socorrista APH (120h)"). E o backend engolia calado:
`Curso.objects.filter(slug=...).first()` → `None` → lead sem curso, sem
aviso nenhum.

Correção real: `resolver_curso()` em `apps/leads/serializers.py` — match
exato, senão pontuação por sobreposição de termos contra slug+nome de cada
curso, exigindo vencedor único (empate → `None`, porque lead com o curso
ERRADO é pior que lead sem curso), com `logger.warning` nos dois caminhos.
Os 3 slugs inventados de verdade viraram caso de teste.

**Princípio que fica**: identificador técnico exato é o tipo de dado que
LLM erra — ela acerta o assunto e erra a string. Toda tool que receber
identificador gerado pelo modelo resolve com tolerância no backend e
**registra quando teve que corrigir**; nunca falha calado.

## Testes reais

- **Handoff 3×3**: três formulações diferentes de fechamento ("estou
  interessado nessa turma mesmo", "é essa mesmo que eu quero", "quero
  garantir minha vaga"), nenhuma entre os gatilhos literais antigos,
  limpando memória e `ContatoEscalado` entre rodadas. Todas escalaram.
- **Lead**: 1 registro, `curso='socorrista-aph'`.
- **Transcrição**: fechamento virou "quer garantir sua vaga nessa turma que
  começa dia 08/08?" e o pedido de nome virou "Como você se chama? 😊".

Suíte 289/289 (era 278).

## Erro meu, registrado pra não repetir

Editei o `import unicodedata` num passo separado da função que o usa. O
`runserver` do Daniel recarregou no estado intermediário e o endpoint ficou
respondendo `NameError` — **enquanto a suíte passava**, porque o teste
importa o módulo do zero e o servidor tinha a versão velha em memória.
Gastei uma rodada de teste real achando que era lógica.

Lição: teste verde não garante que o processo em execução está com o código
novo. Quando o teste real diverge do automatizado, bater o endpoint direto
(`curl`) antes de duvidar da lógica.

O T6 também precisou de duas passadas: a primeira versão da regra só cobria
o passado ("registrei") e o modelo achou a brecha do futuro ("assim consigo
registrar seu interesse"). Regra proibitiva precisa nomear as variações,
não só o exemplo.

## Aberto pra decisão do Daniel

Nas 3 rodadas de handoff, a MAG escalou **sem registrar o lead** — o
contato não tinha dito o nome, e a regra de handoff manda parar de
qualificar. Resultado: o lead mais quente possível fica só em
`ContatoEscalado` + `Conversa`, **fora da tabela de leads** — some do Radar
e da Nutridora. Não mexi porque é decisão de produto (o humano assumiu o
atendimento), mas precisa de escolha consciente.

## Estado ao sair

Tudo em dev. Specs 021, 022 e 023 prontas e **pendentes de promoção
conjunta** pra produção (as três mexem no mesmo `mag-fase-0-sdr.json` — um
restart só do n8n de prod cobre as três).

Resíduo de teste em dev: leads `#22`/`#23` (duplicados que originaram a
spec) e `#28`, conversas de teste em `apps/conversas`, e o
`ContatoEscalado` do número de teste.
