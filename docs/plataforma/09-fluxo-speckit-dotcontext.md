# 09 · Fluxo de Desenvolvimento — Spec-Kit + dotcontext

> Como o projeto será desenvolvido no dia a dia: **spec-driven** (GitHub spec-kit) com
> **contexto persistente para agentes** (convenção `.context/`). Objetivo: você (dev)
> pilota specs e revisões; agentes de IA implementam com contexto completo sem você
> re-explicar o projeto a cada sessão.

## Setup no repositório `magma-plataforma/`

```bash
# spec-kit (CLI specify)
uvx --from git+https://github.com/github/spec-kit.git specify init . --ai claude

# estrutura resultante
.specify/
├── memory/constitution.md      # princípios inegociáveis (abaixo)
├── templates/                  # spec/plan/tasks templates
specs/                          # uma pasta por feature
.context/                       # dotcontext — mapa do projeto p/ agentes
```

## Constitution (`.specify/memory/constitution.md`)

Conteúdo inicial — os princípios que **nenhuma spec pode violar**:

```markdown
# Constituição — Plataforma Magma

1. SEED-FIRST. A v1 roda idêntica à landing page template; todo conteúdo do template
   é registro inicial no banco (docs/plataforma/08). Nenhuma feature assume banco
   vazio, e nenhuma feature sobrescreve conteudo_origem="editado".

2. O GESTOR É A FONTE DOS DADOS. Conteúdo de produção só muda pelo painel (ou pelo
   seed enquanto origem=template). O dev não edita conteúdo; edita funcionalidade.
   Toda tela do painel deve ser operável por um não-técnico pelo celular.

3. TOGGLE ANTES DE FEATURE. Tudo que aparece/some no site público tem booleano
   exibir_* editável no painel. Regra de exibição vive no serializer (API já entrega
   null quando desligado/expirado); o front apenas renderiza condicionalmente.

4. ZERO REDESIGN. O visual é lei: design-system/ v2 (tokens + AGENTS.md) e o HTML/CSS
   da landing-page/ são a referência pixel-perfect. Specs de UI referenciam
   componentes/classes existentes, nunca inventam estilo novo.

5. FASES ENTREGÁVEIS. Cada spec cabe em uma fase do roadmap (docs/plataforma/07) e
   termina em estado deployável. Nada da fase N+1 entra na fase N.

6. API É CONTRATO. docs/plataforma/03 é a fonte de verdade; mudanças de payload
   exigem atualizar o doc na mesma PR. Erros: {"detail": "..."}; IDs públicos são
   slug/uuid, nunca PK sequencial.
```

## Ciclo por feature

```
/speckit.specify  →  specs/NNN-nome/spec.md     (o QUÊ e PORQUÊ — sem stack)
/speckit.plan     →  specs/NNN-nome/plan.md     (o COMO — aponta p/ docs/plataforma/*)
/speckit.tasks    →  specs/NNN-nome/tasks.md    (passos pequenos e verificáveis)
/speckit.implement                              (agente executa; dev revisa PR)
```

Regras práticas:
- **1 spec = 1 branch = 1 PR.** Specs pequenas (≤ ~1 semana de trabalho).
- O `plan.md` **referencia** os docs deste diretório em vez de duplicá-los
  (ex.: "modelos conforme docs/plataforma/02 §cursos").
- Toda spec tem seção **"Critério de aceite do gestor"** quando toca o painel
  (ex.: "o dono consegue ativar o countdown sozinho pelo celular").

## Mapa roadmap → specs

| Fase | Specs sugeridas |
|---|---|
| F0 | `001-fundacao` (monorepo, Django+Next, tokens, symbol) |
| F1 | `002-modelos-core` · `003-seed-inicial` (comando + conteudo_inicial/) |
| F2 | `004-api-publica` · `005-lp-dinamica` (paridade visual com o template) · `006-leads` |
| F3 | `007-avaliacoes-magic-link` |
| F4 | `008-auth-painel` · `009-painel-cursos-turmas` · `010-painel-avaliacoes` · `011-checklist-revisao-template` |
| F5+ | uma spec por curso novo/feature (ver docs 07) |

> `011-checklist-revisao-template` é a feature que materializa o seed-first no painel:
> badges "valor do template", % revisado no dashboard, prioridade para placeholders
> visíveis — ver [08-conteudo-inicial-seeds.md](08-conteudo-inicial-seeds.md).

## dotcontext — `.context/` (contexto durável para agentes)

Arquivos curtos, **atualizados na PR que muda o módulo** (regra de higiene: PR que
altera comportamento de um módulo atualiza o `.context/` correspondente):

```
.context/
├── index.md        # o que é o projeto, mapa de pastas, onde está cada verdade
├── backend.md      # apps, modelos-chave, convenções (PT-BR, conteudo_origem, toggles)
├── frontend.md     # rotas, mapa componente→dado, hooks de animação, fallback=erro
├── dados.md        # seed-first: como rodar seed, o que é origem template/editado
└── decisoes.md     # log de decisões (ADR curto: data, decisão, porquê)
```

Conteúdo do `index.md` (esqueleto):

```markdown
# Plataforma Magma — mapa para agentes

- Visual/marca: ../design-system/AGENTS.md (LEI — ler antes de qualquer UI)
- Plano técnico: ../docs/plataforma/ (01 arquitetura · 02 modelos · 03 API ·
  04 front · 05 avaliações · 06 painel · 07 roadmap · 08 seeds · 09 este fluxo)
- Constituição: .specify/memory/constitution.md
- Backend: backend/ (Django/DRF) — ver backend.md
- Frontend: frontend/ (Next App Router) — ver frontend.md
- Conteúdo inicial: backend/conteudo_inicial/ — NUNCA editar valores já revisados
  pelo gestor no banco (conteudo_origem="editado")
```

## Papéis no fluxo

| Papel | Responsabilidade |
|---|---|
| **Dev (Daniel)** | escreve/aprova specs, revisa PRs, decide arquitetura, mantém constitution e `.context/` |
| **Agentes IA** | implementam specs via `/speckit.implement`, sempre carregando `.context/` + AGENTS.md |
| **Gestor/dono** | revisa e corrige dados pelo painel (guiado pelo checklist de template) — não participa do fluxo de código |

## Definition of Done (toda spec)

- [ ] Critérios de aceite da spec passam (incluindo o do gestor, se houver)
- [ ] `seed_inicial` continua idempotente (rodar 2× não muda nada)
- [ ] Diff visual da LP pública = zero, exceto quando a spec é de UI
- [ ] docs/plataforma/03 atualizado se o payload mudou
- [ ] `.context/` do módulo tocado atualizado
- [ ] Deploy de preview verificado no celular
