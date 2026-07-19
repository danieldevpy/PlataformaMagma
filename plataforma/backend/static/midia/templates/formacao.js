/* ============================================================
   TEMPLATE — Formação de Turma
   Carrossel: capa → fotos da turma (variantes moldura/lateral/full/
   classic, sorteio "saco embaralhado") → fechamento.

   Porta 1:1 do motor anterior (feed = visualmente idêntico) e ganha
   o formato story (1080×1920, zona segura 250px topo/base — recompõe
   os blocos, não estica o feed).

   Só usa `ctx` (Canvas 2D puro) e o que chega em `dados`/`assets` — sem
   APIs de DOM/carregamento aqui dentro (ver LEI no topo de
   templates-engine.js).
   ============================================================ */
(function (global) {
  'use strict';

  const M = global.MagmaTemplates;
  if (!M) throw new Error('templates/formacao.js requer MagmaTemplates (templates-engine.js) carregado antes.');
  const h = M.helpers;
  const C = h.C;

  const VARIANTES = ['moldura', 'lateral', 'full', 'classic'];

  const CAMPOS = [
    { id: 'turma', tipo: 'texto', rotulo: 'Nº da turma' },
    { id: 'frase', tipo: 'texto', rotulo: 'Frase de fechamento' },
    { id: 'instagram', tipo: 'texto', rotulo: 'Instagram' },
    { id: 'whatsapp', tipo: 'texto', rotulo: 'WhatsApp' },
  ];

  const LEGENDA_PADRAO = '🎓 Turma {{codigo}} formada! Parabéns aos nossos alunos de {{curso}}. #magmacursos #aph';

  /* =========================================================
     desenhar(ctx, formato, dados, assets)
     dados: { tipo: 'cover'|'photo'|'closing', turma, frase, instagram,
              whatsapp, variant, offsetY, imgKey }
     assets: { simbolo, imagens: Map, hexPattern(ctx) }
     ========================================================= */
  function desenhar(ctx, formato, dados, assets) {
    const img = (dados.imgKey != null && assets.imagens) ? assets.imagens.get(dados.imgKey) : null;
    const d = Object.assign({ turma: '', frase: '', instagram: '', whatsapp: '', offsetY: 0.5, variant: 'moldura' }, dados, { img });

    const dispatch = formato.id === 'story' ? STORY : FEED;
    const fn = dispatch[d.tipo] || dispatch.cover;
    fn(ctx, formato, d, assets);
  }

  /* =========================================================
     FEED (1080×1080) — porte pixel-a-pixel do motor anterior
     ========================================================= */

  function feedCover(ctx, formato, d, assets) {
    const SIZE = formato.w;
    h.coverBg(ctx, SIZE, SIZE, assets);
    const symH = 150, symW = symH * (100 / 110);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
    if (assets.simbolo) ctx.drawImage(assets.simbolo, (SIZE - symW) / 2, 92, symW, symH);
    ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
    ctx.font = `900 88px "Archivo"`; ctx.fillStyle = C.white;
    ctx.fillText('MAGMA', SIZE / 2, 298);
    ctx.restore();
    h.spacedText(ctx, 'CURSOS', SIZE / 2, 348, 30, 700, C.white, 20);
    h.metalText3D(ctx, 'TURMA', SIZE / 2, 515, 150, 0.92);
    h.lightStreak(ctx, SIZE / 2, 900, 320, 9);
    h.metalText3D(ctx, d.turma, SIZE / 2, 748, 300, 1);
    h.flare(ctx, 858, 452, 62, 0.95);
    h.flare(ctx, 904, 700, 40, 0.7);
    h.flare(ctx, 250, 812, 24, 0.5);
    h.goldDivider(ctx, SIZE / 2, 942, 320, true);
    h.socialFooter(ctx, SIZE, d.instagram, d.whatsapp, 1002);
  }

  const FEED_PHOTO = {};

  FEED_PHOTO.moldura = function (ctx, formato, d, assets) {
    const SIZE = formato.w;
    h.bgNavy(ctx, SIZE, SIZE, assets);
    h.logoLockup(ctx, 70, 66, 74, assets.simbolo);
    h.spacedTextLeft(ctx, `Turma ${d.turma}`, 74, 208, 34, 700, C.goldLight, 2);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(76, 236); ctx.lineTo(250, 236); ctx.stroke();
    h.framedPhoto(ctx, d.img, 76, 274, SIZE - 152, 660, 46, d.offsetY);
    h.cornerFlourish(ctx, 1010, 60, [1, 1]);
    h.cornerFlourish(ctx, 70, 1020, [-1, -1]);
    h.socialFooter(ctx, SIZE, d.instagram, d.whatsapp, 1010);
  };

  FEED_PHOTO.classic = function (ctx, formato, d, assets) {
    const SIZE = formato.w;
    h.bgNavy(ctx, SIZE, SIZE, assets);
    h.logoLockup(ctx, 70, 70, 76, assets.simbolo);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    ctx.font = `800 46px "Archivo"`;
    const wn = ctx.measureText(d.turma).width;
    ctx.fillStyle = C.goldLight; ctx.fillText(d.turma, SIZE - 76, 116);
    ctx.font = `600 42px "Archivo"`;
    ctx.fillStyle = C.white; ctx.fillText('Turma', SIZE - 76 - wn - 12, 116);
    const fx = 74, fy = 250, fw = SIZE - 148, fh = 560;
    ctx.save(); h.roundRectPath(ctx, fx, fy, fw, fh, 6); ctx.clip();
    h.drawPhoto(ctx, d.img, fx, fy, fw, fh, d.offsetY); ctx.restore();
    ctx.strokeStyle = h.goldGrad(ctx, fy, fy + fh); ctx.lineWidth = 3;
    h.roundRectPath(ctx, fx, fy, fw, fh, 6); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,227,196,.4)'; ctx.lineWidth = 1.5;
    h.roundRectPath(ctx, fx + 9, fy + 9, fw - 18, fh - 18, 4); ctx.stroke();
    h.cornerBrackets(ctx, fx - 7, fy - 7, fw + 14, fh + 14, 36);
    h.socialFooter(ctx, SIZE, d.instagram, d.whatsapp, 906);
  };

  FEED_PHOTO.full = function (ctx, formato, d, assets) {
    const SIZE = formato.w;
    h.drawPhoto(ctx, d.img, 0, 0, SIZE, SIZE, d.offsetY);
    const gt = ctx.createLinearGradient(0, 0, 0, 400);
    gt.addColorStop(0, 'rgba(11,18,40,0.92)');
    gt.addColorStop(0.55, 'rgba(11,18,40,0.42)');
    gt.addColorStop(1, 'rgba(11,18,40,0)');
    ctx.fillStyle = gt; ctx.fillRect(0, 0, SIZE, 400);
    const gb = ctx.createLinearGradient(0, SIZE - 340, 0, SIZE);
    gb.addColorStop(0, 'rgba(11,18,40,0)');
    gb.addColorStop(0.5, 'rgba(11,18,40,0.78)');
    gb.addColorStop(1, 'rgba(11,18,40,0.96)');
    ctx.fillStyle = gb; ctx.fillRect(0, SIZE - 340, SIZE, 340);
    h.logoLockup(ctx, 66, 58, 72, assets.simbolo);
    h.turmaPill(ctx, d.turma, SIZE - 66, 96);
    h.socialFooter(ctx, SIZE, d.instagram, d.whatsapp, 1004);
  };

  FEED_PHOTO.lateral = function (ctx, formato, d, assets) {
    const SIZE = formato.w;
    h.bgNavy(ctx, SIZE, SIZE, assets);
    const panelW = 316, footerH = 104;
    const px = panelW, py = 0, pw = SIZE - panelW, ph = SIZE - footerH;
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    h.drawPhoto(ctx, d.img, px, py, pw, ph, d.offsetY); ctx.restore();
    const pg = ctx.createLinearGradient(0, 0, panelW, SIZE);
    pg.addColorStop(0, '#182541'); pg.addColorStop(1, '#0f1c38');
    ctx.fillStyle = pg; h.panelPath(ctx, 0, 0, panelW, SIZE - footerH, 56); ctx.fill();
    ctx.strokeStyle = 'rgba(220,185,106,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(panelW, 56); ctx.lineTo(panelW, SIZE - footerH); ctx.stroke();
    h.logoVertical(ctx, panelW / 2, 70, 116, assets.simbolo);
    h.verticalTurma(ctx, panelW, d.turma, 700);
    ctx.fillStyle = C.navyDeep; ctx.fillRect(0, SIZE - footerH, SIZE, footerH);
    ctx.strokeStyle = 'rgba(220,185,106,.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, SIZE - footerH); ctx.lineTo(SIZE, SIZE - footerH); ctx.stroke();
    h.socialFooter(ctx, SIZE, d.instagram, d.whatsapp, SIZE - footerH / 2);
  };

  function feedPhoto(ctx, formato, d, assets) {
    (FEED_PHOTO[d.variant] || FEED_PHOTO.moldura)(ctx, formato, d, assets);
  }

  function feedClosing(ctx, formato, d, assets) {
    const SIZE = formato.w;
    h.bgNavy(ctx, SIZE, SIZE, assets);
    h.logoLockup(ctx, 70, 58, 64, assets.simbolo);
    ctx.textAlign = 'center';
    h.spacedText(ctx, 'TURMA', SIZE / 2, 210, 96, 900, C.white, 4);
    h.metal3D(ctx, d.turma, SIZE / 2, 350, 200, 1);
    h.goldDivider(ctx, SIZE / 2, 452, 190, false);
    h.drawStar(ctx, SIZE / 2, 452, 13, C.goldLight);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 700 52px "Archivo"`; ctx.fillStyle = C.white;
    ctx.fillText(d.frase, SIZE / 2, 520);
    h.framedPhoto(ctx, d.img, 150, 580, SIZE - 300, 320, 34, d.offsetY);
    ctaPillFeed(ctx, SIZE, d, 940);
  }

  function ctaPillFeed(ctx, SIZE, d, top) {
    const x = 70, w = SIZE - 140, hh = 96, r = 26;
    ctx.strokeStyle = h.goldGrad(ctx, top, top + hh);
    ctx.lineWidth = 3;
    h.roundRectPath(ctx, x, top, w, hh, r); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 30px "Archivo"`; ctx.fillStyle = C.goldLight;
    ctx.fillText('FAÇA PARTE DA PRÓXIMA TURMA!', SIZE / 2, top + 30);
    h.socialFooter(ctx, SIZE, d.instagram, d.whatsapp, top + 68);
  }

  const FEED = { cover: feedCover, photo: feedPhoto, closing: feedClosing };

  /* =========================================================
     STORY (1080×1920, zona segura 250px topo/base) — recomposição
     dos mesmos blocos: foto ocupa mais altura, textos reposicionados
     para dentro da área segura (250 a h-250).
     ========================================================= */

  function storyCover(ctx, formato, d, assets) {
    const W = formato.w, H = formato.h;
    h.coverBg(ctx, W, H, assets);
    const symH = 160, symW = symH * (100 / 110);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
    if (assets.simbolo) ctx.drawImage(assets.simbolo, (W - symW) / 2, 300, symW, symH);
    ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
    ctx.font = `900 88px "Archivo"`; ctx.fillStyle = C.white;
    ctx.fillText('MAGMA', W / 2, 566);
    ctx.restore();
    h.spacedText(ctx, 'CURSOS', W / 2, 616, 30, 700, C.white, 20);
    h.metalText3D(ctx, 'TURMA', W / 2, 800, 140, 0.92);
    h.lightStreak(ctx, W / 2, 1060, 300, 9);
    h.metalText3D(ctx, d.turma, W / 2, 1180, 230, 1);
    h.flare(ctx, 858, 700, 56, 0.9);
    h.flare(ctx, 900, 980, 36, 0.65);
    h.flare(ctx, 220, 1280, 22, 0.5);
    h.goldDivider(ctx, W / 2, 1500, 300, true);
    h.socialFooter(ctx, W, d.instagram, d.whatsapp, 1560);
  }

  const STORY_PHOTO = {};

  STORY_PHOTO.moldura = function (ctx, formato, d, assets) {
    const W = formato.w, H = formato.h;
    h.bgNavy(ctx, W, H, assets);
    h.logoLockup(ctx, 70, 290, 74, assets.simbolo);
    h.spacedTextLeft(ctx, `Turma ${d.turma}`, 74, 432, 34, 700, C.goldLight, 2);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(76, 460); ctx.lineTo(250, 460); ctx.stroke();
    h.framedPhoto(ctx, d.img, 76, 498, W - 152, 1030, 46, d.offsetY);
    h.cornerFlourish(ctx, 1010, 280, [1, 1]);
    h.cornerFlourish(ctx, 70, H - 280, [-1, -1]);
    h.socialFooter(ctx, W, d.instagram, d.whatsapp, 1600);
  };

  STORY_PHOTO.classic = function (ctx, formato, d, assets) {
    const W = formato.w, H = formato.h;
    h.bgNavy(ctx, W, H, assets);
    h.logoLockup(ctx, 70, 290, 76, assets.simbolo);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    ctx.font = `800 46px "Archivo"`;
    const wn = ctx.measureText(d.turma).width;
    ctx.fillStyle = C.goldLight; ctx.fillText(d.turma, W - 76, 336);
    ctx.font = `600 42px "Archivo"`;
    ctx.fillStyle = C.white; ctx.fillText('Turma', W - 76 - wn - 12, 336);
    const fx = 74, fy = 460, fw = W - 148, fh = 1020;
    ctx.save(); h.roundRectPath(ctx, fx, fy, fw, fh, 6); ctx.clip();
    h.drawPhoto(ctx, d.img, fx, fy, fw, fh, d.offsetY); ctx.restore();
    ctx.strokeStyle = h.goldGrad(ctx, fy, fy + fh); ctx.lineWidth = 3;
    h.roundRectPath(ctx, fx, fy, fw, fh, 6); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,227,196,.4)'; ctx.lineWidth = 1.5;
    h.roundRectPath(ctx, fx + 9, fy + 9, fw - 18, fh - 18, 4); ctx.stroke();
    h.cornerBrackets(ctx, fx - 7, fy - 7, fw + 14, fh + 14, 36);
    h.socialFooter(ctx, W, d.instagram, d.whatsapp, 1600);
  };

  STORY_PHOTO.full = function (ctx, formato, d, assets) {
    const W = formato.w, H = formato.h;
    h.drawPhoto(ctx, d.img, 0, 0, W, H, d.offsetY);
    const gt = ctx.createLinearGradient(0, 0, 0, 560);
    gt.addColorStop(0, 'rgba(11,18,40,0.92)');
    gt.addColorStop(0.6, 'rgba(11,18,40,0.42)');
    gt.addColorStop(1, 'rgba(11,18,40,0)');
    ctx.fillStyle = gt; ctx.fillRect(0, 0, W, 560);
    const gb = ctx.createLinearGradient(0, H - 460, 0, H);
    gb.addColorStop(0, 'rgba(11,18,40,0)');
    gb.addColorStop(0.5, 'rgba(11,18,40,0.78)');
    gb.addColorStop(1, 'rgba(11,18,40,0.96)');
    ctx.fillStyle = gb; ctx.fillRect(0, H - 460, W, 460);
    h.logoLockup(ctx, 66, 290, 72, assets.simbolo);
    h.turmaPill(ctx, d.turma, W - 66, 326);
    h.socialFooter(ctx, W, d.instagram, d.whatsapp, 1600);
  };

  STORY_PHOTO.lateral = function (ctx, formato, d, assets) {
    const W = formato.w, H = formato.h;
    const panelW = 316;
    h.bgNavy(ctx, W, H, assets);
    ctx.save(); ctx.beginPath(); ctx.rect(panelW, 0, W - panelW, H); ctx.clip();
    h.drawPhoto(ctx, d.img, panelW, 0, W - panelW, H, d.offsetY); ctx.restore();
    // esmaece a base da foto pra legenda social continuar dentro da zona segura
    const gb = ctx.createLinearGradient(0, H - 460, 0, H);
    gb.addColorStop(0, 'rgba(11,18,40,0)');
    gb.addColorStop(0.55, 'rgba(11,18,40,0.72)');
    gb.addColorStop(1, 'rgba(11,18,40,0.94)');
    ctx.fillStyle = gb; ctx.fillRect(panelW, H - 460, W - panelW, 460);
    const pg = ctx.createLinearGradient(0, 0, panelW, H);
    pg.addColorStop(0, '#182541'); pg.addColorStop(1, '#0f1c38');
    ctx.fillStyle = pg; h.panelPath(ctx, 0, 0, panelW, H, 56); ctx.fill();
    ctx.strokeStyle = 'rgba(220,185,106,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(panelW, 56); ctx.lineTo(panelW, H); ctx.stroke();
    h.logoVertical(ctx, panelW / 2, 290, 116, assets.simbolo);
    h.verticalTurma(ctx, panelW, d.turma, H / 2);
    h.socialFooter(ctx, W, d.instagram, d.whatsapp, 1600);
  };

  function storyPhoto(ctx, formato, d, assets) {
    (STORY_PHOTO[d.variant] || STORY_PHOTO.moldura)(ctx, formato, d, assets);
  }

  function storyClosing(ctx, formato, d, assets) {
    const W = formato.w, H = formato.h;
    h.bgNavy(ctx, W, H, assets);
    h.logoLockup(ctx, 70, 290, 64, assets.simbolo);
    ctx.textAlign = 'center';
    h.spacedText(ctx, 'TURMA', W / 2, 460, 96, 900, C.white, 4);
    h.metal3D(ctx, d.turma, W / 2, 600, 200, 1);
    h.goldDivider(ctx, W / 2, 702, 190, false);
    h.drawStar(ctx, W / 2, 702, 13, C.goldLight);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 700 52px "Archivo"`; ctx.fillStyle = C.white;
    ctx.fillText(d.frase, W / 2, 770);
    h.framedPhoto(ctx, d.img, 90, 840, W - 180, 620, 40, d.offsetY);
    ctaPillStory(ctx, W, d, 1500);
  }

  function ctaPillStory(ctx, W, d, top) {
    const x = 70, w = W - 140, hh = 96, r = 26;
    ctx.strokeStyle = h.goldGrad(ctx, top, top + hh);
    ctx.lineWidth = 3;
    h.roundRectPath(ctx, x, top, w, hh, r); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 30px "Archivo"`; ctx.fillStyle = C.goldLight;
    ctx.fillText('FAÇA PARTE DA PRÓXIMA TURMA!', W / 2, top + 30);
    h.socialFooter(ctx, W, d.instagram, d.whatsapp, top + 68);
  }

  const STORY = { cover: storyCover, photo: storyPhoto, closing: storyClosing };

  M.registrar({
    id: 'formacao',
    nome: 'Formação de Turma',
    descricao: 'Carrossel de fotos da turma formada — capa, fotos e fechamento.',
    formatos: ['feed', 'story'],
    fontes: ['fotos'],
    requer: ['turma'], // arte fala da turma (spec 008 — Studio da marca desabilita)
    campos: CAMPOS,
    variantes: VARIANTES,
    legendaPadrao: LEGENDA_PADRAO,
    desenhar,
  });
})(window);
