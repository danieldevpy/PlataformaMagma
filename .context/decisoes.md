# Log de decisões (ADR curto)

> Formato: data · decisão · porquê. Não rediscutir sem fato novo.
> Decisões táticas de uma frente específica podem viver no `docs/subsistemas/NN-execucao-status.md` da frente; aqui ficam as que afetam o projeto inteiro.

- **2026-07-15** · Monorepo `plataforma/` com Django/DRF + Next.js App Router, conteúdo seed-first (LP roda idêntica ao template com tudo vindo do banco). *Porquê:* gestor edita conteúdo pelo painel sem dev; ver constituição §1–2.
- **2026-07-16** · Prod reformulado: nginx no HOST da VPS, containers em portas loopback, split `api.ts` SSR/browser, URLs de mídia relativas. *Porquê:* simplifica TLS/roteamento e corrige mídia quebrada em dev.
- **2026-07-16** · Links de avaliação/carteirinha em dois escopos: **turma (compartilhado, default)** e individual. *Porquê:* distribuir 1 link no grupo da turma é o fluxo real do instrutor.
- **2026-07-17** · Páginas staff (Acervo/Studio) no namespace `/dj-admin/` via `TurmaAdmin.get_urls`. *Porquê:* nginx de prod só roteia `api|dj-admin`; zero rota nova no host.
- **2026-07-17** · Upload de mídia: 1 arquivo/request, máx 1 GB, vídeo sem transcode; duplicado detectado por nome+tamanho → 409 com `forcar=1` para sobrepor. *Porquê:* simplicidade e proteção contra retrabalho de curadoria.
- **2026-07-17** · Regra-guarda de CSS: todo stylesheet novo que esconde elemento via atributo `hidden` inclui `[hidden]{display:none !important}`. *Porquê:* regras de autor `display:flex` vencem o UA stylesheet — causou modal fantasma no Acervo.
- **2026-07-18** · Reorganização: protótipos (`landing-page/`, `avaliacao/`, `carteirinha-digital/`, `studio/`) movidos para `mvp-apps/` como referência histórica; produto vive só em `plataforma/`. *Porquê:* separar laboratório de produto.
- **2026-07-18** · **n8n adotado como orquestrador de automações** (agente WhatsApp, follow-up de leads). Banco: **SQLite interno do n8n** em dev e prod — o n8n não suporta MySQL (só SQLite/Postgres), então NÃO reaproveita o banco da plataforma; Postgres dedicado só se houver queue mode/alto volume. Prod: serviço no `docker-compose.prod.yml` (loopback 5678) + subdomínio `n8n.<dominio>` no nginx do host; dev: compose avulso via `init-dev.sh --n8n`. `N8N_ENCRYPTION_KEY` é fixa e nunca deve ser trocada. *Porquê:* setup mínimo correto, sem Redis/workers. Detalhe: `plataforma/n8n/README.md`.
- **2026-07-18** · Portas de prod corrigidas para loopback real (`127.0.0.1:8000/3000`) — o compose publicava aberto, divergindo do comentário/arquitetura documentada. *Porquê:* só o nginx do host deve alcançar os containers.
- **2026-07-18** · **Baseline v0.1.0** (tag git) + estrutura de memória do projeto: `CLAUDE.md` raiz, `.context/` (dotcontext), `.specify/memory/constitution.md`, `specs/` com templates, histórico de prompts em `.context/historico/`. *Porquê:* desenvolvimento por agentes com memória persistente — saber sempre de onde veio e onde parou.
