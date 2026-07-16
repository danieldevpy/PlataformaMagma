# 04 · Front-end Next.js — migração do HTML/CSS existente

> Objetivo: **zero redesign**. O HTML/CSS da LP atual
> ([landing-page/cursos/socorrista-aph/](../../landing-page/cursos/socorrista-aph/index.html),
> [lp.css](../../landing-page/lp.css), [lp.js](../../landing-page/lp.js)) vira componentes
> React que recebem dados da API. O visual já foi validado — só muda a fonte dos dados.

## Setup

```bash
npx create-next-app@latest frontend --ts --app --no-tailwind --eslint
```

- **CSS:** copiar `design-system/tokens/tokens.css` e `landing-page/lp.css` para
  `frontend/styles/` e importar no `app/layout.tsx`. Manter classes como estão
  (CSS global) — migrar para CSS Modules só se houver conflito futuro.
- **Fontes:** trocar o `<link>` do Google Fonts por `next/font` (Archivo, Inter, Great Vibes).
- **Símbolo Magma:** `components/MagmaSymbol.tsx` renderiza o `<symbol>` uma vez no layout;
  `<use href="#magma-sym">` nos componentes (igual ao HTML atual).
- **Imagens:** `next/image` com `remotePatterns` apontando para o domínio de media do Django.

## Mapa HTML atual → componentes

| Bloco da LP atual | Componente | Dados (de `GET /api/cursos/{slug}/`) |
|---|---|---|
| Barra de urgência | `<AnnounceBar>` | `turma_destaque.vagas_restantes` + `exibir_vagas` |
| Nav | `<SiteNav>` | `site/config` (whatsapp) |
| Hero + card da turma | `<CourseHero>` + `<OfferCard>` | `titulo_venda`, `turma_destaque.*` |
| Countdown | `<Countdown ate rotulo>` (client) | `turma_destaque.countdown` — **não renderiza se `null`** |
| Faixa de números | `<StatsStrip>` (client, contadores) | `carga_horaria`, `site/config` (formados, nota + toggles) |
| Skills 6 cards | `<SkillsGrid>` | `habilidades[]` (ícone por chave → mapa de SVGs) |
| Prática (dark) | `<PracticeSection>` | `texto_pratica`, `imagem_pratica` |
| Marquee | `<OutcomesMarquee>` | `saidas_profissionais[]` |
| Carreira (bg foto) | `<CareerSection>` | `texto_carreira`, `imagem_carreira`, `saidas_profissionais` |
| Instrutor | `<InstructorSection>` | `instrutores[]` |
| Certificado | `<CertificateSection>` | estático (cert-mini CSS) + nome do curso |
| Oferta / preço | `<PricingCard>` | `turma_destaque.preco` — `null` → "Consulte condições" |
| Depoimentos | `<ReviewsSection>` | `avaliacoes[]` — vazio → fallback template |
| FAQ | `<FaqSection>` | `faqs[]` (render `<details>` igual ao atual) |
| Captura | `<LeadForm>` (client) | `POST /api/leads/` → abre `whatsapp_url` da resposta |
| Sticky CTA + WA float | `<StickyCtaBar>`, `<WhatsFloat>` (client) | config + turma |

### Comportamentos do `lp.js` → React

| lp.js | Em React |
|---|---|
| reveal on scroll | hook `useReveal()` (IntersectionObserver) ou CSS `animation-timeline` futuramente; manter classes `.reveal/.in` |
| contadores | `<AnimatedNumber value suffix>` |
| countdown | `<Countdown>` com `useEffect` + `setInterval` |
| sticky CTA mobile | `<StickyCtaBar>` observando o hero |
| links WhatsApp com UTM | helper `lib/whatsapp.ts` — mas preferir a URL montada pelo back no lead |
| `?noanim` | prop/env `NEXT_PUBLIC_NOANIM` + querystring (manter para testes visuais) |

## Estrutura de rotas

```
app/
├── layout.tsx                 # fontes, tokens.css, lp.css, <MagmaSymbol/>
├── (site)/
│   ├── page.tsx               # home (migrar landing-page/index.html depois da LP de curso)
│   ├── cursos/[slug]/page.tsx # LP de curso — generateStaticParams + revalidate 60
│   └── avaliar/[token]/page.tsx  # página do magic link (ver doc 05)
└── painel/                    # doc 06
```

### Data fetching (LP de curso)

```ts
// app/(site)/cursos/[slug]/page.tsx
export const revalidate = 60;

export async function generateStaticParams() {
  const cursos = await api<CursoResumo[]>("/cursos/");
  return cursos.map(c => ({ slug: c.slug }));
}

export default async function CursoPage({ params }) {
  const curso = await api<CursoCompleto>(`/cursos/${params.slug}/`);
  return <CursoLP curso={curso} config={await getConfig()} />;
}
```

- `lib/api.ts`: fetch tipado com `NEXT_PUBLIC_API_URL`, `next: { revalidate }`.
- `lib/types.ts`: interfaces espelhando [03-api-contratos.md](03-api-contratos.md).
- **Conteúdo inicial vem do banco, não do front** (seed-first — [doc 08](08-conteudo-inicial-seeds.md)):
  a API sempre tem dados porque o deploy roda `seed_inicial`. `lib/fallback.ts` existe
  apenas como tratamento de erro (API fora do ar durante o build → usa o último payload
  conhecido/estático) — não é mecanismo de conteúdo.

### SEO

- `generateMetadata` por curso (`seo.titulo`, `seo.descricao`, OG image = `imagem_hero`).
- JSON-LD (Course, FAQPage, LocalBusiness): componente `<JsonLd data={...}>` montado
  a partir do payload — mesma estrutura que já existe no HTML atual.
- `sitemap.ts` e `robots.ts` nativos do App Router listando cursos publicados.

## Regras de renderização condicional (toggles)

O front **só checa null/booleano** — a regra vive no serializer:

```tsx
{turma?.countdown && <Countdown ate={turma.countdown.ate} rotulo={turma.countdown.rotulo} />}
{turma?.exibir_vagas && turma.vagas_restantes != null && <AnnounceBar vagas={turma.vagas_restantes} />}
{turma?.preco ? <PricingCard preco={turma.preco} /> : <ConsulteCondicoes />}
{turma?.exibir_inicio && turma.inicio_aulas && <MetaRow label="Início das aulas" value={fmtData(turma.inicio_aulas)} />}
{avaliacoes.length > 0 ? <ReviewsSection avaliacoes={avaliacoes} /> : <ReviewsSection avaliacoes={FALLBACK_DEPOS} />}
```

## Checklist de migração (ordem de trabalho)

1. [ ] Setup Next + estilos + fontes + `<MagmaSymbol>`
2. [ ] `lib/api.ts`, `lib/types.ts`, `lib/fallback.ts` (copiar textos da LP atual)
3. [ ] Componentes estáticos com fallback (a página renderiza 100% igual à LP atual **sem backend**)
4. [ ] Hooks de animação (reveal, counter, countdown, sticky)
5. [ ] Ligar na API real curso a curso (`socorrista-aph` primeiro)
6. [ ] `LeadForm` → `POST /api/leads/`
7. [ ] Home migrada (mesmo processo)
8. [ ] SEO (metadata, JSON-LD, sitemap) + Lighthouse ≥ 90 mobile
