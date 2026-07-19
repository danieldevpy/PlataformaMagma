/* ============================================================
   TEMPLATE — Capa de Reel
   Só o formato `capa_reel` (1080×1920, 9:16 por natureza — o vídeo do
   reel em si é fase 2, doc 10 §7.3). Foto + título curto (máx. 4
   palavras em destaque), selo Magma no canto, alto contraste
   (design-system/AGENTS.md §6).

   Variantes:
   - 'inferior' → foto tela cheia, título na base sobre gradiente
                  escuro (leitura rápida, estilo thumbnail)
   - 'central'  → foto com vinheta escura forte, título dourado
                  metálico centralizado (mais dramático/impacto)

   dados: { titulo, instagram, imgKey, variant, offsetY }

   Só usa `ctx` (Canvas 2D puro) e o que chega em `dados`/`assets` — sem
   APIs de DOM/carregamento aqui dentro (ver LEI no topo de
   templates-engine.js).
   ============================================================ */
(function (global) {
  'use strict';

  const M = global.MagmaTemplates;
  if (!M) throw new Error('templates/capa_reel.js requer MagmaTemplates (templates-engine.js) carregado antes.');
  const h = M.helpers;
  const C = h.C;

  const VARIANTES = ['inferior', 'central'];

  const CAMPOS = [
    { id: 'titulo', tipo: 'texto', rotulo: 'Título (máx. 4 palavras)' },
    { id: 'instagram', tipo: 'texto', rotulo: 'Instagram' },
  ];

  const TITULO_PADRAO = 'Prática de verdade';

  const LEGENDA_PADRAO =
    '🎬 {{curso}} — Turma {{turma}}. Sua carreira na saúde começa com prática de verdade. {{hashtags_curso}}';

  /* ---------------------------------------------------------
     Helpers locais
     --------------------------------------------------------- */

  /* quebra em linhas com teto (sem reticências — título curto por
     natureza; se estourar o teto, deixa a última linha como está). */
  function wrapLinhasMax(ctx, texto, maxWidth, maxLinhas) {
    const palavras = String(texto == null ? '' : texto).split(/\s+/).filter(Boolean);
    const linhas = [];
    let linha = '';
    for (const palavra of palavras) {
      const teste = linha ? `${linha} ${palavra}` : palavra;
      if (linha && ctx.measureText(teste).width > maxWidth) {
        linhas.push(linha);
        linha = palavra;
      } else {
        linha = teste;
      }
    }
    if (linha) linhas.push(linha);
    return linhas.slice(0, maxLinhas);
  }

  /* selo Magma compacto (símbolo + wordmark pequeno) — "canto" fica
     sempre dentro da zona segura de topo (250px) pra não ser coberto
     pela UI do Instagram/TikTok */
  function seloCanto(ctx, x, y, hSelo, simbolo) {
    h.logoLockup(ctx, x, y, hSelo, simbolo);
  }

  /* =========================================================
     VARIANTE 'inferior' — foto cheia, título na base
     ========================================================= */

  function inferior(ctx, W, H, d, assets) {
    h.drawPhoto(ctx, d.img, 0, 0, W, H, d.offsetY);

    const gTopo = ctx.createLinearGradient(0, 0, 0, 340);
    gTopo.addColorStop(0, 'rgba(10,16,36,0.55)');
    gTopo.addColorStop(1, 'rgba(10,16,36,0)');
    ctx.fillStyle = gTopo; ctx.fillRect(0, 0, W, 340);

    const gBase = ctx.createLinearGradient(0, H - 760, 0, H);
    gBase.addColorStop(0, 'rgba(9,14,32,0)');
    gBase.addColorStop(0.5, 'rgba(9,14,32,0.82)');
    gBase.addColorStop(1, 'rgba(9,14,32,0.97)');
    ctx.fillStyle = gBase; ctx.fillRect(0, H - 760, W, 760);

    seloCanto(ctx, 66, 300, 58, assets.simbolo);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 108px "Archivo"`;
    const linhas = wrapLinhasMax(ctx, d.titulo, W - 140, 3);
    const lh = 118;
    const startY = 1500 - ((linhas.length - 1) * lh) / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 6;
    ctx.fillStyle = C.white;
    linhas.forEach((linha, i) => ctx.fillText(linha, W / 2, startY + i * lh));
    ctx.restore();

    h.goldDivider(ctx, W / 2, startY + linhas.length * lh + 6, 130, true);

    if (d.instagram) {
      ctx.font = `700 34px "Archivo"`; ctx.fillStyle = C.goldLight;
      ctx.fillText(d.instagram, W / 2, startY + linhas.length * lh + 74);
    }
  }

  /* =========================================================
     VARIANTE 'central' — vinheta forte, título dourado metálico
     ========================================================= */

  function central(ctx, W, H, d, assets) {
    h.drawPhoto(ctx, d.img, 0, 0, W, H, d.offsetY);

    const v = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, H * 0.72);
    v.addColorStop(0, 'rgba(8,12,28,0.35)');
    v.addColorStop(0.6, 'rgba(8,12,28,0.72)');
    v.addColorStop(1, 'rgba(6,9,22,0.94)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    h.hexTexture(ctx, W, H, assets);

    ctx.textAlign = 'center';
    h.logoVertical(ctx, W / 2, 300, 90, assets.simbolo);

    // a fonte PRECISA estar setada antes de medir (measureText depende dela) —
    // senão a quebra é calculada com a fonte residual do logo (13px) e o título
    // "cabe" numa linha que, renderizada a 128px, vaza pra fora do 1080. Mede
    // primeiro no tamanho grande; se não couber em 1 linha, cai pra 96px e
    // requebra já no tamanho final.
    const maxW = W - 180;
    ctx.font = `900 128px "Archivo"`;
    let linhas = wrapLinhasMax(ctx, d.titulo, maxW, 3);
    let size = 128;
    if (linhas.length > 1) {
      size = 96;
      ctx.font = `900 ${size}px "Archivo"`;
      linhas = wrapLinhasMax(ctx, d.titulo, maxW, 3);
    }
    const lh = size * 1.12;
    const startY = H / 2 - ((linhas.length - 1) * lh) / 2;
    linhas.forEach((linha, i) => h.metalText3D(ctx, linha, W / 2, startY + i * lh, size, 1));

    // abaixo da ÚLTIMA linha (não do centro do bloco) — com 2 linhas o cálculo
    // antigo caía em cima do texto.
    const ultimaLinhaY = startY + (linhas.length - 1) * lh;
    h.goldDivider(ctx, W / 2, ultimaLinhaY + size * 0.78, 150, true);

    if (d.instagram) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 34px "Archivo"`; ctx.fillStyle = C.white;
      ctx.fillText(d.instagram, W / 2, H - 320);
    }
  }

  const VARIANTE_FN = { inferior, central };

  /* =========================================================
     desenhar(ctx, formato, dados, assets)
     ========================================================= */
  function desenhar(ctx, formato, dados, assets) {
    const img = (dados.imgKey != null && assets.imagens) ? assets.imagens.get(dados.imgKey) : null;
    const d = Object.assign(
      { titulo: TITULO_PADRAO, instagram: '', offsetY: 0.5, variant: 'inferior' },
      dados,
      { img }
    );
    const fn = VARIANTE_FN[d.variant] || VARIANTE_FN.inferior;
    fn(ctx, formato.w, formato.h, d, assets);
  }

  M.registrar({
    id: 'capa_reel',
    nome: 'Capa de Reel',
    descricao: 'Capa 9:16 pro reel — foto + título curto em destaque, selo Magma no canto.',
    formatos: ['capa_reel'],
    fontes: ['foto', 'campos'],
    campos: CAMPOS,
    variantes: VARIANTES,
    legendaPadrao: LEGENDA_PADRAO,
    desenhar,
  });
})(window);
