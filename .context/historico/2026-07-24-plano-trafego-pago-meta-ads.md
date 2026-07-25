# 2026-07-24 — Plano de tráfego pago (Meta Ads) refeito e documentado

## Prompt do Daniel

Trouxe um guia (`~/Downloads/magma_meta_ads_guide.md`) gerado pela Manus (já
tinha assinatura) sobre estratégia de Meta Ads pra captação de alunos, e
pediu análise cruzando com o que já está documentado no projeto. Depois de
ouvir a análise, pediu pra refatorar o plano e documentar: **só aquisição**
(nada de retenção/reativação de alunos antigos por agora), orçamento **teto
R$1.000** (reinveste conforme captar), e que qualquer implementação nova
proposta fosse realista pro sistema atual.

## Estado ao entrar

Nenhum plano de tráfego pago documentado no projeto. `01-vitrine-captacao.md`
já citava "landing pages por campanha, com pixel e rastreamento de conversão"
como capacidade futura, mas sem nenhum detalhe de como. Confirmado por busca
no código: **nenhum Meta Pixel/GTM instalado** no frontend; `Lead` já captura
`utm_source`/`utm_campaign`/`pagina_origem` (backend e `LeadForm`), mas
`WaLinks` (botões diretos de WhatsApp) não passam por lead nenhum.

## Análise do guia da Manus

Acertava a parte de marca (cores/tipografia/formatos batem com
`design-system/AGENTS.md`) e a estrutura genérica de campanha (CBO/ABO,
funil, Advantage+) estava correta como prática de 2026, mas tinha 4
descompassos com a realidade do projeto:
1. Assumia Pixel/Conversions API já instalados (não existem) pra sustentar
   retargeting/lookalike/retenção.
2. Cronograma de escalonamento em 5+ semanas — não cabe nos ~15 dias até
   08/08.
3. Orçamento em USD genérico, sem calibrar pro porte real (escola local,
   1 turma).
4. Não considerava que o funil real da Magma é WhatsApp-first (MAG, specs
   010/013/014) — nem citava o objetivo "Mensagens/Click-to-WhatsApp".

## O que foi feito

**`docs/subsistemas/01b-trafego-pago-meta-ads.md`** — plano refeito,
complementando `01-vitrine-captacao.md` (mesmo padrão de `02b`/`07b`,
"implementação" de uma capacidade já listada no subsistema-mãe). Define:
escopo da fase (só aquisição, teto R$1.000, só Socorrista APH), estrutura de
campanha única (1 campanha, 1 conjunto, objetivo Mensagens — não depende de
pixel, cai direto no MAG), segmentação geográfica (raio ~20km em torno de
Nilópolis/Nova Iguaçu), criativos sugeridos, o que rastrear agora vs. depois,
métricas do ciclo e passo a passo prático pra Daniel colocar no ar.

**`specs/018-rastreamento-trafego-pago/`** (spec.md/plan.md/tasks.md) — spec
pequena e realista pro único pedaço de implementação nova necessário: Pixel
**client-side** (`PageView`+`Contact`+`Lead`) em `app/layout.tsx`, `WaLinks.tsx`
e `LeadForm.tsx`, condicional a uma env pública nova (`NEXT_PUBLIC_META_PIXEL_ID`,
mesmo padrão de `NEXT_PUBLIC_SITE_URL`). Sem Conversions API, sem hashing de
PII, sem novo model no backend — fora de escopo explicitamente, fica pra
quando (e se) o Daniel decidir reinvestir/escalar depois de 08/08. **Ainda
não implementado** — 5 tasks, todas PENDENTE.

**ADR em `.context/decisoes.md`** registrando a decisão (só aquisição, teto
R$1.000, objetivo Mensagens, rastreamento mínimo) pra não precisar
rediscutir. Link adicionado em `01-vitrine-captacao.md` apontando pro `01b` e
pra spec 018.

## Estado ao sair

Só documentação — nenhum código tocado. `docs/subsistemas/01b-...md` é o
plano de referência pra montar a campanha no Ads Manager; `specs/018-.../`
está pronta pra implementar quando o Daniel quiser (independe de a campanha
já estar no ar — o objetivo Mensagens funciona sem pixel). Pendente: decidir
com o Daniel quando lançar a campanha e se implementa o pixel antes ou em
paralelo.
