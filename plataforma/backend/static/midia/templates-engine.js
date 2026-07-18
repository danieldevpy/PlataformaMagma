/* ============================================================
   MAGMA STUDIO — motor de renderização (canvas puro)
   Cada template desenha uma arte 1080×1080 seguindo o design system.

   Porta 1:1 de mvp-apps/studio/montar-templates/app/js/templates.js —
   motor intocável (T3, spec 09-acervo-studio-postagem.md). Não editar
   sem também atualizar o MVP de origem.
   ============================================================ */
(function (global) {
  'use strict';

  const SIZE = 1080;

  const C = {
    navyDeep: '#101c38', navy: '#1b2a4d', navySoft: '#24365e',
    gold: '#b8933f', goldLight: '#dcb96a', goldPale: '#f0e3c4', goldDeep: '#8a6a1f',
    red: '#c8102e', white: '#ffffff',
  };

  /* Símbolo (Estrela da Vida) — SVG só de formas, rasteriza sem depender de fonte */
  const SYMBOL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110">
    <polygon points="50,8 90,31 90,79 50,102 10,79 10,31" fill="#232c3d" stroke="#232c3d" stroke-width="12" stroke-linejoin="round"/>
    <polygon points="50,15 84.5,35 84.5,75 50,95 15.5,75 15.5,35" fill="#ffffff" stroke="#ffffff" stroke-width="7" stroke-linejoin="round"/>
    <polygon points="50,19 81,37 81,73 50,91 19,73 19,37" fill="#c8102e" stroke="#c8102e" stroke-width="7" stroke-linejoin="round"/>
    <g transform="translate(50,55)">
      <g fill="#ffffff">
        <rect x="-9" y="-27" width="18" height="54" rx="3.5"/>
        <rect x="-9" y="-27" width="18" height="54" rx="3.5" transform="rotate(60)"/>
        <rect x="-9" y="-27" width="18" height="54" rx="3.5" transform="rotate(-60)"/>
      </g>
      <g fill="#1d4f91">
        <rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4"/>
        <rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4" transform="rotate(60)"/>
        <rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4" transform="rotate(-60)"/>
      </g>
      <circle cx="0" cy="-17.5" r="3.1" fill="#ffffff"/>
      <rect x="-1.7" y="-15" width="3.4" height="33" rx="1.7" fill="#ffffff"/>
      <path d="M-5 -10 C 6 -7.5, 6 -3.5, 0 -1.5 C -6 0.5, -6 4.5, 0 6.5 C 5 8.2, 5 11.5, -3 13.5"
            fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round"/>
    </g>
  </svg>`;

  let symbolImg = null;
  let hexPattern = null;

  /* ---------- Setup assíncrono (fontes + símbolo) ---------- */
  function ready() {
    const fonts = ('fonts' in document) ? Promise.all([
      document.fonts.load('900 200px "Archivo"'),
      document.fonts.load('800 100px "Archivo"'),
      document.fonts.load('700 60px "Archivo"'),
      document.fonts.load('italic 700 60px "Archivo"'),
      document.fonts.load('700 40px "Inter"'),
    ]).catch(() => {}) : Promise.resolve();

    const sym = new Promise((res) => {
      const blob = new Blob([SYMBOL_SVG], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { symbolImg = img; res(); };
      img.onerror = () => res();
      img.src = url;
    });

    return Promise.all([fonts, sym]);
  }

  /* ---------- Helpers ---------- */
  function hexTexture(ctx) {
    if (!hexPattern) {
      const t = document.createElement('canvas');
      t.width = 120; t.height = 104;
      const c = t.getContext('2d');
      c.strokeStyle = 'rgba(220,185,106,0.05)';
      c.lineWidth = 1;
      const hex = (ox, oy) => {
        c.beginPath();
        c.moveTo(ox + 30, oy); c.lineTo(ox + 60, oy); c.lineTo(ox + 75, oy + 26);
        c.lineTo(ox + 60, oy + 52); c.lineTo(ox + 30, oy + 52); c.lineTo(ox + 15, oy + 26);
        c.closePath(); c.stroke();
      };
      hex(0, 0); hex(60, 26); hex(-60, 26); hex(0, -52);
      hexPattern = ctx.createPattern(t, 'repeat');
    }
    ctx.fillStyle = hexPattern;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  function bgNavy(ctx) {
    const g = ctx.createRadialGradient(SIZE * 0.78, -SIZE * 0.15, 0, SIZE * 0.78, -SIZE * 0.15, SIZE * 1.25);
    g.addColorStop(0, '#31456f');
    g.addColorStop(0.45, C.navy);
    g.addColorStop(1, C.navyDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
    hexTexture(ctx);
  }

  function goldGrad(ctx, yTop, yBot) {
    const g = ctx.createLinearGradient(0, yTop, 0, yBot);
    g.addColorStop(0, '#f7e7b8');
    g.addColorStop(0.42, C.goldLight);
    g.addColorStop(0.55, C.gold);
    g.addColorStop(0.78, C.goldDeep);
    g.addColorStop(1, '#d8b463');
    return g;
  }

  /* texto com tracking manual, centralizado em cx */
  function spacedText(ctx, text, cx, y, size, weight, fill, spacing, family) {
    family = family || 'Archivo';
    ctx.font = `${weight} ${size}px "${family}"`;
    ctx.textBaseline = 'middle';
    const chars = text.split('');
    let total = 0;
    for (const ch of chars) total += ctx.measureText(ch).width + spacing;
    total -= spacing;
    let x = cx - total / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = fill;
    for (const ch of chars) {
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width + spacing;
    }
    return total;
  }

  /* número/palavra em ouro metálico com relevo 3D */
  function metal3D(ctx, text, cx, y, size, squeeze) {
    squeeze = squeeze || 1;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${size}px "Archivo"`;
    ctx.translate(cx, y);
    ctx.scale(squeeze, 1);
    const depth = Math.round(size * 0.055);
    ctx.fillStyle = '#4a3a12';
    for (let i = depth; i > 0; i--) ctx.fillText(text, i * 0.35, i);
    ctx.fillStyle = goldGrad(ctx, -size * 0.55, size * 0.42);
    ctx.fillText(text, 0, 0);
    ctx.lineWidth = Math.max(1, size * 0.008);
    ctx.strokeStyle = 'rgba(255,246,222,.55)';
    ctx.strokeText(text, 0, 0);
    ctx.restore();
  }

  function logoLockup(ctx, x, y, h, align) {
    // símbolo + "MAGMA / CURSOS" na horizontal. (x,y) = topo-esquerda do símbolo
    const symW = h * (100 / 110);
    if (symbolImg) ctx.drawImage(symbolImg, x, y, symW, h);
    const tx = x + symW + h * 0.28;
    const mid = y + h * 0.5;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `900 ${h * 0.52}px "Archivo"`;
    ctx.fillStyle = C.white;
    ctx.fillText('MAGMA', tx, mid + h * 0.03);
    spacedTextLeft(ctx, 'CURSOS', tx, mid + h * 0.4, h * 0.19, 700, C.white, h * 0.09);
  }

  function spacedTextLeft(ctx, text, x, y, size, weight, fill, spacing) {
    ctx.font = `${weight} ${size}px "Archivo"`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = fill;
    let cx = x;
    for (const ch of text.split('')) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + spacing;
    }
  }

  function cutRectPath(ctx, x, y, w, h, cut) {
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w - cut, y);
    ctx.lineTo(x + w, y + cut);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x + cut, y + h);
    ctx.lineTo(x, y + h - cut);
    ctx.lineTo(x, y + cut);
    ctx.closePath();
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* foto preenchendo o quadro, com deslocamento vertical (0=topo … 0.5=centro … 1=base) */
  function drawPhoto(ctx, img, x, y, w, h, offsetY) {
    if (!img) { ctx.fillStyle = '#26344f'; ctx.fillRect(x, y, w, h); return; }
    const v = (offsetY == null) ? 0.5 : Math.max(0, Math.min(1, offsetY));
    const ir = img.width / img.height, fr = w / h;
    let sx, sy, sw, sh;
    if (ir > fr) { sh = img.height; sw = sh * fr; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / fr; sx = 0; sy = (img.height - sh) * v; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  /* moldura de foto com cantos chanfrados + borda dupla dourada */
  function framedPhoto(ctx, img, x, y, w, h, cut, offsetY) {
    ctx.save();
    // sombra
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 34; ctx.shadowOffsetY = 16;
    cutRectPath(ctx, x, y, w, h, cut);
    ctx.fillStyle = C.navyDeep;
    ctx.fill();
    ctx.restore();

    ctx.save();
    cutRectPath(ctx, x, y, w, h, cut);
    ctx.clip();
    drawPhoto(ctx, img, x, y, w, h, offsetY);
    ctx.restore();

    // borda externa grossa + filete interno
    ctx.strokeStyle = goldGrad(ctx, y, y + h);
    ctx.lineWidth = 7;
    cutRectPath(ctx, x, y, w, h, cut); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,227,196,.45)';
    ctx.lineWidth = 2;
    cutRectPath(ctx, x + 9, y + 9, w - 18, h - 18, cut * 0.72); ctx.stroke();
  }

  /* --- ícones sociais --- */
  function igIcon(ctx, cx, cy, s, color) {
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = s * 0.08;
    roundRectPath(ctx, cx - s / 2, cy - s / 2, s, s, s * 0.28); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.26, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + s * 0.28, cy - s * 0.28, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function waIcon(ctx, cx, cy, s, color) {
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = s * 0.08;
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, 0, Math.PI * 2); ctx.stroke();
    // fone
    ctx.lineWidth = s * 0.13; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx - s * 0.02, cy - s * 0.02, s * 0.24, Math.PI * 0.15, Math.PI * 0.62);
    ctx.stroke();
    ctx.restore();
  }

  function socialFooter(ctx, insta, zap, y) {
    const s = 34;
    ctx.textBaseline = 'middle';
    ctx.font = `600 30px "Archivo"`;
    const gapIcon = 16, blockGap = 70;
    const wInsta = ctx.measureText(insta).width;
    const wZap = ctx.measureText(zap).width;
    const totalW = s + gapIcon + wInsta + blockGap + s + gapIcon + wZap;
    let x = (SIZE - totalW) / 2;
    igIcon(ctx, x + s / 2, y, s, C.goldLight);
    x += s + gapIcon;
    ctx.textAlign = 'left'; ctx.fillStyle = C.white; ctx.fillText(insta, x, y);
    x += wInsta + blockGap;
    waIcon(ctx, x + s / 2, y, s, C.goldLight);
    x += s + gapIcon;
    ctx.fillStyle = C.white; ctx.fillText(zap, x, y);
  }

  function goldDivider(ctx, cy, halfLen, withHex) {
    const cx = SIZE / 2;
    const g = ctx.createLinearGradient(cx - halfLen, 0, cx + halfLen, 0);
    g.addColorStop(0, 'rgba(184,147,63,0)');
    g.addColorStop(0.5, C.goldLight);
    g.addColorStop(1, 'rgba(184,147,63,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 2;
    const gap = withHex ? 26 : 0;
    ctx.beginPath(); ctx.moveTo(cx - halfLen, cy); ctx.lineTo(cx - gap, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + halfLen, cy); ctx.stroke();
    if (withHex) {
      ctx.strokeStyle = C.goldLight; ctx.lineWidth = 2;
      const r = 13;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + i * Math.PI / 3;
        const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    }
  }

  function cornerFlourish(ctx, x, y, dir) {
    // três traços diagonais dourados no canto (dir: [sx,sy])
    ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const o = 22 + i * 20;
      ctx.globalAlpha = 1 - i * 0.22;
      ctx.beginPath();
      ctx.moveTo(x + dir[0] * o, y);
      ctx.lineTo(x, y + dir[1] * o);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* --- efeitos dramáticos da CAPA --- */
  function coverBg(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, SIZE);
    g.addColorStop(0, '#0b1024');
    g.addColorStop(0.45, '#101f42');
    g.addColorStop(1, '#0a1128');
    ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
    // holofote azul atrás do título
    const s = ctx.createRadialGradient(SIZE / 2, 610, 60, SIZE / 2, 610, 690);
    s.addColorStop(0, 'rgba(52,92,168,0.55)');
    s.addColorStop(0.55, 'rgba(30,52,100,0.22)');
    s.addColorStop(1, 'rgba(10,17,40,0)');
    ctx.fillStyle = s; ctx.fillRect(0, 0, SIZE, SIZE);
    hexTexture(ctx);
    // vinheta
    const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 300, SIZE / 2, SIZE / 2, 780);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
  }

  /* texto em ouro escovado com relevo 3D + reflexo especular */
  function metalText3D(ctx, text, cx, y, size, squeeze) {
    squeeze = squeeze || 1;
    ctx.save(); ctx.font = `900 ${size}px "Archivo"`;
    const tw = ctx.measureText(text).width * squeeze;
    ctx.restore();
    const pad = Math.ceil(size * 0.55);
    const W = Math.ceil(tw + pad * 2), H = Math.ceil(size * 1.9);
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const o = off.getContext('2d');
    o.textAlign = 'center'; o.textBaseline = 'middle';
    o.font = `900 ${size}px "Archivo"`;
    o.save(); o.translate(W / 2, H / 2); o.scale(squeeze, 1);
    // laterais (extrusão)
    const depth = Math.max(2, Math.round(size * 0.085));
    const side = o.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
    side.addColorStop(0, '#715516'); side.addColorStop(1, '#31250a');
    o.fillStyle = side;
    for (let i = depth; i > 0; i--) o.fillText(text, i * 0.35, i);
    // face metálica (bandas de brilho)
    const fg = o.createLinearGradient(0, -size * 0.55, 0, size * 0.5);
    fg.addColorStop(0.00, '#7c5f1e');
    fg.addColorStop(0.10, '#f7e8b6');
    fg.addColorStop(0.30, '#dcb96a');
    fg.addColorStop(0.50, '#caa34b');
    fg.addColorStop(0.55, '#fbeec4');
    fg.addColorStop(0.63, '#b8933f');
    fg.addColorStop(0.82, '#876619');
    fg.addColorStop(0.93, '#e9cd7d');
    fg.addColorStop(1.00, '#a07f2e');
    o.fillStyle = fg; o.fillText(text, 0, 0);
    o.lineWidth = Math.max(1, size * 0.006);
    o.strokeStyle = 'rgba(255,248,225,0.5)'; o.strokeText(text, 0, 0);
    o.restore();
    // reflexo diagonal só sobre as letras
    o.save();
    o.globalCompositeOperation = 'source-atop';
    const sw = o.createLinearGradient(0, 0, W, H * 0.55);
    sw.addColorStop(0, 'rgba(255,255,255,0)');
    sw.addColorStop(0.44, 'rgba(255,255,255,0)');
    sw.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    sw.addColorStop(0.57, 'rgba(255,255,255,0)');
    o.fillStyle = sw; o.fillRect(0, 0, W, H);
    o.restore();
    // compõe com sombra projetada
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = size * 0.16; ctx.shadowOffsetY = size * 0.06;
    ctx.drawImage(off, cx - W / 2, y - H / 2);
    ctx.restore();
  }

  /* brilho estilo lens-flare (estrela de 4 pontas) */
  function flare(ctx, x, y, r, intensity) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,251,238,${intensity})`);
    g.addColorStop(0.22, `rgba(255,240,205,${intensity * 0.45})`);
    g.addColorStop(1, 'rgba(255,240,205,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    const streak = (len, ang) => {
      const gr = ctx.createLinearGradient(x - Math.cos(ang) * len, y - Math.sin(ang) * len, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      gr.addColorStop(0, 'rgba(255,251,238,0)');
      gr.addColorStop(0.5, `rgba(255,251,238,${intensity})`);
      gr.addColorStop(1, 'rgba(255,251,238,0)');
      ctx.strokeStyle = gr; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    };
    streak(r * 2.6, 0); streak(r * 1.7, Math.PI / 2);
    ctx.restore();
  }

  /* facho de luz horizontal (brilho sob o número) */
  function lightStreak(ctx, cx, y, halfW, thick) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = `blur(${thick}px)`;
    const g = ctx.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
    g.addColorStop(0, 'rgba(230,220,190,0)');
    g.addColorStop(0.5, 'rgba(255,246,224,0.9)');
    g.addColorStop(1, 'rgba(230,220,190,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - halfW, y - thick, halfW * 2, thick * 2);
    ctx.restore();
  }

  /* =========================================================
     TEMPLATES
     ========================================================= */
  const T = {};

  T.cover = function (ctx, d) {
    coverBg(ctx);
    // símbolo com sombra
    const symH = 150, symW = symH * (100 / 110);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
    if (symbolImg) ctx.drawImage(symbolImg, (SIZE - symW) / 2, 92, symW, symH);
    ctx.restore();
    // wordmark
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
    ctx.font = `900 88px "Archivo"`; ctx.fillStyle = C.white;
    ctx.fillText('MAGMA', SIZE / 2, 298);
    ctx.restore();
    spacedText(ctx, 'CURSOS', SIZE / 2, 348, 30, 700, C.white, 20);
    // título metálico 3D + facho de luz
    metalText3D(ctx, 'TURMA', SIZE / 2, 515, 150, 0.92);
    lightStreak(ctx, SIZE / 2, 900, 320, 9);
    metalText3D(ctx, d.turma, SIZE / 2, 748, 300, 1);
    // brilhos (lens flare)
    flare(ctx, 858, 452, 62, 0.95);
    flare(ctx, 904, 700, 40, 0.7);
    flare(ctx, 250, 812, 24, 0.5);
    // divisor + social
    goldDivider(ctx, 942, 320, true);
    socialFooter(ctx, d.instagram, d.whatsapp, 1002);
  };

  /* ----- variantes de slide de foto ----- */
  const PHOTO_VARIANTS = ['moldura', 'lateral', 'full', 'classic'];
  const PHOTO_LAYOUT = {};

  T.photo = function (ctx, d) {
    (PHOTO_LAYOUT[d.variant] || PHOTO_LAYOUT.moldura)(ctx, d);
  };

  // -- helpers das variantes --
  function cornerBrackets(ctx, x, y, w, h, len) {
    ctx.strokeStyle = C.goldLight; ctx.lineWidth = 3; ctx.lineCap = 'round';
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([px, py, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(px + sx * len, py); ctx.lineTo(px, py); ctx.lineTo(px, py + sy * len);
      ctx.stroke();
    });
  }

  function turmaPill(ctx, turma, rightX, cy) {
    const label = 'Turma ' + turma;
    ctx.font = `700 34px "Archivo"`; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width;
    const padX = 26, h = 62, w = tw + padX * 2, x = rightX - w, y = cy - h / 2;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#e2c079'); g.addColorStop(1, '#b8933f');
    ctx.fillStyle = g; roundRectPath(ctx, x, y, w, h, 14); ctx.fill();
    ctx.fillStyle = '#2a2008'; ctx.textAlign = 'left';
    ctx.fillText(label, x + padX, cy + 1);
  }

  function panelPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  }

  function logoVertical(ctx, cx, top, symH) {
    const symW = symH * (100 / 110);
    if (symbolImg) ctx.drawImage(symbolImg, cx - symW / 2, top, symW, symH);
    const base = top + symH;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `900 ${symH * 0.44}px "Archivo"`; ctx.fillStyle = C.white;
    ctx.fillText('MAGMA', cx, base + symH * 0.44);
    spacedText(ctx, 'CURSOS', cx, base + symH * 0.72, symH * 0.15, 700, C.white, symH * 0.1);
  }

  function verticalTurma(ctx, panelW, turma, midY) {
    ctx.save();
    ctx.translate(panelW / 2, midY);
    ctx.rotate(-Math.PI / 2);
    const size = 92;
    ctx.font = `800 ${size}px "Archivo"`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const wt = ctx.measureText('Turma ').width;
    const wn = ctx.measureText(turma).width;
    const total = wt + wn;
    ctx.fillStyle = C.white; ctx.fillText('Turma ', -total / 2, 0);
    ctx.fillStyle = C.goldLight; ctx.fillText(turma, -total / 2 + wt, 0);
    ctx.restore();
  }

  // moldura chanfrada (original)
  PHOTO_LAYOUT.moldura = function (ctx, d) {
    bgNavy(ctx);
    logoLockup(ctx, 70, 66, 74, 'left');
    spacedTextLeft(ctx, `Turma ${d.turma}`, 74, 208, 34, 700, C.goldLight, 2);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(76, 236); ctx.lineTo(250, 236); ctx.stroke();
    framedPhoto(ctx, d.img, 76, 274, SIZE - 152, 660, 46, d.offsetY);
    cornerFlourish(ctx, 1010, 60, [1, 1]);
    cornerFlourish(ctx, 70, 1020, [-1, -1]);
    socialFooter(ctx, d.instagram, d.whatsapp, 1010);
  };

  // moldura retangular com cantos ornamentais
  PHOTO_LAYOUT.classic = function (ctx, d) {
    bgNavy(ctx);
    logoLockup(ctx, 70, 70, 76, 'left');
    // Turma NNN topo-direita
    ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    ctx.font = `800 46px "Archivo"`;
    const wn = ctx.measureText(d.turma).width;
    ctx.fillStyle = C.goldLight; ctx.fillText(d.turma, SIZE - 76, 116);
    ctx.font = `600 42px "Archivo"`;
    ctx.fillStyle = C.white; ctx.fillText('Turma', SIZE - 76 - wn - 12, 116);
    // moldura + foto
    const fx = 74, fy = 250, fw = SIZE - 148, fh = 560;
    ctx.save(); roundRectPath(ctx, fx, fy, fw, fh, 6); ctx.clip();
    drawPhoto(ctx, d.img, fx, fy, fw, fh, d.offsetY); ctx.restore();
    ctx.strokeStyle = goldGrad(ctx, fy, fy + fh); ctx.lineWidth = 3;
    roundRectPath(ctx, fx, fy, fw, fh, 6); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,227,196,.4)'; ctx.lineWidth = 1.5;
    roundRectPath(ctx, fx + 9, fy + 9, fw - 18, fh - 18, 4); ctx.stroke();
    cornerBrackets(ctx, fx - 7, fy - 7, fw + 14, fh + 14, 36);
    socialFooter(ctx, d.instagram, d.whatsapp, 906);
  };

  // foto sangrando toda a arte, com degradês
  PHOTO_LAYOUT.full = function (ctx, d) {
    drawPhoto(ctx, d.img, 0, 0, SIZE, SIZE, d.offsetY);
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
    logoLockup(ctx, 66, 58, 72, 'left');
    turmaPill(ctx, d.turma, SIZE - 66, 96);
    socialFooter(ctx, d.instagram, d.whatsapp, 1004);
  };

  // painel lateral navy + foto na direita
  PHOTO_LAYOUT.lateral = function (ctx, d) {
    bgNavy(ctx);
    const panelW = 316, footerH = 104;
    const px = panelW, py = 0, pw = SIZE - panelW, ph = SIZE - footerH;
    // foto (sangra na direita)
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    drawPhoto(ctx, d.img, px, py, pw, ph, d.offsetY); ctx.restore();
    // painel esquerdo (canto sup-direito arredondado)
    const pg = ctx.createLinearGradient(0, 0, panelW, SIZE);
    pg.addColorStop(0, '#182541'); pg.addColorStop(1, '#0f1c38');
    ctx.fillStyle = pg; panelPath(ctx, 0, 0, panelW, SIZE - footerH, 56); ctx.fill();
    ctx.strokeStyle = 'rgba(220,185,106,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(panelW, 56); ctx.lineTo(panelW, SIZE - footerH); ctx.stroke();
    logoVertical(ctx, panelW / 2, 70, 116);
    verticalTurma(ctx, panelW, d.turma, 700);
    // rodapé full-width
    ctx.fillStyle = C.navyDeep; ctx.fillRect(0, SIZE - footerH, SIZE, footerH);
    ctx.strokeStyle = 'rgba(220,185,106,.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, SIZE - footerH); ctx.lineTo(SIZE, SIZE - footerH); ctx.stroke();
    socialFooter(ctx, d.instagram, d.whatsapp, SIZE - footerH / 2);
  };

  T.closing = function (ctx, d) {
    bgNavy(ctx);
    logoLockup(ctx, 70, 58, 64, 'left');
    // TURMA (branco) + número (ouro)
    ctx.textAlign = 'center';
    spacedText(ctx, 'TURMA', SIZE / 2, 210, 96, 900, C.white, 4);
    metal3D(ctx, d.turma, SIZE / 2, 350, 200, 1);
    goldDivider(ctx, 452, 190, false);
    // estrela
    drawStar(ctx, SIZE / 2, 452, 13, C.goldLight);
    // frase
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 700 52px "Archivo"`; ctx.fillStyle = C.white;
    ctx.fillText(d.frase, SIZE / 2, 520);
    // foto
    framedPhoto(ctx, d.img, 150, 580, SIZE - 300, 320, 34, d.offsetY);
    // CTA pill
    ctaPill(ctx, d, 940);
  };

  function drawStar(ctx, cx, cy, r, color) {
    ctx.save(); ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * 0.44 : r;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = cx + rad * Math.cos(a), py = cy + rad * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function ctaPill(ctx, d, top) {
    const x = 70, w = SIZE - 140, h = 96, r = 26;
    ctx.strokeStyle = goldGrad(ctx, top, top + h);
    ctx.lineWidth = 3;
    roundRectPath(ctx, x, top, w, h, r); ctx.stroke();
    // linha 1: CTA
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 30px "Archivo"`; ctx.fillStyle = C.goldLight;
    ctx.fillText('FAÇA PARTE DA PRÓXIMA TURMA!', SIZE / 2, top + 30);
    // linha 2: social
    socialFooter(ctx, d.instagram, d.whatsapp, top + 68);
  }

  /* =========================================================
     API pública
     ========================================================= */
  function render(canvas, slide, data, dpr) {
    dpr = dpr || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    const d = Object.assign({}, data, { img: slide.img || null, offsetY: (slide.offsetY == null ? 0.5 : slide.offsetY), variant: slide.variant || 'moldura' });
    (T[slide.type] || T.cover)(ctx, d);
  }

  global.MagmaTemplates = { ready, render, SIZE, PHOTO_VARIANTS };
})(window);
