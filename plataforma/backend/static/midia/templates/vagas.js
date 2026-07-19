/* ============================================================
   TEMPLATE — Últimas Vagas (urgência de matrícula)
   Card com dados da turma: número gigante de vagas restantes,
   data de início e dias de aula — badge vermelho de urgência
   (receita §5/§6 do AGENTS.md: vermelho SOMENTE aqui, ≤2% da área).

   Variantes:
   - 'padrao'     → card navy-deep puro (mesmo fundo dos demais templates)
   - 'foto-fundo' → foto do acervo escurecida por trás do card
                    (sem foto, cai no fundo navy padrão)

   dados: { curso, turma, vagasRestantes, dataInicio, diasAula,
            instagram, whatsapp, imgKey?, variant, offsetY }

   Só usa `ctx` (Canvas 2D puro) e o que chega em `dados`/`assets` — sem
   APIs de DOM/carregamento aqui dentro (ver LEI no topo de
   templates-engine.js).
   ============================================================ */
(function (global) {
  'use strict';

  const M = global.MagmaTemplates;
  if (!M) throw new Error('templates/vagas.js requer MagmaTemplates (templates-engine.js) carregado antes.');
  const h = M.helpers;
  const C = h.C;

  const VARIANTES = ['padrao', 'foto-fundo'];

  const CAMPOS = [
    { id: 'curso', tipo: 'texto', rotulo: 'Curso' },
    { id: 'turma', tipo: 'texto', rotulo: 'Nº da turma' },
    { id: 'vagasRestantes', tipo: 'numero', rotulo: 'Vagas restantes' },
    { id: 'dataInicio', tipo: 'texto', rotulo: 'Data de início (dd/mm)' },
    { id: 'diasAula', tipo: 'texto', rotulo: 'Dias de aula' },
    { id: 'instagram', tipo: 'texto', rotulo: 'Instagram' },
    { id: 'whatsapp', tipo: 'texto', rotulo: 'WhatsApp' },
  ];

  const LEGENDA_PADRAO =
    '🚨 Últimas vagas para {{curso}} — Turma {{turma}} começa {{data_inicio}}! ' +
    'Turmas aos sábados, feitas para quem trabalha. ' +
    'Garanta a sua: chama no WhatsApp. {{hashtags_curso}}';

  /* ---------------------------------------------------------
     Helpers locais (não existem no core)
     --------------------------------------------------------- */

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

  /* badge de urgência — pílula vermelha compacta (≤2% da área da peça),
     ÚNICO uso de vermelho na peça (AGENTS.md §3/§6) */
  function badgeUrgencia(ctx, cx, cy, texto) {
    ctx.save();
    ctx.font = `800 30px "Archivo"`;
    ctx.textBaseline = 'middle';
    const spacing = 2;
    let textW = 0;
    for (const ch of texto) textW += ctx.measureText(ch).width + spacing;
    textW -= spacing;
    const padX = 34, hh = 62, w = textW + padX * 2, x = cx - w / 2, y = cy - hh / 2;
    ctx.shadowColor = 'rgba(200,16,46,.45)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
    ctx.fillStyle = C.red;
    h.roundRectPath(ctx, x, y, w, hh, hh / 2);
    ctx.fill();
    ctx.restore();
    h.spacedText(ctx, texto, cx, cy + 1, 30, 800, C.white, spacing);
  }

  /* pílula dourada com texto arbitrário (ex.: dias de aula), centrada em cx */
  function pillDourada(ctx, texto, cx, cy) {
    ctx.font = `700 32px "Archivo"`;
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(texto).width;
    const padX = 30, hh = 60, w = tw + padX * 2, x = cx - w / 2, y = cy - hh / 2;
    const g = ctx.createLinearGradient(x, y, x, y + hh);
    g.addColorStop(0, '#e2c079'); g.addColorStop(1, '#b8933f');
    ctx.fillStyle = g;
    h.roundRectPath(ctx, x, y, w, hh, hh / 2);
    ctx.fill();
    ctx.fillStyle = '#2a2008';
    ctx.textAlign = 'center';
    ctx.fillText(texto.toUpperCase(), cx, cy + 1);
  }

  /* CTA final: pílula outline dourada com chamada + rodapé social dentro */
  function ctaWhatsapp(ctx, W, d, top) {
    const x = 70, w = W - 140, hh = 96, r = 26;
    ctx.strokeStyle = h.goldGrad(ctx, top, top + hh);
    ctx.lineWidth = 3;
    h.roundRectPath(ctx, x, top, w, hh, r); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 30px "Archivo"`; ctx.fillStyle = C.goldLight;
    ctx.fillText('GARANTA SUA VAGA — CHAMA NO WHATSAPP', W / 2, top + 30);
    h.socialFooter(ctx, W, d.instagram, d.whatsapp, top + 68);
  }

  /* ---------------------------------------------------------
     Bloco central — mesmo desenho no feed e no story, só muda
     o mapa de posições (cfg)
     --------------------------------------------------------- */
  function blocoVagas(ctx, W, cfg, d, assets) {
    h.logoLockup(ctx, 70, cfg.logoY, 74, assets.simbolo);

    // eyebrow: nome do curso (Archivo 700 caps, dourado sobre navy — AGENTS.md §4)
    if (d.curso) {
      h.spacedText(ctx, String(d.curso).toUpperCase(), W / 2, cfg.cursoY, 34, 700, C.goldLight, 3);
    }

    badgeUrgencia(ctx, W / 2, cfg.badgeY, 'ÚLTIMAS VAGAS');

    // número gigante de vagas restantes (ouro metálico 3D)
    h.lightStreak(ctx, W / 2, cfg.numeroY, cfg.numeroHalfW, 9);
    h.metal3D(ctx, String(d.vagasRestantes == null || d.vagasRestantes === '' ? '—' : d.vagasRestantes), W / 2, cfg.numeroY, cfg.numeroSize, 1);
    h.flare(ctx, W / 2 + cfg.numeroSize * 0.62, cfg.numeroY - cfg.numeroSize * 0.42, cfg.numeroSize * 0.16, 0.75);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    h.spacedText(ctx, 'VAGAS RESTANTES', W / 2, cfg.labelY, 26, 800, C.white, 5);

    h.goldDivider(ctx, W / 2, cfg.divisorY, 190, true);

    // data de início
    if (d.dataInicio) {
      ctx.font = `700 42px "Archivo"`;
      ctx.fillStyle = C.white;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Início em ' + d.dataInicio, W / 2, cfg.dataY);
    }

    // pílula de dias de aula
    if (d.diasAula) pillDourada(ctx, d.diasAula, W / 2, cfg.pillY);

    ctaWhatsapp(ctx, W, d, cfg.ctaTop);
  }

  /* posições: feed 1080×1080 (margem 88) */
  const CFG_FEED = {
    logoY: 66,
    cursoY: 178,
    badgeY: 250,
    numeroY: 458, numeroSize: 280, numeroHalfW: 240,
    labelY: 616,
    divisorY: 668,
    dataY: 728,
    pillY: 800,
    ctaTop: 890,
  };

  /* posições: story 1080×1920 (zona segura 250 topo/base — conteúdo
     recomposto entre y=250 e y=1670, não é o feed esticado) */
  const CFG_STORY = {
    logoY: 290,
    cursoY: 408,
    badgeY: 486,
    numeroY: 760, numeroSize: 320, numeroHalfW: 270,
    labelY: 942,
    divisorY: 1000,
    dataY: 1068,
    pillY: 1150,
    ctaTop: 1500,
  };

  /* =========================================================
     desenhar(ctx, formato, dados, assets)
     ========================================================= */
  function desenhar(ctx, formato, dados, assets) {
    const img = (dados.imgKey != null && assets.imagens) ? assets.imagens.get(dados.imgKey) : null;
    const d = Object.assign(
      { curso: '', turma: '', vagasRestantes: '', dataInicio: '', diasAula: 'Sábados', instagram: '', whatsapp: '', offsetY: 0.5, variant: 'padrao' },
      dados,
      { img }
    );

    const W = formato.w, H = formato.h;
    if (d.variant === 'foto-fundo') fundoFoto(ctx, W, H, d, assets);
    else h.bgNavy(ctx, W, H, assets);

    h.cornerFlourish(ctx, W - 70, formato.id === 'story' ? 280 : 60, [1, 1]);
    h.cornerFlourish(ctx, 70, H - (formato.id === 'story' ? 280 : 60), [-1, -1]);

    const cfg = formato.id === 'story' ? CFG_STORY : CFG_FEED;
    blocoVagas(ctx, W, cfg, d, assets);
  }

  M.registrar({
    id: 'vagas',
    nome: 'Últimas Vagas',
    descricao: 'Urgência de matrícula — número de vagas restantes, início e dias de aula, CTA WhatsApp.',
    formatos: ['feed', 'story'],
    fontes: ['campos', 'foto?'],
    requer: ['turma'], // vagas/datas são da turma (spec 008 — Studio da marca desabilita)
    campos: CAMPOS,
    variantes: VARIANTES,
    legendaPadrao: LEGENDA_PADRAO,
    desenhar,
  });
})(window);
