/* ============================================================
   TEMPLATE — Depoimento (prova social)
   Card de avaliação real 4–5★ vinda do endpoint
   GET /api/midia/turmas/<id>/avaliacoes/ (spec 003, T1) — o picker do
   Studio escolhe a avaliação e injeta em `dados.avaliacao`.

   Variantes:
   - 'aspas'      → card navy-deep puro (receita §5 do AGENTS.md: aspas
                    Georgia douradas gigantes, estrelas douradas)
   - 'foto-fundo' → foto do acervo escurecida por trás do depoimento
                    (sem foto, cai no fundo navy padrão)

   dados: { avaliacao: {nome, cargo_atual, estrelas, comentario},
            turma, instagram, whatsapp, imgKey?, variant, offsetY }

   Só usa `ctx` (Canvas 2D puro) e o que chega em `dados`/`assets` — sem
   APIs de DOM/carregamento aqui dentro (ver LEI no topo de
   templates-engine.js).
   ============================================================ */
(function (global) {
  'use strict';

  const M = global.MagmaTemplates;
  if (!M) throw new Error('templates/depoimento.js requer MagmaTemplates (templates-engine.js) carregado antes.');
  const h = M.helpers;
  const C = h.C;

  const VARIANTES = ['aspas', 'foto-fundo'];

  const CAMPOS = [
    { id: 'turma', tipo: 'texto', rotulo: 'Nº da turma' },
    { id: 'instagram', tipo: 'texto', rotulo: 'Instagram' },
    { id: 'whatsapp', tipo: 'texto', rotulo: 'WhatsApp' },
  ];

  const LEGENDA_PADRAO =
    'Quem fez o curso de {{curso}} conta como foi — depoimento real de aluno. ' +
    'Sua carreira na saúde começa com prática de verdade. ' +
    'Turmas aos sábados, feitas para quem trabalha. {{hashtags_curso}}';

  /* ---------------------------------------------------------
     Helpers locais (não existem no core)
     --------------------------------------------------------- */

  /* quebra em linhas com teto de linhas; trunca a última com reticências.
     Usa ctx.font já setado pelo chamador. */
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

  /* fileira de 5 estrelas centrada em cx (n douradas, resto apagado) */
  function fileiraEstrelas(ctx, cx, cy, n, r, gap) {
    const startX = cx - gap * 2;
    for (let i = 0; i < 5; i++) {
      h.drawStar(ctx, startX + i * gap, cy, r, i < n ? C.goldLight : 'rgba(240,227,196,0.22)');
    }
  }

  /* fundo da variante foto-fundo: foto escurecida (sem foto → navy padrão) */
  function fundoFoto(ctx, W, H, d, assets) {
    if (!d.img) { h.bgNavy(ctx, W, H, assets); return; }
    h.drawPhoto(ctx, d.img, 0, 0, W, H, d.offsetY);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(13,20,44,0.88)');
    g.addColorStop(0.5, 'rgba(13,20,44,0.78)');
    g.addColorStop(1, 'rgba(13,20,44,0.93)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    h.hexTexture(ctx, W, H, assets);
  }

  /* ---------------------------------------------------------
     Bloco central do depoimento — mesmo desenho no feed e no
     story, só muda o mapa de posições (cfg)
     --------------------------------------------------------- */
  function blocoDepoimento(ctx, W, cfg, d, assets) {
    h.logoLockup(ctx, 70, cfg.logoY, 74, assets.simbolo);

    // aspas Georgia douradas gigantes (receita do card de depoimento, §5)
    ctx.save();
    ctx.font = `400 ${cfg.aspasSize}px Georgia, serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = h.goldGrad(ctx, cfg.aspasY, cfg.aspasY + cfg.aspasSize);
    ctx.globalAlpha = 0.9;
    ctx.fillText('“', 52, cfg.aspasY);
    ctx.restore();

    const av = d.avaliacao || {};
    const estrelas = Math.max(0, Math.min(5, Math.round(Number(av.estrelas) || 0)));
    fileiraEstrelas(ctx, W / 2, cfg.estrelasY, estrelas, 26, 68);

    // comentário (até 600 chars na origem — trunca com reticências se não couber)
    ctx.font = `italic 500 ${cfg.fonteComentario}px "Inter"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const linhas = wrapLinhasMax(ctx, av.comentario, cfg.larguraTexto, cfg.maxLinhas);
    const startY = cfg.comentarioCY - ((linhas.length - 1) * cfg.entreLinhas) / 2;
    ctx.fillStyle = C.white;
    linhas.forEach((linha, i) => ctx.fillText(linha, W / 2, startY + i * cfg.entreLinhas));

    h.goldDivider(ctx, W / 2, cfg.divisorY, 190, true);

    // nome + cargo + turma
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 46px "Archivo"`;
    ctx.fillStyle = C.white;
    ctx.fillText(av.nome || '', W / 2, cfg.nomeY);

    const pedacos = [];
    if (av.cargo_atual) pedacos.push(av.cargo_atual);
    if (d.turma) pedacos.push('Turma ' + d.turma);
    if (pedacos.length) {
      ctx.font = `600 32px "Inter"`;
      ctx.fillStyle = C.goldLight;
      ctx.fillText(pedacos.join(' · '), W / 2, cfg.cargoY);
    }

    h.socialFooter(ctx, W, d.instagram, d.whatsapp, cfg.rodapeY);
  }

  /* posições: feed 1080×1080 (margem 88) */
  const CFG_FEED = {
    logoY: 66,
    aspasY: 150, aspasSize: 300,
    estrelasY: 300,
    fonteComentario: 44, entreLinhas: 64, larguraTexto: 840,
    comentarioCY: 560, maxLinhas: 6,
    divisorY: 796,
    nomeY: 862, cargoY: 918,
    rodapeY: 1010,
  };

  /* posições: story 1080×1920 (zona segura 250 topo/base — conteúdo
     recomposto entre y=250 e y=1670, não é o feed esticado) */
  const CFG_STORY = {
    logoY: 290,
    aspasY: 400, aspasSize: 320,
    estrelasY: 566,
    fonteComentario: 46, entreLinhas: 68, larguraTexto: 840,
    comentarioCY: 880, maxLinhas: 8,
    divisorY: 1204,
    nomeY: 1272, cargoY: 1330,
    rodapeY: 1600,
  };

  /* =========================================================
     desenhar(ctx, formato, dados, assets)
     ========================================================= */
  function desenhar(ctx, formato, dados, assets) {
    const img = (dados.imgKey != null && assets.imagens) ? assets.imagens.get(dados.imgKey) : null;
    const d = Object.assign(
      { avaliacao: {}, turma: '', instagram: '', whatsapp: '', offsetY: 0.5, variant: 'aspas' },
      dados,
      { img }
    );

    const W = formato.w, H = formato.h;
    if (d.variant === 'foto-fundo') fundoFoto(ctx, W, H, d, assets);
    else h.bgNavy(ctx, W, H, assets);

    const cfg = formato.id === 'story' ? CFG_STORY : CFG_FEED;
    blocoDepoimento(ctx, W, cfg, d, assets);
  }

  M.registrar({
    id: 'depoimento',
    nome: 'Depoimento',
    descricao: 'Avaliação real de aluno (4–5★) como prova social — card navy com aspas douradas.',
    formatos: ['feed', 'story'],
    fontes: ['avaliacao', 'foto?'],
    requer: ['turma'], // avaliações são da turma (spec 008 — Studio da marca desabilita)
    campos: CAMPOS,
    variantes: VARIANTES,
    legendaPadrao: LEGENDA_PADRAO,
    desenhar,
  });
})(window);
