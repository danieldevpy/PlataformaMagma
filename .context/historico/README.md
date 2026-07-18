# Histórico de prompts e sessões

Memória narrativa do projeto: **1 arquivo por sessão significativa**, nome
`AAAA-MM-DD-slug.md`. É o que permite a qualquer agente (ou ao Daniel daqui a meses)
saber de onde o projeto veio, o que foi pedido e onde cada sessão parou.

## Formato de cada entrada

```markdown
# AAAA-MM-DD — Título curto

## Prompt do Daniel (essência)
> citação ou resumo fiel do pedido

## O que foi feito
- ...

## Estado ao sair / handoff
- o que ficou pendente, onde retomar
```

## Regras

- Escrever a entrada **no fim da sessão**, junto com a atualização de `../status.md`.
- Sessões de execução longa por frente (ex.: subsistema 09) mantêm seu log detalhado no
  `docs/subsistemas/NN-execucao-status.md`; aqui entra o resumo e o link.
- Nunca reescrever entradas antigas (histórico é imutável; correções viram entrada nova).
