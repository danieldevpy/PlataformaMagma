# Status global — onde o projeto está

> Atualizado em: **2026-07-18** · Baseline: **v0.1.0** (tag git)
> Regra: toda sessão significativa atualiza este arquivo + cria entrada em `historico/`.

## De onde veio (resumo em 4 linhas)

- **15/07/2026** — primeiro commit: "Release v0.1: lançamento inicial da plataforma" (Django + Next, LP dinâmica seed-first).
- **16/07** — reformulação de produção: nginx no host da VPS, portas loopback, split api SSR/browser, mídia relativa; links de avaliação por turma (compartilhado) além de individuais; fotos de formatura no convite.
- **17/07** — subsistema 09 completo (Acervo de Mídia + Studio integrado + Postagens) via orquestração de agentes; bugfix `[hidden]` CSS; upload múltiplo + detecção de duplicados.
- **18/07** — reorganização (protótipos → `mvp-apps/`), estrutura de memória (`.context/` + `specs/` + constituição) e **baseline v0.1.0**.

## O que está PRONTO (v0.1.0)

| Frente | Entrega | Onde |
|---|---|---|
| Vitrine/captação | LP dinâmica seed-first (home + página de curso), leads, SEO (robots/sitemap/JsonLd) | `plataforma/frontend/` + apps `cursos`, `leads` |
| Avaliações | Magic-link individual e por turma, experiência migrada do protótipo, fotos priorizando acervo (capa primeiro, fallback FotoCurso) | app `avaliacoes` |
| Acervo + Studio + Postagem | Upload em massa c/ EXIF+thumbs+dedup (409/forcar), Mesa de Luz (curadoria D/C/A), Studio canvas (templates → artes 1080²), postagens c/ ZIP e legenda — tudo em `/dj-admin/` | app `midia` (T1–T5 DONE, smoke test completo) |
| Infra | dev (SQLite/`init-dev.sh`) e prod (VPS, nginx no host, `init-prod.sh`, MySQL) | `plataforma/` raiz |
| Marca | Design system v2 (Estrela da Vida), tokens W3C, guia p/ agentes | `design-system/` |
| Apps de apoio | Backend tem apps `contas`, `educacional`, `nucleo` (base p/ gestão escolar / área do aluno) | `plataforma/backend/apps/` |

## EM ANDAMENTO

- **Spec 001 — suíte de testes** (`specs/001-suite-de-testes/`): plano completo pronto (spec+plan+tasks, T1–T7 em 3 ondas); aguardando Daniel disparar a Onda 0 (T1 fundação). É pré-requisito recomendado antes das features da campanha.
- **Campanha digital 08/08** — objetivo nº 1. Studio + acervo prontos para produzir conteúdo; Social Maker em concepção (`docs/subsistemas/07-social-maker.md`, `07b-social-maker-manus.md`, `agente-social-maker-contexto.md`).
- **Teste manual no browser** do Acervo (upload em massa real, dedup em lote, Studio→postagem→ZIP) — smoke test via test client passou; falta o exercício real.

## PENDÊNCIAS / QUESTÕES ABERTAS

1. `design-system-junto/` é cópia idêntica de `design-system/` — Daniel decide qual layout fica e a outra pasta some.
2. Seed inicial completo (`docs/plataforma/08-conteudo-inicial-seeds.md`) ainda não materializado como comando idempotente.
3. Prod: aplicar `client_max_body_size 1g` no nginx do HOST (ref. já está em `plataforma/nginx/`).
4. Itens de mídia enviados antes do dedup não têm `meta.nome_original` (não entram na checagem; sem backfill, não crítico).
5. Painel do gestor fora do Django Admin (docs 06) — futuro; por ora o Admin é o painel.
6. Porta 8000 local costuma estar ocupada por outra app — `init-dev.sh` já lida/atenção ao subir.
7. **Correção de registro (2026-07-18):** a v0.1 NÃO tem testes automatizados persistidos — o "smoke test" do subsistema 09 foi execução única em sessão, não está no repo. Rede de segurança planejada na spec 001. A futura spec do seed (doc 08) herda a obrigação de testar idempotência (ver `specs/001-suite-de-testes/plan.md` §final).

## METAS (repensadas na baseline v0.1)

1. **Curto (até 08/08/2026):** campanha digital → turma de Socorrista APH cheia. Tudo que acelera isso tem prioridade (conteúdo via Studio, Social Maker, prova social das avaliações, LP afiada).
2. **Médio:** gestão escolar operável pelo celular (matrícula, presença, pagamentos) + certificação/carteirinha na plataforma (aposentar protótipos de vez).
3. **Longo:** "colégio digital da saúde da Baixada" — híbrido, comunidade/assinatura, agentes de IA operando atendimento/marketing/conteúdo (ver `plano-evolucao-digital-magma.md`).
