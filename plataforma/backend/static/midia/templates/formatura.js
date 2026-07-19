/* ============================================================
   TEMPLATE — Formatura / Celebração
   Foto grande da turma formada + faixa "Parabéns, Turma {{turma}}!" +
   CTA para a próxima turma (fecha o ciclo formado → lead).

   Variantes:
   - 'moldura' → fundo navy + textura hex, foto emoldurada (cantos
                 chanfrados + borda dourada dupla), texto acima/abaixo
   - 'full'    → foto ocupa o quadro inteiro, textos sobre gradientes
                 escuros no topo e na base (mais fotográfico)

   dados: { turma, proximaTurma, frase, instagram, whatsapp, imgKey,
            variant, offsetY }

   Só usa `ctx` (Canvas 2D puro) e o que chega em `dados`/`assets` — sem
   APIs de DOM/carregamento aqui dentro (ver LEI no topo de
   templates-engine.js).
   ============================================================ */
(function (global) {
  'use strict';

  const M = global.MagmaTemplates;
  if (!M) throw new Error('templates/formatura.js requer MagmaTemplates (templates-engine.js) carregado antes.');
  const h = M.helpers;
  const C = h.C;

  const VARIANTES = ['moldura', 'full'];

  const CAMPOS = [
    { id: 'turma', tipo: 'texto', rotulo: 'Nº da turma formada' },
    { id: 'proximaTurma', tipo: 'texto', rotulo: 'Nº da próxima turma (CTA)' },
    { id: 'frase', tipo: 'texto', rotulo: 'Frase de celebração' },
    { id: 'instagram', tipo: 'texto', rotulo: 'Instagram' },
    { id: 'whatsapp', tipo: 'texto', rotulo: 'WhatsApp' },
  ];

  const FRASE_PADRAO = 'Mais profissionais prontos para atuar de verdade.';

  const LEGENDA_PADRAO =
    '🎉 Parabéns, Turma {{turma}}! Mais um grupo formado em {{curso}}, pronto para atuar. ' +
    'Quer ser da próxima turma? Turmas aos sábados, feitas para quem trabalha. {{hashtags_curso}}';

  /* ---------------------------------------------------------
     Faixa de CTA para a próxima turma — mesma largura (1080) em
     feed e story, só muda o `top` de chamada.
     --------------------------------------------------------- */
  function ctaBanner(ctx, w, d, top) {
    const x = 70, ww = w - 140, hh = 96, r = 26;
    ctx.strokeStyle = h.goldGrad(ctx, top, top + hh);
    ctx.lineWidth = 3;
    h.roundRectPath(ctx, x, top, ww, hh, r); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 27px "Archivo"`; ctx.fillStyle = C.goldLight;
    const texto = d.proximaTurma
      ? `PRÓXIMA TURMA ${d.proximaTurma} — GARANTA SUA VAGA`
      : 'GARANTA SUA VAGA NA PRÓXIMA TURMA';
    ctx.fillText(texto, w / 2, top + 30);
    h.socialFooter(ctx, w, d.instagram, d.whatsapp, top + 68);
  }

  /* =========================================================
     VARIANTE 'moldura' — fundo navy, foto emoldurada, texto ao redor
     ========================================================= */

  function moldFeed(ctx, formato, d, assets) {
    const SIZE = formato.w;
    h.bgNavy(ctx, SIZE, SIZE, assets);
    h.logoLockup(ctx, 70, 58, 64, assets.simbolo);
    ctx.textAlign = 'center';
    h.spacedText(ctx, 'FORMATURA', SIZE / 2, 178, 28, 700, C.goldLight, 6);
    h.metalText3D(ctx, `TURMA ${d.turma}`.trim(), SIZE / 2, 282, 92, 1);
    h.goldDivider(ctx, SIZE / 2, 346, 220, true);
    h.framedPhoto(ctx, d.img, 74, 390, SIZE - 148, 496, 40, d.offsetY);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 700 33px "Archivo"`; ctx.fillStyle = C.white;
    h.wrapText(ctx, d.frase, SIZE / 2, 928, SIZE - 220, 42);
    ctaBanner(ctx, SIZE, d, 958);
  }

  function moldStory(ctx, formato, d, assets) {
    const W = formato.w, H = formato.h;
    h.bgNavy(ctx, W, H, assets);
    h.logoLockup(ctx, 70, 290, 64, assets.simbolo);
    ctx.textAlign = 'center';
    h.spacedText(ctx, 'FORMATURA', W / 2, 410, 28, 700, C.goldLight, 6);
    h.metalText3D(ctx, `TURMA ${d.turma}`.trim(), W / 2, 514, 92, 1);
    h.goldDivider(ctx, W / 2, 578, 220, true);
    h.framedPhoto(ctx, d.img, 74, 622, W - 148, 760, 40, d.offsetY);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 700 36px "Archivo"`; ctx.fillStyle = C.white;
    h.wrapText(ctx, d.frase, W / 2, 1448, W - 260, 46);
    ctaBanner(ctx, W, d, 1500);
  }

  /* =========================================================
     VARIANTE 'full' — foto tela cheia, textos sobre gradiente
     ========================================================= */

  function fullFeed(ctx, formato, d, assets) {
    const SIZE = formato.w;
    h.drawPhoto(ctx, d.img, 0, 0, SIZE, SIZE, d.offsetY);
    const gt = ctx.createLinearGradient(0, 0, 0, 420);
    gt.addColorStop(0, 'rgba(11,18,40,0.92)');
    gt.addColorStop(0.6, 'rgba(11,18,40,0.4)');
    gt.addColorStop(1, 'rgba(11,18,40,0)');
    ctx.fillStyle = gt; ctx.fillRect(0, 0, SIZE, 420);
    const gb = ctx.createLinearGradient(0, SIZE - 380, 0, SIZE);
    gb.addColorStop(0, 'rgba(11,18,40,0)');
    gb.addColorStop(0.5, 'rgba(11,18,40,0.8)');
    gb.addColorStop(1, 'rgba(11,18,40,0.96)');
    ctx.fillStyle = gb; ctx.fillRect(0, SIZE - 380, SIZE, 380);
    h.logoLockup(ctx, 66, 58, 68, assets.simbolo);
    ctx.textAlign = 'center';
    h.spacedText(ctx, 'FORMATURA', SIZE / 2, 190, 24, 700, C.goldLight, 6);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
    ctx.font = `900 62px "Archivo"`; ctx.textBaseline = 'middle'; ctx.fillStyle = C.white;
    h.wrapText(ctx, `PARABÉNS, TURMA ${d.turma}!`.trim(), SIZE / 2, 272, SIZE - 160, 70);
    ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 600 31px "Archivo"`; ctx.fillStyle = C.white;
    h.wrapText(ctx, d.frase, SIZE / 2, SIZE - 300, SIZE - 220, 40);
    ctaBanner(ctx, SIZE, d, SIZE - 186);
  }

  function fullStory(ctx, formato, d, assets) {
    const W = formato.w, H = formato.h;
    h.drawPhoto(ctx, d.img, 0, 0, W, H, d.offsetY);
    const gt = ctx.createLinearGradient(0, 0, 0, 620);
    gt.addColorStop(0, 'rgba(11,18,40,0.92)');
    gt.addColorStop(0.6, 'rgba(11,18,40,0.42)');
    gt.addColorStop(1, 'rgba(11,18,40,0)');
    ctx.fillStyle = gt; ctx.fillRect(0, 0, W, 620);
    const gb = ctx.createLinearGradient(0, H - 560, 0, H);
    gb.addColorStop(0, 'rgba(11,18,40,0)');
    gb.addColorStop(0.5, 'rgba(11,18,40,0.78)');
    gb.addColorStop(1, 'rgba(11,18,40,0.96)');
    ctx.fillStyle = gb; ctx.fillRect(0, H - 560, W, 560);
    h.logoLockup(ctx, 66, 290, 68, assets.simbolo);
    ctx.textAlign = 'center';
    h.spacedText(ctx, 'FORMATURA', W / 2, 430, 24, 700, C.goldLight, 6);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    ctx.font = `900 60px "Archivo"`; ctx.textBaseline = 'middle'; ctx.fillStyle = C.white;
    h.wrapText(ctx, `PARABÉNS, TURMA ${d.turma}!`.trim(), W / 2, 528, W - 220, 74);
    ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 600 34px "Archivo"`; ctx.fillStyle = C.white;
    h.wrapText(ctx, d.frase, W / 2, H - 460, W - 260, 44);
    ctaBanner(ctx, W, d, H - 350);
  }

  const FEED = { moldura: moldFeed, full: fullFeed };
  const STORY = { moldura: moldStory, full: fullStory };

  /* =========================================================
     desenhar(ctx, formato, dados, assets)
     ========================================================= */
  function desenhar(ctx, formato, dados, assets) {
    const img = (dados.imgKey != null && assets.imagens) ? assets.imagens.get(dados.imgKey) : null;
    const d = Object.assign(
      { turma: '', proximaTurma: '', frase: FRASE_PADRAO, instagram: '', whatsapp: '', offsetY: 0.5, variant: 'moldura' },
      dados,
      { img, frase: (dados && dados.frase) ? dados.frase : FRASE_PADRAO }
    );

    const dispatch = formato.id === 'story' ? STORY : FEED;
    const fn = dispatch[d.variant] || dispatch.moldura;
    fn(ctx, formato, d, assets);
  }

  M.registrar({
    id: 'formatura',
    nome: 'Formatura',
    descricao: 'Foto grande da turma formada + faixa de parabéns + CTA para a próxima turma.',
    formatos: ['feed', 'story'],
    fontes: ['fotos'],
    requer: ['turma'], // arte fala da turma (spec 008 — Studio da marca desabilita)
    campos: CAMPOS,
    variantes: VARIANTES,
    legendaPadrao: LEGENDA_PADRAO,
    desenhar,
  });
})(window);
