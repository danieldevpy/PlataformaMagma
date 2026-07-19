# Status global — onde o projeto está

> Atualizado em: **2026-07-19** · Baseline: **v0.1.0** (tag git)
> Regra: toda sessão significativa atualiza este arquivo + cria entrada em `historico/`.

## De onde veio (resumo em 4 linhas)

- **15/07/2026** — primeiro commit: "Release v0.1: lançamento inicial da plataforma" (Django + Next, LP dinâmica seed-first).
- **16/07** — reformulação de produção: nginx no host da VPS, portas loopback, split api SSR/browser, mídia relativa; links de avaliação por turma (compartilhado) além de individuais; fotos de formatura no convite.
- **17/07** — subsistema 09 completo (Acervo de Mídia + Studio integrado + Postagens) via orquestração de agentes; bugfix `[hidden]` CSS; upload múltiplo + detecção de duplicados.
- **18/07** — reorganização (protótipos → `mvp-apps/`), estrutura de memória (`.context/` + `specs/` + constituição) e **baseline v0.1.0**.
- **18/07 (tarde)** — Studio 2.0: correção de 4 desalinhamentos de UI/UX achados no teste real (postagens viram accordion + overflow; título da capa de reel `central` deixa de vazar; texto do educativo `erro-certo` centralizado; barra de variantes não fica mais sob os thumbnails). Ver `historico/2026-07-18-studio-2-0-fixes-ui.md`.
- **18/07 (noite)** — **Spec 008: acervo em camadas** (correção de rumo do turma-cêntrico): `Midia` com camadas turma/curso/instrutores/estrutura/externa/geral, postagens multi-contexto, Mesa de Luz + Studio DA MARCA, seletor de camada no picker (arte mistura camadas). Suíte 50/50. Ver `historico/2026-07-18-acervo-em-camadas.md`.
- **19/07 (tarde)** — Limpeza de repositório: `design-system-junto/` (duplicata) removida, arte bruta do laboratório do Studio (`mvp-apps/studio/montar-templates/formacao-turma/`, ~109MB) tirada do versionamento (fica local, `.gitignore`), histórico do git reescrito com `git filter-repo` p/ o `.git` emagrecer (~137MB → poucos MB). Ver `historico/2026-07-19-limpeza-repo-git.md`.
- **19/07** — **Spec 001 (suíte de testes) IMPLEMENTADA por completo, T1–T8**: 120 testes (era 45), `config/settings/test.py` isolado, `apps/nucleo/testing.py` (helpers), cobertura nova em `cursos`/`leads`/`avaliacoes`/`educacional`/`contas` (LP, leads, magic-link de avaliação e de carteirinha, JWT), expansão pesada de `midia` (EXIF, dedup completo, curadoria, consentimento, ZIP, 403 exaustivo, páginas staff da turma) e de `ia` (adapter Gemini mockado). Runner `plataforma/rodar-testes.sh` (+ `--full`). Achado: painéis de `cursos`/`leads`/`avaliacoes`/`nucleo` só aceitam JWT (não sessão) — registrado em `specs/001-suite-de-testes/tasks.md` §Log, nenhum código de produção alterado. T9 (CI) não disparada.

## O que está PRONTO (v0.1.0)

| Frente | Entrega | Onde |
|---|---|---|
| Vitrine/captação | LP dinâmica seed-first (home + página de curso), leads, SEO (robots/sitemap/JsonLd) | `plataforma/frontend/` + apps `cursos`, `leads` |
| Avaliações | Magic-link individual e por turma, experiência migrada do protótipo, fotos priorizando acervo (capa primeiro, fallback FotoCurso) | app `avaliacoes` |
| Acervo + Studio + Postagem | Upload em massa c/ EXIF+thumbs+dedup (409/forcar), Mesa de Luz (curadoria D/C/A), Studio canvas (templates → artes 1080²), postagens c/ ZIP e legenda — tudo em `/dj-admin/` | app `midia` (T1–T5 DONE, smoke test completo) |
| Infra | dev (SQLite/`init-dev.sh`) e prod (VPS, nginx no host, `init-prod.sh`, MySQL) | `plataforma/` raiz |
| Marca | Design system v2 (Estrela da Vida), tokens W3C, guia p/ agentes | `design-system/` |
| Apps de apoio | Backend tem apps `contas`, `educacional`, `nucleo` (base p/ gestão escolar / área do aluno) | `plataforma/backend/apps/` |
| Rede de segurança (testes) | **Spec 001 IMPLEMENTADA (2026-07-19)** — backend: 147 testes (`apps/<app>/tests.py`, Django-nativo), `config/settings/test.py`. Frontend: 56 testes (Vitest, `lib/*` + webhook `revalidate`, sem jsdom/RTL ainda). `plataforma/rodar-testes.sh` (+`--full`) roda os dois | `specs/001-suite-de-testes/`, `plataforma/rodar-testes.sh` |

## EM ANDAMENTO

- **n8n integrado (setup inicial pronto, 2026-07-18)**: dev via `init-dev.sh --n8n`; prod no compose oficial. Falta o setup único de prod (DNS do subdomínio + `.env.prod` + bloco nginx + certbot — checklist em `plataforma/n8n/README.md`) e, depois, a spec do agente de WhatsApp.
- **Campanha digital 08/08** — objetivo nº 1. Studio + acervo prontos para produzir conteúdo; Social Maker em concepção (`docs/subsistemas/07-social-maker.md`, `07b-social-maker-manus.md`, `agente-social-maker-contexto.md`).
- **Studio 2.0 — specs 002..005 IMPLEMENTADAS e VALIDADAS (2026-07-18, orquestração de agentes em 2 sessões)**: motor declarativo multi-formato (feed/story/capa_reel) + 6 templates (formação, depoimento c/ avaliações reais, vagas, formatura, educativo, capa de reel) + UI dinâmica c/ picker contextual + export kit + `marca.js`; app `apps.ia` (provedores cifrados, página "Integrações de IA", ✨ texto no Studio); Camada de Ações agent-first (`/api/acoes/` + `TokenAgente` — n8n já consegue pedir link de avaliação/status de turma por API). Validação: 62/62 render headless, 9/9 fluxos Django, 39/39 testes, browser real 6/6 templates + 3 bugs achados e corrigidos. Contratos consolidados em `docs/plataforma/03-api-contratos.md`. **Falta: specs 006 (pré-matrícula pública/imagem IA) e 007 (vídeo IA + render server-side)** — adapters de imagem/vídeo ainda não existem (capacidades respondem `false`, esperado).
- **Spec 008 — ACERVO EM CAMADAS, IMPLEMENTADA e VALIDADA (2026-07-18, noite)**: acervo virou da MARCA (`Midia` c/ camadas turma/curso/instrutores/estrutura/externa/geral; `credito` p/ imagem de internet), `Postagem` multi-contexto (turma/curso/marca), rotas gerais `/api/midia/acervo|acervo/camadas|acervo/enviar|postagens/` (rotas por turma intocadas — n8n/Manus ok), Mesa de Luz da marca + Studio da marca em `/dj-admin/midia/midia/acervo|studio/`, seletor de camada no picker do Studio (arte mistura fotos de camadas; templates de turma c/ `requer:['turma']` desabilitados no Studio da marca). Migração sem mover arquivo; suíte **50/50**; smoke real no browser (postagem da marca criada de ponta a ponta). **Próximos ligados a ela**: templates de conteúdo diário (divulgação de curso, instrutor, bastidores — "spec 009" do plano da sessão), calendário editorial (010), avaliações por curso no Depoimento.
- **Teste manual no browser** do Acervo (upload em massa real, dedup em lote, Studio→postagem→ZIP) — smoke test via test client passou; falta o exercício real.

## PENDÊNCIAS / QUESTÕES ABERTAS

1. ~~`design-system-junto/` é cópia idêntica de `design-system/`~~ — **resolvido 2026-07-19**: pasta removida (do working tree e do histórico do git); `design-system/` na raiz é a única fonte.
2. Seed inicial completo (`docs/plataforma/08-conteudo-inicial-seeds.md`) ainda não materializado como comando idempotente.
3. Prod: aplicar `client_max_body_size 1g` no nginx do HOST (ref. já está em `plataforma/nginx/`).
4. Itens de mídia enviados antes do dedup não têm `meta.nome_original` (não entram na checagem; sem backfill, não crítico).
5. Painel do gestor fora do Django Admin (docs 06) — futuro; por ora o Admin é o painel.
6. Porta 8000 local costuma estar ocupada por outra app — `init-dev.sh` já lida/atenção ao subir.
7. ~~Correção de registro: v0.1 sem testes persistidos~~ — **resolvido 2026-07-19**: spec 001 implementada, 120 testes cobrindo todos os apps (ver linha "Rede de segurança" na tabela PRONTO acima).
8. **Teste manual do Daniel no Studio 2.0**: gerar artes reais dos 6 templates (feed+story), configurar um provedor de IA na página nova e testar o ✨. A validação automatizada passou; falta o olho do dono.

## METAS (repensadas na baseline v0.1)

1. **Curto (até 08/08/2026):** campanha digital → turma de Socorrista APH cheia. Tudo que acelera isso tem prioridade (conteúdo via Studio, Social Maker, prova social das avaliações, LP afiada).
2. **Médio:** gestão escolar operável pelo celular (matrícula, presença, pagamentos) + certificação/carteirinha na plataforma (aposentar protótipos de vez).
3. **Longo:** "colégio digital da saúde da Baixada" — híbrido, comunidade/assinatura, agentes de IA operando atendimento/marketing/conteúdo (ver `plano-evolucao-digital-magma.md`).
