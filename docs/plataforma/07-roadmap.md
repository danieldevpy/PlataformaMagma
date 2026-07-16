# 07 · Roadmap — fases e checklists

> Cada fase termina com algo **usável em produção**. Fluxo de trabalho: cada item vira
> uma spec do spec-kit ([09](09-fluxo-speckit-dotcontext.md)); o conteúdo inicial vem por
> seed ([08](08-conteudo-inicial-seeds.md)) — o gestor entra revisando dados na Fase 4,
> mas o site já vive do banco desde a Fase 2 com os dados do template.

## Fase 0 — Fundação (1 sessão de trabalho) — spec `001-fundacao`

- [ ] Criar `magma-plataforma/` (backend + frontend, git próprio)
- [ ] **Spec-kit**: `specify init . --ai claude` + escrever `constitution.md` ([09](09-fluxo-speckit-dotcontext.md))
- [ ] **dotcontext**: criar `.context/` (index, backend, frontend, dados, decisoes)
- [ ] Django: projeto `config`, settings dev/prod, apps vazios (`nucleo, contas, cursos, avaliacoes, leads`)
- [ ] `Usuario` custom (**antes da primeira migração!**) + superuser
- [ ] DRF + CORS + SimpleJWT instalados e configurados
- [ ] Next.js criado; tokens.css + lp.css importados; fontes via `next/font`; `<MagmaSymbol>`

**Pronto quando:** `runserver` + `next dev` sobem; constitution e `.context/` commitados.

## Fase 1 — Modelos core + Seed inicial — specs `002-modelos-core`, `003-seed-inicial`

- [ ] Base abstrata `ConteudoRastreavel` (`conteudo_origem` template/editado)
- [ ] Models `nucleo` (ConfiguracaoSite) e `cursos` (Curso, Habilidade, PerguntaFrequente, Instrutor, Turma, AnotacaoTurma) — [02-backend-django.md](02-backend-django.md)
- [ ] Migrações + Django Admin registrado (ferramenta do dev)
- [ ] **`backend/conteudo_inicial/`**: extrair TODO o conteúdo da LP atual para JSON + copiar imagens de `landing-page/assets/` — [08](08-conteudo-inicial-seeds.md)
- [ ] **Comando `seed_inicial`** idempotente (cria/atualiza só `origem=template`, `--dry-run`, log resumo)
- [ ] Media files servindo em dev

**Pronto quando:** banco recém-criado + `seed_inicial` = curso APH completo e idêntico
ao template; rodar o comando 2× não altera nada; editar no Admin e rodar de novo preserva a edição.

## Fase 2 — API pública + LP dinâmica  ⭐ *v1: o site roda do banco, igual ao template* — specs `004-006`

- [ ] Serializers/views públicos: `GET /api/site/config/`, `/api/cursos/`, `/api/cursos/{slug}/` (regras de countdown/preço/toggles no serializer)
- [ ] `POST /api/leads/` + webhook n8n opcional
- [ ] Front: `lib/api.ts` + types; página do curso consumindo API com `revalidate: 60`
- [ ] Countdown/urgência/preço renderizando condicionalmente pelos toggles
- [ ] `LeadForm` gravando lead e abrindo WhatsApp
- [ ] Home dinâmica (lista de cursos publicados)
- [ ] SEO: metadata, JSON-LD, sitemap
- [ ] Deploy: back no VPS + front na Vercel, domínio apontado; **deploy roda `migrate` + `seed_inicial`**

**Pronto quando (critério da v1):** diff visual entre a LP estática atual e a página
servida por Next+Django+seed = **zero** (mesmos textos, imagens, countdown e colchetes);
mudar `exibir_countdown` no Admin muda o site em ≤60s.

## Fase 3 — Avaliações por magic link  ⭐ *primeira ferramenta de alimentação* — spec `007`

- [ ] Models `ConviteAvaliacao` + `Avaliacao` (depoimentos-template da LP seedados como `origem=template`, substituídos conforme avaliações reais são aprovadas)
- [ ] Endpoints do token (GET/POST) com rate-limit + expiração
- [ ] Página `/avaliar/[token]` (estrelas, comentário, obrigado) — [05](05-avaliacoes-magic-link.md)
- [ ] `avaliacoes[]` no payload do curso (aprovadas, ordenadas por peso)
- [ ] `<ReviewsSection>` dinâmica com fallback
- [ ] Interim: criação de convite + moderação/peso via Django Admin (painel vem na F4)

**Pronto quando:** o dono envia um link real, o ex-aluno avalia, o dev aprova com
peso e o depoimento aparece na LP.

## Fase 4 — Painel do gestor  ⭐ *o dono se torna autônomo* — specs `008-011`

- [ ] Auth JWT no front (login, cookie httpOnly, guard de papel)
- [ ] Dashboard com pendências **+ checklist de revisão do template** ("Curso APH: 14/22 itens revisados"; placeholders `[...]` visíveis na página = prioridade alta)
- [ ] Badges "valor do template — revisar" em todo campo `conteudo_origem=template`; PATCH do painel marca `editado`
- [ ] Botão "Ocultar dados de exemplo" por turma (desliga toggles da turma-template em lote)
- [ ] Editor de curso em abas (salvamento parcial + % revisado)
- [ ] Tela de turma com toggles (countdown, vagas, preço, início) + anotações
- [ ] Convites + moderação de avaliações com slider de peso
- [ ] Inbox de leads
- [ ] Config do site
- [ ] Revalidação on-demand (signal → Next) para mudanças instantâneas
- [ ] **Sessão de onboarding com o dono** (30 min, celular dele)

**Pronto quando:** o dono cria a turma nova, ativa countdown e aprova avaliações
sem falar com o desenvolvedor.

## Fase 5 — Escala de conteúdo

- [ ] Cursos restantes cadastrados pelo próprio painel (BLS, Punção Venosa, Cuidador…)
- [ ] Página de curso genérica validada com 3+ cursos (variação de accent por categoria, se desejado)
- [ ] Novas imagens Kairogen para os demais cursos
- [ ] Página "todos os cursos" + lista de espera para turmas sem inscrição aberta

## Fase 6 — Módulo educacional (base para tudo que vem depois)

- [ ] App `educacional`: Aluno, Matricula, Aula, Presenca, Certificado — [02 §educacional](02-backend-django.md)
- [ ] Matrícula ligada ao lead (funil completo: lead → matrícula → aluno formado)
- [ ] Presença por aula (tela simples pro instrutor no painel)
- [ ] Certificados: geração com código `MG-AAAA-NNNN` + página pública `/verificar/[uuid]` (fecha o ciclo com o QR do certificado do design system)
- [ ] Encerrar turma → gerar convites de avaliação em lote

## Fase 7 — Integrações e IA

- [ ] Tokens de API com escopo (leitura de cursos/turmas/aulas) para ferramentas externas
- [ ] n8n: nutrição de leads, lembretes de aula, pedido de avaliação pós-turma
- [ ] MCP server/endpoints estruturados para agentes (contexto: turmas, alunos, aulas) — conectando com [subsistemas 02, 06 e 07](../subsistemas/)
- [ ] Documento mestre por curso alimentando o Estúdio de Conteúdo

---

## Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Dono não alimentar dados | Seed mantém o site completo no ar desde o dia 1; dashboard mostra "% revisado" e prioriza placeholders visíveis; onboarding na F4 |
| Seed sobrescrever edição do gestor | `conteudo_origem` + regra "seed só toca origem=template" + teste de idempotência na DoD de toda spec |
| Escopo crescer antes da base | Fases 0–4 são intocáveis; nada da F6+ entra antes |
| SEO cair na migração | URLs idênticas (`/cursos/socorrista-aph/`), redirects 301 se mudar algo, JSON-LD preservado |
| Segurança do magic link | UUID4 + expiração + uso único + rate-limit + moderação obrigatória |
| Custo/complexidade de infra | 1 VPS pequeno (Django+Postgres) + Vercel free tier é suficiente por muito tempo |
