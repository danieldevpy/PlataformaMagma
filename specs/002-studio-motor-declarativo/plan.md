# Plan 002 — como fazer

Referências: `docs/subsistemas/10-studio-2.0.md` §3 (contrato do template, exemplo
de `registrar()`), §8 (UX das telas). Base atual: `plataforma/backend/static/midia/`
(`templates-engine.js`, `studio.js`, `studio.html` em `backend/templates/midia/`).

## Arquitetura

1. `templates-engine.js` vira o **core**: `MagmaTemplates.FORMATOS`
   (`feed {w:1080,h:1080,margem:88}`, `story {w:1080,h:1920,zonaSegura:{topo:250,base:250}}`,
   `capa_reel {w:1080,h:1920}`), `MagmaTemplates.registrar(def)`,
   `MagmaTemplates.listar()`, `MagmaTemplates.obter(id)`, helpers de desenho
   compartilhados (símbolo, hexTexture, wrapText, cores C) expostos em
   `MagmaTemplates.helpers`, e o **adaptador browser**: `ready()` (fontes+símbolo),
   `carregarImagens(urls)`, `renderizar(templateId, formato, dados, assets) → canvas`,
   `exportarBlob(canvas)`.
2. **Regra-lei no topo do core** (comentário): função `desenhar(ctx, formato, dados,
   assets)` usa SOMENTE API Canvas 2D — nada de DOM — para rodar em node-canvas na
   spec 007. `assets` = `{simbolo, imagens: Map, hexPattern(ctx)}`.
3. `static/midia/templates/formacao.js` — primeiro template declarativo (porta 1:1
   das variantes atuais). `studio.html` carrega core antes dos templates.
4. `studio.js`: estado ganha `templateId` e `formatosSelecionados`; preview com
   toggle feed/story; export itera formatos × slides → todas as artes numa Postagem
   (título sufixado com formato na arte, ex.: `arte-story-01.png`).
5. `mvp-apps/studio/` NÃO é tocado (vira referência histórica de comparação).

## Riscos

- Regressão visual → comparar lado a lado com o MVP antes de dar DONE.
- Story não é "feed esticado": recompor blocos por formato dentro do mesmo
  `desenhar` via `formato.w/h` e zona segura.

## Constituição

§4 zero redesign (tokens/AGENTS.md), §5 entregável isolado, §6 sem mudança de API.
