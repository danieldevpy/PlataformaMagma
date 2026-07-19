# Magma Cursos — mapa para agentes

O que é: ecossistema físico + digital da Magma Cursos. O físico (Nova Iguaçu/RJ) é o
palco da prática e da certificação; o digital capta, ensina teoria, retém e monetiza.
Meta imediata: **encher a turma de Socorrista APH até 08/08/2026** via campanha digital.

## Mapa de pastas

| Pasta | O que é | Estado |
|---|---|---|
| `plataforma/` | **O produto real** — Django/DRF (`backend/`) + Next.js App Router (`frontend/`) + nginx + scripts `init-dev.sh` / `init-prod.sh` | Em produção (v0.1) |
| `design-system/` | Identidade da marca v2 (Estrela da Vida) — tokens, logos, showcase, `AGENTS.md` | **LEI visual** (única cópia — `design-system-junto/` era duplicata e foi removida em 19/07) |
| `docs/` | Concepção: visão, ofertas, `subsistemas/01..09` (o QUÊ/PORQUÊ de cada frente) | Fonte conceitual |
| `docs/plataforma/` | Plano técnico: 01 arquitetura · 02 modelos · 03 **contratos de API** · 04 front · 05 avaliações · 06 painel · 07 roadmap · 08 seeds · 09 fluxo spec-kit | Fonte técnica |
| `specs/` | Specs de features (fluxo spec-driven interno) | Ativo a partir da v0.1 |
| `mvp-apps/` | Protótipos que geraram as features (landing-page, avaliacao, carteirinha-digital, studio) | Referência histórica; `studio/` ainda serve de laboratório de templates |
| `plano-evolucao-digital-magma.md` | Plano estratégico em fases (diagnóstico, visão, cronograma) | Norte estratégico |

## Onde vive cada verdade

- **Status global do projeto (onde começou e parou):** `.context/status.md`
- **Decisões de arquitetura (ADRs):** `.context/decisoes.md`
- **Histórico de prompts/sessões:** `.context/historico/`
- **Princípios inegociáveis:** `.specify/memory/constitution.md`
- **Visual/marca:** `design-system/AGENTS.md` (ler ANTES de qualquer UI/arte)
- **Contratos de API:** `docs/plataforma/03-api-contratos.md` (mudou payload → atualiza o doc na mesma mudança)
- **Backend:** `.context/backend.md` · **Frontend:** `.context/frontend.md` · **Dados/seed/ambientes:** `.context/dados.md`
- **Status de execução por frente:** `docs/subsistemas/NN-execucao-status.md` (ex.: subsistema 09)
