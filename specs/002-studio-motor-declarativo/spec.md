# Spec 002 — Studio: motor de templates declarativo + multi-formato

> Fase A do plano mestre `docs/subsistemas/10-studio-2.0.md` (§3, §8).

## O quê / porquê

O motor atual (`plataforma/backend/static/midia/templates-engine.js`) é acoplado a
1080×1080 e ao DOM. Refatorar para: templates **declarativos e registrados**
(1 template = 1 arquivo), funções de desenho **puras** (Canvas 2D só, sem DOM),
formatos `feed` (1080²) e `story` (1080×1920, zona segura 250px topo/base) e
`capa_reel`. É a fundação de todos os templates novos (spec 003) e do render
server-side futuro (spec 007) — sem isso, cada template novo é retrabalho.

## Critérios de aceite

1. Arte "Formação de Turma" no formato feed sai **visualmente idêntica** à atual
   (4 variantes moldura/lateral/full/classic, sorteio saco embaralhado).
2. Formação de Turma ganha formato **story 9:16** respeitando zona segura.
3. UI do Studio: seletor de modo (cards de template) + toggle de formato no
   preview + exportação por formato selecionado (kit) → artes na mesma Postagem.
4. Nenhuma função de desenho referencia `document`, `Image`, `fetch` ou `Blob` —
   tudo injetado (lint manual via grep no PR).
5. Fluxo atual completo continua funcionando: picker fotos ⭐ pré-selecionadas,
   offsets, ★ fechamento, exportar → Postagem rascunho → ZIP/legenda/status.

## Critério de aceite do gestor

Daniel abre o Studio da turma no celular, escolhe "Formação de Turma", gera
feed + story num clique só e baixa o ZIP com todas as artes.
