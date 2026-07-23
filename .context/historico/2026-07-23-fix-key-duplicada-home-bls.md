# 2026-07-23 (cont.) — Fix: key React duplicada na home ao publicar o curso BLS

## Prompt do Daniel

Publicou o curso de BLS (criado na sessão anterior) e recebeu erro no
console: `Encountered two children with the same key, "BLS — Suporte
Básico de Vida"` em `CardCurso` (`components/HomeLP.tsx`).

## Causa raiz

`lib/home-cards.ts` tem uma lista estática `HOME_CARDS` (grid da home
antes de existir API) com um card placeholder de BLS com `slug: "bls"`.
O curso criado na sessão anterior usa o slug real `bls-suporte-basico-de-vida`
(ver `historico/2026-07-23-cursos-a-partir-de-certificados.md`). Como os
slugs não batiam, `mesclarCards()` não conseguia casar o curso publicado
com o card estático — ele entrava como card "extra" (curso não
reconhecido), com o **mesmo `nome`** do card estático ("BLS — Suporte
Básico de Vida"), e a grade usa `key={card.nome}` → duas entradas com a
mesma key.

O mesmo problema estava latente para `puncao-venosa` (estático) vs.
`puncao-venosa-coleta-exames` (real) — só não deu erro ainda porque
aquele curso segue em rascunho.

## Fix

`plataforma/frontend/lib/home-cards.ts`: `slug` dos cards estáticos de
BLS e Punção Venosa (em `HOME_CARDS` e `OPCOES_ESTATICAS`) atualizados
para os slugs reais (`bls-suporte-basico-de-vida`,
`puncao-venosa-coleta-exames`), para que o merge por slug funcione. Não
mexi nos textos/horas do card estático — eles são sobrescritos pelo
`cursoApi` no merge de qualquer forma. Suíte `lib/home-cards.test.ts`
7/7 (não referenciava os slugs antigos).

## Pendente

- Nenhuma migração de schema nem dado tocado — só o mapeamento estático
  do frontend.
- Ao publicar `puncao-venosa-coleta-exames`, o merge agora deve
  funcionar sem duplicar.
