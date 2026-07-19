/* ============================================================
   MAGMA TEMPLATES — motor declarativo (core + adaptador browser)
   docs/subsistemas/10-studio-2.0.md §3 · specs/002-studio-motor-declarativo

   LEI (não violar): a função `desenhar(ctx, formato, dados, assets)` de
   QUALQUER template (`static/midia/templates/*.js`) usa SOMENTE a API
   Canvas 2D do `ctx` — NUNCA referencia `document`, `Image`, `fetch` ou
   `Blob` diretamente. Tudo que o desenho precisa chega pronto: números/
   textos/config em `dados`, imagens/símbolo/padrões já carregados em
   `assets`. É isso que permite que o MESMO arquivo de template rode em
   Node (node-canvas) na spec 007 sem reescrever nada — só troca o
   adaptador (a metade deste arquivo abaixo de "ADAPTADOR BROWSER", que
   é quem tem permissão de tocar o DOM/document para carregar fontes,
   imagens e construir os canvases).

   Este arquivo é o CORE: formatos suportados, registry de templates
   (`registrar`/`listar`/`obter`), biblioteca de helpers de desenho
   (`MagmaTemplates.helpers`) e o adaptador browser. Cada template vive
   em `static/midia/templates/<id>.js` e se registra chamando
   `MagmaTemplates.registrar({...})` — 1 template = 1 arquivo, nunca
   uma tela nova.
   ============================================================ */
(function (global) {
  'use strict';

  /* =========================================================
     FORMATOS — contrato único de tamanho/margem por saída
     ========================================================= */
  const FORMATOS = {
    feed: { id: 'feed', w: 1080, h: 1080, margem: 88 },
    story: { id: 'story', w: 1080, h: 1920, zonaSegura: { topo: 250, base: 250 } },
    capa_reel: { id: 'capa_reel', w: 1080, h: 1920, zonaSegura: { topo: 250, base: 250 } },
  };

  /* =========================================================
     REGISTRY — templates declarados por `registrar(def)`
     ========================================================= */
  const registry = new Map();

  function registrar(def) {
    if (!def || !def.id) throw new Error('MagmaTemplates.registrar: definição precisa de "id".');
    if (typeof def.desenhar !== 'function') throw new Error(`MagmaTemplates.registrar("${def.id}"): falta desenhar(ctx, formato, dados, assets).`);
    registry.set(def.id, def);
  }
  function listar() { return Array.from(registry.values()); }
  function obter(id) { return registry.get(id) || null; }

  /* =========================================================
     CORES da marca (design-system/AGENTS.md)
     ========================================================= */
  const C = {
    navyDeep: '#101c38', navy: '#1b2a4d', navySoft: '#24365e',
    gold: '#b8933f', goldLight: '#dcb96a', goldPale: '#f0e3c4', goldDeep: '#8a6a1f',
    red: '#c8102e', white: '#ffffff',
  };

  /* =========================================================
     HELPERS DE DESENHO — Canvas 2D puro, tudo parametrizado
     (nada de SIZE fixo: quem chama passa w/h/formato)
     ========================================================= */

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
    // este helper faz o próprio tracking char-a-char e por isso PRECISA de
    // textAlign 'left' internamente — mas o chamador não deve herdar esse
    // estado (era a origem de textos "vazando" alinhados à esquerda quando o
    // próximo fillText assumia 'center'). Restaura align/baseline ao sair.
    const prevAlign = ctx.textAlign;
    const prevBaseline = ctx.textBaseline;
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
    ctx.textAlign = prevAlign;
    ctx.textBaseline = prevBaseline;
    return total;
  }

  /* texto com tracking manual, alinhado à esquerda em x */
  function spacedTextLeft(ctx, text, x, y, size, weight, fill, spacing) {
    const prevAlign = ctx.textAlign;
    const prevBaseline = ctx.textBaseline;
    ctx.font = `${weight} ${size}px "Archivo"`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = fill;
    let cx = x;
    for (const ch of text.split('')) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + spacing;
    }
    ctx.textAlign = prevAlign;
    ctx.textBaseline = prevBaseline;
  }

  /* quebra de linha simples (canvas não tem quebra nativa) — centralizado em cx/y,
     usa ctx.font/fillStyle/textAlign já setados pelo chamador. Retorna nº de linhas. */
  function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
    const words = String(text == null ? '' : text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, cx, startY + i * lineHeight));
    return lines.length;
  }

  /* número/palavra em ouro metálico com relevo 3D (sem canvas auxiliar) */
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
    ctx.lineWidth = s * 0.13; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx - s * 0.02, cy - s * 0.02, s * 0.24, Math.PI * 0.15, Math.PI * 0.62);
    ctx.stroke();
    ctx.restore();
  }

  /* rodapé social (instagram + whatsapp), centralizado na largura w */
  function socialFooter(ctx, w, insta, zap, y) {
    const s = 34;
    ctx.textBaseline = 'middle';
    ctx.font = `600 30px "Archivo"`;
    const gapIcon = 16, blockGap = 70;
    const wInsta = ctx.measureText(insta).width;
    const wZap = ctx.measureText(zap).width;
    const totalW = s + gapIcon + wInsta + blockGap + s + gapIcon + wZap;
    let x = (w - totalW) / 2;
    igIcon(ctx, x + s / 2, y, s, C.goldLight);
    x += s + gapIcon;
    ctx.textAlign = 'left'; ctx.fillStyle = C.white; ctx.fillText(insta, x, y);
    x += wInsta + blockGap;
    waIcon(ctx, x + s / 2, y, s, C.goldLight);
    x += s + gapIcon;
    ctx.fillStyle = C.white; ctx.fillText(zap, x, y);
  }

  function goldDivider(ctx, cx, cy, halfLen, withHex) {
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

  function cornerBrackets(ctx, x, y, w, h, len) {
    ctx.strokeStyle = C.goldLight; ctx.lineWidth = 3; ctx.lineCap = 'round';
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([px, py, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(px + sx * len, py); ctx.lineTo(px, py); ctx.lineTo(px, py + sy * len);
      ctx.stroke();
    });
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

  /* logotipo (símbolo + "MAGMA/CURSOS") na horizontal — símbolo vem de assets.simbolo */
  function logoLockup(ctx, x, y, h, simbolo) {
    const symW = h * (100 / 110);
    if (simbolo) ctx.drawImage(simbolo, x, y, symW, h);
    const tx = x + symW + h * 0.28;
    const mid = y + h * 0.5;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `900 ${h * 0.52}px "Archivo"`;
    ctx.fillStyle = C.white;
    ctx.fillText('MAGMA', tx, mid + h * 0.03);
    spacedTextLeft(ctx, 'CURSOS', tx, mid + h * 0.4, h * 0.19, 700, C.white, h * 0.09);
  }

  /* logotipo empilhado (símbolo em cima, MAGMA/CURSOS embaixo, centralizado em cx) */
  function logoVertical(ctx, cx, top, symH, simbolo) {
    const symW = symH * (100 / 110);
    if (simbolo) ctx.drawImage(simbolo, cx - symW / 2, top, symW, symH);
    const base = top + symH;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `900 ${symH * 0.44}px "Archivo"`; ctx.fillStyle = C.white;
    ctx.fillText('MAGMA', cx, base + symH * 0.44);
    spacedText(ctx, 'CURSOS', cx, base + symH * 0.72, symH * 0.15, 700, C.white, symH * 0.1);
  }

  /* "Turma NNN" lido de baixo pra cima (rotacionado -90°), centrado em (panelW/2, midY) */
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

  /* textura de hexágonos (padrão já pronto em assets.hexPattern) preenchendo 0,0,w,h */
  function hexTexture(ctx, w, h, assets) {
    ctx.fillStyle = assets.hexPattern(ctx);
    ctx.fillRect(0, 0, w, h);
  }

  /* fundo navy padrão (degradê radial + textura hex), tamanho w×h */
  function bgNavy(ctx, w, h, assets) {
    const g = ctx.createRadialGradient(w * 0.78, -h * 0.15, 0, w * 0.78, -h * 0.15, Math.max(w, h) * 1.25);
    g.addColorStop(0, '#31456f');
    g.addColorStop(0.45, C.navy);
    g.addColorStop(1, C.navyDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    hexTexture(ctx, w, h, assets);
  }

  /* fundo dramático da capa (degradê + holofote + textura hex + vinheta), tamanho w×h */
  function coverBg(ctx, w, h, assets) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0b1024');
    g.addColorStop(0.45, '#101f42');
    g.addColorStop(1, '#0a1128');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const k = h / 1080;
    const s = ctx.createRadialGradient(w / 2, h * 0.565, 60, w / 2, h * 0.565, 690 * k);
    s.addColorStop(0, 'rgba(52,92,168,0.55)');
    s.addColorStop(0.55, 'rgba(30,52,100,0.22)');
    s.addColorStop(1, 'rgba(10,17,40,0)');
    ctx.fillStyle = s; ctx.fillRect(0, 0, w, h);
    hexTexture(ctx, w, h, assets);
    const v = ctx.createRadialGradient(w / 2, h / 2, 300 * k, w / 2, h / 2, 780 * k);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }

  /* texto em ouro escovado com relevo 3D + reflexo especular (usa canvas auxiliar —
     por isso vive aqui no core/adapter, e não pode ser chamada de dentro de um
     template rodando em Node; a spec 007 troca este helper por uma versão node-canvas
     com a mesma assinatura) */
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
    const depth = Math.max(2, Math.round(size * 0.085));
    const side = o.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
    side.addColorStop(0, '#715516'); side.addColorStop(1, '#31250a');
    o.fillStyle = side;
    for (let i = depth; i > 0; i--) o.fillText(text, i * 0.35, i);
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
    o.save();
    o.globalCompositeOperation = 'source-atop';
    const sw = o.createLinearGradient(0, 0, W, H * 0.55);
    sw.addColorStop(0, 'rgba(255,255,255,0)');
    sw.addColorStop(0.44, 'rgba(255,255,255,0)');
    sw.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    sw.addColorStop(0.57, 'rgba(255,255,255,0)');
    o.fillStyle = sw; o.fillRect(0, 0, W, H);
    o.restore();
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

  const helpers = {
    C,
    goldGrad, spacedText, spacedTextLeft, wrapText,
    metal3D, metalText3D,
    cutRectPath, roundRectPath, roundRect: roundRectPath,
    drawPhoto, framedPhoto,
    igIcon, waIcon, socialFooter,
    goldDivider, cornerFlourish, cornerBrackets, panelPath, turmaPill, drawStar,
    logoLockup, logoVertical, verticalTurma,
    hexTexture, bgNavy, coverBg,
    flare, lightStreak,
  };

  /* =========================================================
     ADAPTADOR BROWSER — único trecho autorizado a tocar
     document/Image/fetch/Blob. Carrega fontes/símbolo/imagens,
     monta o canvas e injeta tudo em `assets` para o template.
     ========================================================= */

  const RENDER_DPR = 2; // supersample interno → export nítido (mesma qualidade do motor anterior)

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
  let hexPatternCache = null;

  /* padrão de hexágonos (CanvasPattern), criado 1x e cacheado — assets.hexPattern(ctx) */
  function hexPatternFactory(ctx) {
    if (!hexPatternCache) {
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
      hexPatternCache = ctx.createPattern(t, 'repeat');
    }
    return hexPatternCache;
  }

  /* carrega fontes (Archivo/Inter) + rasteriza o símbolo (Estrela da Vida) */
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

  /* carrega uma lista de URLs de imagem → Promise<Map<url, HTMLImageElement|null>> */
  function carregarImagens(urls) {
    return Promise.all((urls || []).map((url) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve([url, img]);
      img.onerror = () => resolve([url, null]);
      img.src = url;
    }))).then((pares) => new Map(pares));
  }

  /* renderiza um template num canvas novo, no tamanho do formato pedido.
     dados: valores do template (texto/números/ids) — sem objetos vivos do DOM.
     assets: extras específicos da chamada (ex.: imagens: Map<key, HTMLImageElement>).
     symbolo/hexPattern do adaptador entram automaticamente, sobrescrevíveis. */
  function renderizar(templateId, formatoId, dados, assets) {
    const tpl = obter(templateId);
    if (!tpl) throw new Error(`MagmaTemplates.renderizar: template "${templateId}" não registrado.`);
    const formato = FORMATOS[formatoId];
    if (!formato) throw new Error(`MagmaTemplates.renderizar: formato "${formatoId}" desconhecido.`);
    if (Array.isArray(tpl.formatos) && tpl.formatos.length && tpl.formatos.indexOf(formatoId) === -1) {
      throw new Error(
        `MagmaTemplates.renderizar: template "${templateId}" não aceita o formato "${formatoId}" `
        + `(aceita: ${tpl.formatos.join(', ')}).`
      );
    }

    const canvas = document.createElement('canvas');
    canvas.width = formato.w * RENDER_DPR;
    canvas.height = formato.h * RENDER_DPR;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(RENDER_DPR, 0, 0, RENDER_DPR, 0, 0);
    ctx.clearRect(0, 0, formato.w, formato.h);

    const assetsFinais = Object.assign(
      { simbolo: symbolImg, imagens: new Map(), hexPattern: hexPatternFactory },
      assets
    );
    tpl.desenhar(ctx, formato, dados || {}, assetsFinais);
    return canvas;
  }

  function exportarBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  global.MagmaTemplates = {
    FORMATOS,
    registrar, listar, obter,
    helpers,
    ready, carregarImagens, renderizar, exportarBlob,
    // compat: código existente (studio.js) lê a lista de variantes de foto daqui.
    get PHOTO_VARIANTS() {
      const formacao = obter('formacao');
      return formacao ? formacao.variantes : [];
    },
  };
})(window);
