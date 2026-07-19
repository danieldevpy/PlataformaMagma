# Spec 003 — Studio: templates da campanha + kit + legenda com variáveis

> Fase A do plano mestre `docs/subsistemas/10-studio-2.0.md` (§4). Depende da 002.

## O quê / porquê

Cinco templates novos sobre o motor declarativo, priorizados para encher a turma
até 08/08: **Depoimento** (avaliações reais 4–5★ — prova social), **Vagas/Urgência**,
**Formatura**, **Educativo** (texto puro, garante constância) e **Capa de Reel**.
Mais as ferramentas transversais: legenda com variáveis (`{{curso}}`, `{{turma}}`,
`{{data_inicio}}`, `{{hashtags_curso}}`) e banco de hashtags por curso.

## Critérios de aceite

1. `GET /api/midia/turmas/<id>/avaliacoes/` lista avaliações aprovadas da turma
   (nome, estrelas, comentário, cargo) para o picker do Depoimento.
2. Cada template gera feed + story (Capa de Reel: só `capa_reel`), seguindo
   `design-system/AGENTS.md` (cores, tipografia, vermelho ≤ 2%, tom de voz §8).
3. Picker contextual por template: fotos (como hoje), avaliações (Depoimento) ou
   só campos (Vagas/Educativo — dados da turma pré-preenchidos).
4. Legenda padrão de cada template com variáveis resolvidas por
   `static/midia/marca.js` (hashtags fixas + por curso, dados de contato oficiais).
5. Vermelho usado APENAS em badge de urgência; símbolo = Estrela da Vida oficial.

## Critério de aceite do gestor

Daniel escolhe "Depoimento", toca numa avaliação 5★ real, gera feed+story e
publica — sem digitar nada além de ajustes finos.
