# 01 · Arquitetura

## Estrutura de repositório (monorepo)

```
magma-plataforma/
├── backend/                      # Django
│   ├── config/                   # settings, urls, wsgi/asgi
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── dev.py
│   │   │   └── prod.py
│   ├── apps/
│   │   ├── nucleo/               # config do site, feature flags, páginas institucionais
│   │   ├── cursos/               # Curso, Habilidade, FAQ, Turma, AnotacaoTurma
│   │   ├── avaliacoes/           # ConviteAvaliacao, Avaliacao
│   │   ├── leads/                # Lead + webhook n8n
│   │   ├── contas/               # User custom + papéis (gestor, instrutor)
│   │   └── educacional/          # (fase futura) Aluno, Matricula, Aula, Presenca, Certificado
│   ├── manage.py
│   └── requirements.txt
├── frontend/                     # Next.js App Router
│   ├── app/
│   │   ├── (site)/               # público
│   │   │   ├── page.tsx          # home
│   │   │   ├── cursos/[slug]/page.tsx
│   │   │   ├── avaliar/[token]/page.tsx
│   │   │   └── verificar/[codigo]/page.tsx   # (futuro) certificados
│   │   └── painel/               # gestor/instrutor (client-side auth)
│   ├── components/
│   ├── lib/                      # api client, types
│   └── styles/                   # tokens.css + lp.css portados
├── design-system/                # já existe — fonte de verdade visual (copiar/симlink tokens)
└── docs/                         # este plano
```

> O repositório atual (`magmacursos/`) segue como está — landing estática, design system
> e docs. O `magma-plataforma/` nasce ao lado (ou como subpasta `plataforma/`), e a
> landing estática vira a referência de migração até o front dinâmico assumir o domínio.

## Fluxo de dados

```
┌──────────────┐   REST (JSON, público, cacheado)   ┌─────────────┐
│   Next.js     │ ◄───────────────────────────────── │   Django     │
│  site público │   ISR: revalidate 60s + on-demand  │   DRF API    │
└──────┬───────┘                                     └──────┬──────┘
       │ /painel (JWT)                                      │
┌──────▼───────┐   REST autenticado (gestor)         ┌──────▼──────┐
│ Painel React  │ ─────────────────────────────────► │ PostgreSQL   │
└──────────────┘                                     └─────────────┘
       ▲                                                    │
ex-aluno com magic link ──► POST /api/avaliacoes/{token}    │
                                                            ▼
                                              webhook n8n (leads, notificações)
```

### Estratégia de renderização do site público

- **SSG + ISR (`revalidate: 60`)** nas páginas de curso e home: o site é estático e rápido; mudanças do painel aparecem em ≤60s.
- **Revalidação on-demand (opcional na F4):** signal `post_save` no Django chama `POST /api/revalidate` do Next com secret → mudança instantânea.
- **Fallback estático:** cada componente recebe `dados ?? template` — os textos atuais da LP viram constantes de fallback (ver [04-frontend-nextjs.md](04-frontend-nextjs.md)).

## Ambientes

| Ambiente | Front | Back | Banco |
|---|---|---|---|
| dev local | `next dev` :3000 | `runserver` :8000 | SQLite |
| produção | Vercel (ou VPS com Node) | VPS (gunicorn + nginx) — Hetzner/Contabo/Railway | PostgreSQL gerenciado ou no VPS |

Variáveis principais:

```
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api
REVALIDATE_SECRET=...

# backend/.env
DJANGO_SECRET_KEY=...
DATABASE_URL=postgres://...
CORS_ALLOWED_ORIGINS=https://magmacursosltda.com.br
FRONTEND_URL=https://magmacursosltda.com.br   # usado p/ montar magic links
N8N_LEAD_WEBHOOK=...                          # opcional
```

## Decisões e porquês

1. **DRF em vez de GraphQL** — payloads pequenos e estáveis; contrato simples documentado em [03-api-contratos.md](03-api-contratos.md).
2. **Painel dentro do Next.js** (rota `/painel`) em vez de app separado — reaproveita design system, um deploy só de front.
3. **Django Admin não é o painel do dono.** Ele fica atrás de `/dj-admin/` com acesso restrito ao dev. Tudo que o dono precisa tem tela própria com UX guiada.
4. **Imagens**: campos `ImageField` (media/ no VPS ou S3-compatível). O front recebe URLs absolutas. As imagens Kairogen atuais entram como seed inicial dos cursos.
5. **IDs públicos**: todo recurso exposto tem `slug` (cursos) ou `uuid` (convites, verificação de certificado) — nunca expor PK sequencial em URL pública.
