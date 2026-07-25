# Tasks 018 — Rastreamento mínimo para tráfego pago

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | Script base do Pixel em `app/layout.tsx`, condicional a `NEXT_PUBLIC_META_PIXEL_ID` | ENTREGUE | Claude |
| T2 | `.env.local.example` ganha `NEXT_PUBLIC_META_PIXEL_ID=` documentada | ENTREGUE | Claude |
| T3 | Evento `Contact` no clique de `[data-wa]` (`WaLinks.tsx`) | ENTREGUE | Claude |
| T4 | Evento `Lead` no sucesso do POST (`LeadForm.tsx`, só no caminho feliz) | ENTREGUE | Claude |
| T5 | Teste manual: Meta Pixel Helper (extensão Chrome) confirma `PageView` + `Contact` + `Lead` disparando em dev com um Pixel ID de teste | PENDENTE (precisa do Daniel — ver §Log) | |

## Ondas

- Onda 1 (paralelo): T1, T2
- Onda 2 (depende de T1): T3, T4
- Onda 3 (depende de T3/T4): T5

## Log

- (2026-07-24) Spec criada a partir da análise do plano de Meta Ads gerado
  pelo Manus (`magma_meta_ads_guide.md`), refeito em
  `docs/subsistemas/01b-trafego-pago-meta-ads.md`. Escopo reduzido a pixel
  client-side (sem CAPI) pra caber no prazo até 08/08. Ainda não implementado
  — aguardando decisão do Daniel sobre quando lançar a campanha.
- (2026-07-24, continuação) **T1-T4 implementadas.** `app/layout.tsx` injeta
  o script base do Pixel (`next/script`, `strategy="afterInteractive"`) +
  fallback `<noscript>`, só quando `NEXT_PUBLIC_META_PIXEL_ID` está setada;
  `WaLinks.tsx` dispara `fbq('track','Contact')` no clique de qualquer
  `[data-wa]` (listener por link, cleanup no unmount); `LeadForm.tsx` dispara
  `fbq('track','Lead')` só depois do POST em `/api/leads/` responder OK (não
  dispara no fallback de erro, que já abre o WhatsApp direto sem lead
  confirmado). `typecheck`/`lint` limpos. Checado com `specs/021-*`/`022-*`
  (outro agente em paralelo, backend puro) — zero sobreposição de arquivo.
  **T5 não dá pra automatizar**: precisa de um Pixel ID de teste real (Ads
  Manager → Gerenciador de eventos → criar um Pixel, nem que seja
  provisório) + a extensão Meta Pixel Helper no Chrome do Daniel. Passo a
  passo deixado no `historico/` de hoje.
