# Plataforma Magma — Plano Técnico de Implementação

> **O que é este conjunto de docs:** o plano de desenvolvimento passo a passo da
> plataforma, escrito para o desenvolvedor (Daniel). A base conceitual está em
> [`../`](../README.md); aqui é **como construir**: stack, modelos, contratos de API,
> telas e roadmap.
>
> **Princípio-guia (SEED-FIRST):** a v1 roda **idêntica à landing page template** — o
> conteúdo hardcodado do template vira registro inicial no banco no primeiro deploy.
> O dono/instrutor então **edita e corrige** esses dados pelo painel, guiado por um
> checklist automático de "valores do template a revisar" — sem o programador precisar
> instruir. O dev desenvolve funcionalidades; o gestor é a fonte da verdade dos dados.

## Stack decidida

| Camada | Tecnologia | Papel |
|---|---|---|
| Front público + Painel | **Next.js (App Router) + React** | Site público (LPs de curso) e painel do gestor/instrutor |
| Estilo | **CSS do design system v2** (`design-system/tokens/tokens.css` + port de `landing-page/lp.css`) | Nenhum redesign: migrar o HTML/CSS que já existe |
| Backend | **Django + Django REST Framework** | API, regras de negócio, geração de links de avaliação |
| Banco | **PostgreSQL** (SQLite no dev) | — |
| Admin técnico | **Django Admin** | Só para o desenvolvedor (dados crus, correções, flags) |
| Auth do painel | **JWT (SimpleJWT)** com papéis `gestor` / `instrutor` | Painel React consome a API autenticada |
| Automações | n8n + webhooks | Leads → CRM/WhatsApp; futuro: IA |

**Divisão clara de quem usa o quê:**
- **Visitante** → site público Next.js (SSG/ISR, rápido e SEO forte).
- **Ex-aluno** → página pública de avaliação via *magic link* (sem senha).
- **Dono/instrutor** → Painel `/painel` no Next.js: formulários guiados, toggles, moderação. **Nunca precisa abrir o Django Admin.**
- **Desenvolvedor** → Django Admin + migrações + este plano.

## Ordem de leitura / desenvolvimento

| Doc | Conteúdo |
|---|---|
| [01-arquitetura.md](01-arquitetura.md) | Estrutura de pastas, ambientes, fluxo de dados, deploy |
| [02-backend-django.md](02-backend-django.md) | Apps e **modelos completos** (curso, turma, avaliação, flags, leads) |
| [03-api-contratos.md](03-api-contratos.md) | Endpoints e payloads JSON — contrato entre back e front |
| [04-frontend-nextjs.md](04-frontend-nextjs.md) | Migração do HTML/CSS atual para componentes React |
| [05-avaliacoes-magic-link.md](05-avaliacoes-magic-link.md) | Fluxo completo: convite → link → avaliação → peso → site |
| [06-painel-gestor.md](06-painel-gestor.md) | Telas do painel do dono/instrutor (UX de preenchimento rápido) |
| [07-roadmap.md](07-roadmap.md) | Fases com checklists — **comece por aqui para saber o que fazer hoje** |
| [08-conteudo-inicial-seeds.md](08-conteudo-inicial-seeds.md) | **Seed-first**: template → registros iniciais, `conteudo_origem`, checklist de revisão |
| [09-fluxo-speckit-dotcontext.md](09-fluxo-speckit-dotcontext.md) | Como desenvolver: spec-kit (constitution, specs por fase) + `.context/` para agentes |

## Como rodar os testes

Rede de segurança da spec `specs/001-suite-de-testes/` — um comando responde
"posso deployar?":

```bash
plataforma/rodar-testes.sh          # backend (Django, ~150 testes) + node --check + Vitest (lib/* do frontend)
plataforma/rodar-testes.sh --full   # + tsc --noEmit e next build do frontend (mais lento; obrigatório antes de deploy)
```

- **Backend**: testes vivem em `apps/<app>/tests.py` (um por app, `django.test.TestCase`
  nativo — **não** pytest); helpers compartilhados em `apps/nucleo/testing.py`. Rodam
  sob `config/settings/test.py` (DB SQLite em memória, `MEDIA_ROOT` temporário) — nunca
  tocam `db.sqlite3` nem `backend/media/` reais. Rodar só um app:
  `cd backend && python manage.py test apps.midia --settings=config.settings.test -v 2`.
- **Frontend**: `Vitest` (`frontend/vitest.config.ts`) cobre a **lógica pura** —
  `lib/*` (formatação, merge de dados da home, JSON-LD, fetch wrapper) e o webhook
  `app/api/revalidate/route.ts`. De propósito **sem** jsdom/Testing Library — testes de
  componente/interação (`LeadForm`, `AvaliacaoExperience`, `Countdown`) e E2E de browser
  real ficam pra uma spec futura. Testes ficam colocados junto do arquivo (`format.test.ts`
  ao lado de `format.ts`). Rodar: `cd frontend && npm run test` (ou `npx vitest` pra modo watch).

## Regras de ouro do projeto

1. **Seed-first.** O banco nunca está vazio: o conteúdo do template é semeado no deploy ([08](08-conteudo-inicial-seeds.md)). O seed jamais sobrescreve o que o gestor editou (`conteudo_origem="editado"`).
2. **Conteúdo em `[colchetes]` no template = campo do banco.** A LP atual ([landing-page/cursos/socorrista-aph/](../../landing-page/cursos/socorrista-aph/index.html)) já marca com `data-field` exatamente o que vira dado dinâmico — e esses valores são os registros iniciais.
3. **Toggle antes de feature.** Tudo que aparece/some no site (countdown, barra de urgência, vagas restantes, preço) é controlado por booleano `exibir_*` editável no painel; a regra vive no serializer.
4. **O gestor corrige, não preenche.** Toda tela do painel é UX de revisão de valores existentes, com badge "valor do template — revisar" e % de completude no dashboard.
5. **Modelagem já pensa no futuro** (alunos, aulas, presença, certificados, IA) mas **só implementa o que a fase pede** — ver [07-roadmap.md](07-roadmap.md).
6. **Desenvolvimento por specs.** Cada feature nasce como spec (spec-kit) obedecendo à constitution; agentes implementam com `.context/` — ver [09](09-fluxo-speckit-dotcontext.md).
