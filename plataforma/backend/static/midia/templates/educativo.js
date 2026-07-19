/* ============================================================
   TEMPLATE — Educativo
   Texto puro (sem foto obrigatória) — garante constância nos dias sem
   material novo. Fundo navy + textura de hexágonos, tipografia grande.

   Variantes:
   - 'voce-sabia' → eyebrow "VOCÊ SABIA?" + título + corpo explicativo
   - 'erro-certo' → eyebrow "ERRO × CERTO" + dois cartões lado a lado
                    (errado / certo). Sem vermelho — este template não é
                    de urgência (AGENTS.md §3: vermelho só em badge de
                    urgência), a oposição usa símbolos ✕/✓ em tons
                    neutro/dourado.

   dados: { titulo, corpo, errado, certo, instagram, whatsapp, variant }

   Só usa `ctx` (Canvas 2D puro) e o que chega em `dados`/`assets` — sem
   APIs de DOM/carregamento aqui dentro (ver LEI no topo de
   templates-engine.js).
   ============================================================ */
(function (global) {
  'use strict';

  const M = global.MagmaTemplates;
  if (!M) throw new Error('templates/educativo.js requer MagmaTemplates (templates-engine.js) carregado antes.');
  const h = M.helpers;
  const C = h.C;

  const VARIANTES = ['voce-sabia', 'erro-certo'];

  const CAMPOS = [
    { id: 'titulo', tipo: 'texto', rotulo: 'Título / pergunta' },
    { id: 'corpo', tipo: 'texto-longo', rotulo: 'Texto explicativo (Você sabia)' },
    { id: 'errado', tipo: 'texto-longo', rotulo: 'Erro comum (Errado)' },
    { id: 'certo', tipo: 'texto-longo', rotulo: 'Forma certa (Certo)' },
    { id: 'instagram', tipo: 'texto', rotulo: 'Instagram' },
    { id: 'whatsapp', tipo: 'texto', rotulo: 'WhatsApp' },
  ];

  const PADRAO = {
    titulo: 'Você sabia?',
    corpo: 'Atendimento pré-hospitalar bem feito começa com prática de verdade, em equipamento profissional.',
    errado: 'Improvisar procedimentos sem treino prático real.',
    certo: 'Treinar com instrutores atuantes e equipamento de verdade.',
  };

  const LEGENDA_PADRAO =
    'Conteúdo rápido pra quem quer entrar na área da saúde com o pé direito. ' +
    'Prática de verdade em {{curso}} — sem enrolação. {{hashtags_curso}}';

  /* ---------------------------------------------------------
     Helpers locais
     --------------------------------------------------------- */

  /* quebra em linhas com teto; trunca a última com reticências
     (mesmo padrão do depoimento.js). Usa ctx.font já setado. */
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
    if (linhas.length <= maxLinhas) return linhas;

    const cortadas = linhas.slice(0, maxLinhas);
    let ultima = cortadas[maxLinhas - 1].replace(/[\s.,;:!?…]+$/, '');
    while (ultima && ctx.measureText(ultima + '…').width > maxWidth) {
      ultima = ultima.slice(0, -1).replace(/[\s.,;:!?…]+$/, '');
    }
    cortadas[maxLinhas - 1] = ultima + '…';
    return cortadas;
  }

  /* eyebrow + hexágono central (marcador do bloco educativo) */
  function eyebrowComHex(ctx, cx, y, texto) {
    h.spacedText(ctx, texto, cx, y, 32, 700, C.goldLight, 6);
  }

  /* marca circular ✕ (errado, tom neutro) ou ✓ (certo, dourado) */
  function marcaCard(ctx, cx, cy, r, certo) {
    ctx.save();
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = 'round';
    ctx.strokeStyle = certo ? C.goldLight : 'rgba(240,227,196,0.55)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (certo) {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.42, cy + r * 0.02);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.36);
      ctx.lineTo(cx + r * 0.46, cy - r * 0.34);
      ctx.stroke();
    } else {
      const o = r * 0.36;
      ctx.beginPath();
      ctx.moveTo(cx - o, cy - o); ctx.lineTo(cx + o, cy + o);
      ctx.moveTo(cx + o, cy - o); ctx.lineTo(cx - o, cy + o);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* cartão errado/certo — usado nos dois formatos, só muda cfg */
  function cardErroCerto(ctx, x, y, w, hh, label, texto, certo) {
    const bg = certo ? 'rgba(220,185,106,0.08)' : 'rgba(255,255,255,0.035)';
    ctx.fillStyle = bg;
    h.roundRectPath(ctx, x, y, w, hh, 22); ctx.fill();
    ctx.strokeStyle = certo ? 'rgba(220,185,106,0.55)' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    h.roundRectPath(ctx, x, y, w, hh, 22); ctx.stroke();

    const padTop = 44;
    marcaCard(ctx, x + w / 2, y + padTop, 30, certo);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 26px "Archivo"`;
    ctx.fillStyle = certo ? C.goldLight : 'rgba(240,227,196,0.75)';
    h.spacedText(ctx, label, x + w / 2, y + padTop + 62, 24, 800, certo ? C.goldLight : 'rgba(240,227,196,0.75)', 3);

    ctx.font = `500 27px "Inter"`;
    ctx.fillStyle = C.white;
    const linhas = wrapLinhasMax(ctx, texto, w - 64, 5);
    const lh = 36;
    const startY = y + padTop + 128;
    linhas.forEach((linha, i) => ctx.fillText(linha, x + w / 2, startY + i * lh));
  }

  /* =========================================================
     VARIANTE 'voce-sabia'
     ========================================================= */

  function voceSabia(ctx, w, h_, d, assets, cfg) {
    h.bgNavy(ctx, w, h_, assets);
    h.logoLockup(ctx, 70, cfg.logoY, 64, assets.simbolo);
    ctx.textAlign = 'center';
    eyebrowComHex(ctx, w / 2, cfg.eyebrowY, 'VOCÊ SABIA?');
    h.goldDivider(ctx, w / 2, cfg.divisorTopoY, 130, true);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${cfg.tituloSize}px "Archivo"`; ctx.fillStyle = C.white;
    const linhasTitulo = wrapLinhasMax(ctx, d.titulo, w - cfg.margemTexto, cfg.tituloMaxLinhas);
    const tituloLH = cfg.tituloSize * 1.12;
    const tituloStartY = cfg.tituloCY - ((linhasTitulo.length - 1) * tituloLH) / 2;
    linhasTitulo.forEach((linha, i) => ctx.fillText(linha, w / 2, tituloStartY + i * tituloLH));

    h.goldDivider(ctx, w / 2, cfg.divisorMeioY, 90, false);

    ctx.font = `500 ${cfg.corpoSize}px "Inter"`; ctx.fillStyle = 'rgba(255,255,255,0.88)';
    const linhasCorpo = wrapLinhasMax(ctx, d.corpo, w - cfg.margemTexto, cfg.corpoMaxLinhas);
    const corpoLH = cfg.corpoSize * 1.5;
    const corpoStartY = cfg.corpoCY - ((linhasCorpo.length - 1) * corpoLH) / 2;
    linhasCorpo.forEach((linha, i) => ctx.fillText(linha, w / 2, corpoStartY + i * corpoLH));

    h.socialFooter(ctx, w, d.instagram, d.whatsapp, cfg.rodapeY);
  }

  const VS_FEED = {
    logoY: 66, eyebrowY: 200, divisorTopoY: 240,
    tituloSize: 66, tituloCY: 420, tituloMaxLinhas: 3, margemTexto: 176,
    divisorMeioY: 560,
    corpoSize: 34, corpoCY: 740, corpoMaxLinhas: 4,
    rodapeY: 1002,
  };
  const VS_STORY = {
    logoY: 296, eyebrowY: 440, divisorTopoY: 484,
    tituloSize: 68, tituloCY: 700, tituloMaxLinhas: 3, margemTexto: 176,
    divisorMeioY: 858,
    corpoSize: 36, corpoCY: 1120, corpoMaxLinhas: 5,
    rodapeY: 1600,
  };

  /* =========================================================
     VARIANTE 'erro-certo'
     ========================================================= */

  function erroCerto(ctx, w, h_, d, assets, cfg) {
    h.bgNavy(ctx, w, h_, assets);
    h.logoLockup(ctx, 70, cfg.logoY, 64, assets.simbolo);
    ctx.textAlign = 'center';
    eyebrowComHex(ctx, w / 2, cfg.eyebrowY, 'ERRO × CERTO');

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${cfg.tituloSize}px "Archivo"`; ctx.fillStyle = C.goldLight;
    const linhasTitulo = wrapLinhasMax(ctx, d.titulo, w - cfg.margemTexto, 2);
    const tituloLH = cfg.tituloSize * 1.16;
    const tituloStartY = cfg.tituloCY - ((linhasTitulo.length - 1) * tituloLH) / 2;
    linhasTitulo.forEach((linha, i) => ctx.fillText(linha, w / 2, tituloStartY + i * tituloLH));

    const cardW = (w - 74 * 2 - cfg.gap) / 2;
    cardErroCerto(ctx, 74, cfg.cardY, cardW, cfg.cardH, 'ERRADO', d.errado, false);
    cardErroCerto(ctx, 74 + cardW + cfg.gap, cfg.cardY, cardW, cfg.cardH, 'CERTO', d.certo, true);

    h.socialFooter(ctx, w, d.instagram, d.whatsapp, cfg.rodapeY);
  }

  const EC_FEED = {
    logoY: 66, eyebrowY: 194,
    tituloSize: 44, tituloCY: 300, margemTexto: 176,
    cardY: 388, cardH: 520, gap: 36,
    rodapeY: 1002,
  };
  const EC_STORY = {
    logoY: 296, eyebrowY: 434,
    tituloSize: 46, tituloCY: 540, margemTexto: 176,
    cardY: 630, cardH: 900, gap: 36,
    rodapeY: 1600,
  };

  /* =========================================================
     desenhar(ctx, formato, dados, assets)
     ========================================================= */
  function desenhar(ctx, formato, dados, assets) {
    const d = Object.assign(
      { titulo: PADRAO.titulo, corpo: PADRAO.corpo, errado: PADRAO.errado, certo: PADRAO.certo, instagram: '', whatsapp: '', variant: 'voce-sabia' },
      dados
    );
    const w = formato.w, h_ = formato.h;
    const story = formato.id === 'story';

    if (d.variant === 'erro-certo') {
      erroCerto(ctx, w, h_, d, assets, story ? EC_STORY : EC_FEED);
    } else {
      voceSabia(ctx, w, h_, d, assets, story ? VS_STORY : VS_FEED);
    }
  }

  M.registrar({
    id: 'educativo',
    nome: 'Educativo',
    descricao: 'Texto puro pra manter constância — "Você sabia?" ou "Erro × Certo".',
    formatos: ['feed', 'story'],
    fontes: ['campos'],
    campos: CAMPOS,
    variantes: VARIANTES,
    legendaPadrao: LEGENDA_PADRAO,
    desenhar,
  });
})(window);
