# 2026-07-18 (noite) — Spec 008: acervo em camadas (turma · curso · marca)

## Prompt do Daniel (essência)
> Parando pra pensar, errei ao projetar o Studio 2.0 focado na turma — o certo
> é bem mais amplo: postagens diárias da página do curso, stories, reels com
> vídeo, misturando fotos de turmas, do curso, internet, instrutores. Depois:
> "seria legal o acervo ter várias camadas (turmas, marca etc.), organizando
> imagens e vídeos, com boa experiência de acesso pelo Studio — crie um plano
> e implemente".

## O que foi feito (Claude direto, sem subagentes)
1. **Planejamento** virou `specs/008-acervo-em-camadas/` (spec/plan/tasks).
2. **Modelo**: `MidiaTurma` → `Midia` (RenameModel escrito à mão — o
   autodetector sugeria delete+create destrutivo) c/ `camada`
   (`turma|curso|instrutores|estrutura|externa|geral`), `turma`/`curso`
   opcionais por invariante (validados em `clean()` + views), `credito`;
   `Postagem` c/ turma OU curso OU marca. Migração `0003_acervo_em_camadas`
   com backfill `camada="turma"`; **nenhum arquivo físico movido** (upload_to
   ramifica: `turmas/<id>/…` mantido; resto vai p/ `acervo/<camada>/…`).
3. **API**: rotas gerais `/api/midia/acervo/` (filtros camada/curso/turma/
   tipo/tag/q), `/acervo/camadas/` (resumo p/ seletores, Geral primeiro),
   `/acervo/enviar/` (upload em qualquer camada, dedup POR ESCOPO),
   `/postagens/` (GET filtros + POST multi-contexto). Rotas por turma
   intocadas (viram açúcar sobre caminhos únicos `processar_upload_midia` /
   `criar_postagem_com_artes`). Catálogo `acoes/` + ação
   `listar_postagens_agendadas` com `contexto`/`curso_slug` (sem PK).
4. **Mesa de Luz da marca** (`/dj-admin/midia/midia/acervo/` via
   `MidiaAdmin.get_urls`): mesmo template da turma, modo decidido por
   `MAGMA_CONTEXTO`; seletor de camada (fixas + cursos), sem consentimento.
5. **Studio**: picker de fotos c/ seletor de camada (desta turma → marca →
   cursos → outras turmas, com contagens) e seleção que sobrevive à troca —
   arte mistura camadas; **Studio da marca** (`…/midia/midia/studio/`):
   templates c/ `requer:['turma']` (formação/depoimento/vagas/formatura)
   desabilitados c/ aviso, default cai no educativo, postagem via rota geral.
6. **Validação**: suíte 39→**50/50** (11 testes novos: invariantes, dedup por
   escopo, camadas, postagem da marca, ação agendadas, páginas staff);
   browser real: Mesa da marca (seletor + troca de camada), Studio da marca
   (capa de reel c/ foto da camada geral → postagem criada de ponta a ponta),
   Studio da turma (destaques pré-selecionados como antes + mistura c/ geral).
7. **Docs**: doc 03 §"Acervo em camadas", nota de correção de rumo no doc 10,
   `.context/{status,backend,decisoes}.md`.

## Percalços da sessão (pra não repetir)
- Smoke browser: canvas "tainted" ao exportar — era o `MEDIA_URL_BASE` de dev
  (default `http://localhost:8000`) cross-origin com o server de teste na
  8123. Não é bug do código; `.claude/launch.json` ficou com
  `MEDIA_URL_BASE=http://localhost:8123` pro server de preview.
- `alert()` de erro do Studio trava a aba do browser de teste (modal nativo).
- Artefatos de smoke (user `claude-smoke`, foto geral, postagem) criados e
  **apagados** ao final; banco dev ficou como estava (+ migração aplicada).

## Estado ao sair / handoff
- Spec 008 DONE (tracker em `specs/008-acervo-em-camadas/tasks.md`).
- **Nada commitado** (Daniel pede o commit).
- Próximos naturais: templates de conteúdo diário (divulgação de curso,
  instrutor em destaque, bastidores), calendário editorial sobre
  `agendada_para`, avaliações por curso no Depoimento (hoje requer turma),
  e as specs 006/007 (imagem/vídeo IA) que só ganham com o acervo geral.
