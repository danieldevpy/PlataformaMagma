# 2026-07-18 — Studio 2.0: correção de 4 desalinhamentos de UI/UX

## Prompt do Daniel (essência)
> Ajustes no Studio v2 depois do teste real:
> 1. Postagens da turma: virar accordion + overflow (com várias, sobrepõe e nem dá
>    pra criar novas). Mostrar no máximo 1 e scrollar pras próximas.
> 2. Capa de reel, modo "central": o título sai para fora da tela.
> 3. Educativo "erro × certo": o texto do erro comum e da forma certa não está alinhado.
> 4. Formação de turma: os botões das variantes ficam por baixo das fotos.
> "Percebi diversos desalinhamentos de UI/UX — teste e analise cada template e opção."

## Diagnóstico (reproduzido no browser, medindo geometria do DOM + renders PNG)
Dois dos quatro bugs eram a **mesma classe: estado residual de canvas / colapso de flex**.

1. **Postagens sem accordion/overflow** — `.postagens__list` sem `max-height`; a lista
   crescia sem teto, empurrava preview/ações e disparava o flex-shrink da coluna (ver #4).
2. **Capa de reel `central`** — `wrapLinhasMax` era chamado **antes de setar a fonte**;
   media com a fonte residual do logo (`bold 13.5px`), então "Prática de verdade" "cabia"
   em 1 linha que, renderizada a 128px, dava **1279px num canvas de 1080** (vazava ~200px
   de cada lado). O `inferior` já setava a fonte antes — por isso não bugava.
3. **Educativo `erro-certo`** — o helper compartilhado `spacedText` deixava
   `ctx.textAlign='left'` sem restaurar; o corpo do card CERTO era desenhado assumindo
   `center`, ficava ancorado no centro do card e **vazava pela direita**.
4. **Formação: variantes por baixo das fotos** — `.stage` rola (`overflow-y:auto`), mas
   seus filhos encolhiam: sob pressão vertical (bug #1) o `.stage__top` colapsava pra
   **height:0** e os thumbnails (90px) vazavam **por cima** da barra de variantes e do preview.

## Correções
- **`templates-engine.js`** — `spacedText`/`spacedTextLeft` agora salvam e **restauram**
  `textAlign`/`textBaseline` (fix de raiz do #3; blinda toda a família de templates contra
  esse vazamento). Regressão visual conferida em formacao/depoimento/vagas/formatura/
  educativo/capa_reel — eyebrows, títulos e rodapés seguem centralizados.
- **`templates/capa_reel.js`** — `central`: seta a fonte (128px) **antes** de medir;
  se não couber em 1 linha, cai pra 96px e requebra. Divisor dourado reposicionado abaixo
  da última linha (o cálculo antigo assumia 1 linha e caía sobre o texto).
- **`studio.css`** — `flex-shrink:0` só nas faixas AUXILIARES
  (`.stage__top,.variants,.stage__actions,.postagens`), nunca no `.stage__preview`:
  travar o preview inflava a caixa e criava um vão vazio enorme no 9:16 (regressão
  pega no 1º print do Daniel). O `.stage__preview` fica flexível com `min-height:360px`
  (piso pra não ficar minúsculo, sem inflar — o canvas usa `min(100%,…)` e acompanha).
  Postagens: `.postagens__list` com `max-height:320px; overflow-y:auto` + estilos de
  accordion (caret, chip de status, `.postagem-card__body` recolhível).
- **`studio.js`** — `renderPostagemCard` reestruturado: cabeçalho clicável (caret + título
  + chip de status sempre visível) e corpo recolhível (timeline+thumbs+ações). Accordion de
  **abertura única** (abrir um fecha os outros); só a postagem mais recente começa aberta.

## Validação
- Browser real (Django dev :8000, sessão admin, turma 027 com 8 fotos + 3 postagens).
- Screenshots do painel travam neste ambiente → verificado por **medição de geometria do
  DOM** e **renders PNG dos canvases** (inspecionados um a um):
  - #2 título agora quebra em 2 linhas a 96px, margens simétricas (~570px), dentro do canvas.
  - #3 texto do CERTO centralizado no card (margens ~100px), sem vazar.
  - #4 `.stage__top` = 90px (não colapsa), variantBar abaixo dos slides, preview com 713px.
  - #1 `max-height:320/overflow:auto`, 1 card aberto, demais com `display:none`, chips ok.
- Bateria de regressão dos 8 templates/variantes renderizou sem erro e sem desalinhamento.

## Estado ao sair / handoff
- 4 bugs corrigidos e verificados. Arquivos tocados: `static/midia/templates-engine.js`,
  `static/midia/templates/capa_reel.js`, `static/midia/studio.css`, `static/midia/studio.js`.
- **Sem commit** (aguardando o Daniel pedir). Nada de backend/migração mudou.
- Pendente do olho do dono: gerar postagens reais e conferir o accordion no fluxo de uso.
