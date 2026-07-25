# Plan 018 — Rastreamento mínimo para tráfego pago

> O COMO. Referencia os docs em vez de duplicá-los.

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| Front | Script do Pixel no `app/layout.tsx`, carregado só se `NEXT_PUBLIC_META_PIXEL_ID` existir | `docs/plataforma/04-frontend-nextjs.md` |
| Front | Evento `fbq('track', 'Contact')` no clique de `[data-wa]` em `components/client/WaLinks.tsx` | idem |
| Front | Evento `fbq('track', 'Lead')` após sucesso do POST em `components/client/LeadForm.tsx` | idem |
| Config | `NEXT_PUBLIC_META_PIXEL_ID` documentado em `.env.local.example` (vazio por padrão) | - |

## Decisões desta feature

- **Pixel client-side apenas, sem CAPI** — suficiente pro objetivo Mensagens
  da campanha atual (não depende de pixel); CAPI fica pra quando decidirmos
  reinvestir/escalar pós-08/08 (ver `docs/subsistemas/01b-trafego-pago-meta-ads.md` §3).
- Segue o padrão já existente de env pública (`NEXT_PUBLIC_SITE_URL`,
  `NEXT_PUBLIC_MEDIA_HOST` em `lib/api.ts`/`next.config.ts`) — Pixel ID não é
  segredo, não precisa de cifra nem de novo model no backend.
- Eventos **padrão** do Meta (`Contact`, `Lead`), não customizados —
  compatibilidade direta com otimização automática do Ads Manager.

## Riscos / pontos de atenção

- `WaLinks` reescreve `href` de todos os `[data-wa]` da página num único
  `useEffect` — o listener de clique pro evento `Contact` precisa cobrir os
  mesmos elementos sem duplicar disparo se o componente re-renderizar.
- Sem Pixel ID configurado (dev/local), `window.fbq` não existe — toda chamada
  de evento precisa de guarda (`typeof window.fbq === "function"`) pra não
  quebrar em dev/CI.
- `LeadForm` tem 2 caminhos de sucesso (API ok → abre `whatsapp_url`; API
  falha → fallback local abre `wa.me` direto) — o evento `Lead` deve disparar
  só no caminho feliz (POST OK), não no fallback de erro.
