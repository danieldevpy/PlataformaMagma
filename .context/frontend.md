# Frontend — Next.js App Router (`plataforma/frontend/`)

> Detalhe completo: `docs/plataforma/04-frontend-nextjs.md`. Guia local: `frontend/AGENTS.md` (o `frontend/CLAUDE.md` só aponta para ele).

- Rotas em `app/(site)/` (home + páginas de curso) + `robots.ts`/`sitemap.ts`/`JsonLd` para SEO.
- Componentes de seção em `components/` (CourseHero, PricingCard, ReviewsSection, LeadCaptureSection, StickyCtaBar, WhatsFloat…); interativos em `components/client/`.
- **Fallback = erro**: a página renderiza o que a API entrega; campo `null` (toggle desligado) → seção não renderiza. Front não inventa conteúdo.
- Split de API: cliente SSR × browser separados em `lib/` (URLs distintas dev/prod — decisão de 2026-07-16).
- Visual: tokens de `design-system/` — **zero redesign** (constituição §4).
- A experiência de avaliação vive em `AvaliacaoExperience.tsx` (migrada do protótipo `mvp-apps/avaliacao/`).
