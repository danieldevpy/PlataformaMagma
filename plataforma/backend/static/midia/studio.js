/* ============================================================
   MAGMA STUDIO INTEGRADO — app (acervo, carrossel, postagens)
   Porta de mvp-apps/studio/montar-templates/app/js/app.js, adaptada
   pra ler fotos do Acervo da Turma (API /api/midia/) em vez de upload
   local, e pra criar/gerenciar Postagens. Renderiza o template ativo via
   MagmaTemplates.renderizar (motor core em templates-engine.js — spec
   002-T1). Seletor de modo (cards de template), toggle de formato,
   campos dinâmicos e export kit multi-formato — spec 002-T2. Picker
   contextual por `fontes` do template (fotos | avaliação | só campos),
   legenda com variáveis via MagmaMarca.resolverLegenda e os 5 templates
   da campanha (depoimento/vagas/formatura/educativo/capa_reel) — spec
   003-T4.

   Estratégia de slides por template (decisão de produto desta integração,
   não faz parte do contrato do motor): carrossel só em 'formacao' (capa →
   fotos → fechamento) e 'formatura' (1 slide por foto selecionada, sem
   capa/fechamento) — ver ESTRATEGIA_SLIDES. Os demais (depoimento, vagas,
   educativo, capa_reel) são arte única.
   ============================================================ */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  const API_BASE = window.MAGMA_API_BASE || '/api/midia';
  const TURMA = window.MAGMA_TURMA || {
    id: null, codigo: '', curso: '', cursoSlug: '', dataInicio: '', vagasRestantes: '', diasAula: '',
  };
  // spec 008: o Studio roda em dois contextos — "turma" (página da turma,
  // comportamento histórico) e "marca" (/dj-admin/midia/midia/studio/, sem
  // turma; templates com requer:['turma'] ficam desabilitados).
  const CONTEXTO = window.MAGMA_CONTEXTO || { tipo: TURMA.id ? 'turma' : 'marca' };
  const MODO_MARCA = CONTEXTO.tipo === 'marca';
  const CSRF = window.MAGMA_CSRF || '';

  // um template está disponível neste contexto? (requer:['turma'] exige turma)
  function templateDisponivel(tpl) {
    const requer = (tpl && tpl.requer) || [];
    return requer.indexOf('turma') === -1 || !!TURMA.id;
  }

  // deslocamento vertical da foto no quadro (0=topo … 0.5=centro … 1=base)
  const OFFSET_STEP = 0.1;
  const clampOffset = (v) => Math.max(0, Math.min(1, +v.toFixed(3)));

  // variantes de slide de foto (rótulos p/ UI) — cobre 'formacao' e 'depoimento';
  // variante sem rótulo aqui cai no id cru (ver renderVariantBar)
  const VARIANT_LABELS = {
    moldura: 'Moldura', lateral: 'Lateral', full: 'Foto cheia', classic: 'Clássico',
    aspas: 'Aspas douradas', 'foto-fundo': 'Foto de fundo',
  };
  // rótulos dos formatos declarados em MagmaTemplates.FORMATOS
  const FORMATO_LABELS = { feed: 'Feed · 1:1', story: 'Story · 9:16', capa_reel: 'Capa Reel · 9:16' };

  /* ---------- helpers de template ativo (seletor de modo) ---------- */
  function obterTemplate(id) { return MagmaTemplates.obter(id); }
  function formatosDoTemplate(tpl) {
    const lista = (tpl && Array.isArray(tpl.formatos) && tpl.formatos.length) ? tpl.formatos : ['feed'];
    return lista.filter((fid) => MagmaTemplates.FORMATOS[fid]);
  }
  function variantesDoTemplate(tpl) { return (tpl && tpl.variantes) || []; }

  // picker contextual: qual painel mostrar na coluna 1, a partir de `template.fontes`
  // (spec 003 §"Integração UI"). 'fotos' (plural) = carrossel do acervo (formacao/
  // formatura); 'avaliacao' = lista de avaliações (depoimento, com foto? opcional
  // de fundo); 'foto'/'foto?' sem 'fotos' = 1 foto opcional (vagas/capa_reel);
  // nenhuma das anteriores = só campos, sem foto nenhuma (educativo).
  function pickerMode(tpl) {
    const fontes = (tpl && tpl.fontes) || [];
    if (fontes.indexOf('fotos') !== -1) return 'fotos';
    if (fontes.some((f) => f.indexOf('avaliacao') === 0)) return 'avaliacao';
    if (fontes.indexOf('foto') !== -1 || fontes.indexOf('foto?') !== -1) return 'foto-unica';
    return 'nenhum';
  }
  // o template aceita (opcionalmente) 1 foto do acervo além da fonte principal
  // (ex.: depoimento = avaliação + foto? de fundo)
  function aceitaFotoOpcional(tpl) {
    const fontes = (tpl && tpl.fontes) || [];
    return fontes.indexOf('foto?') !== -1 || fontes.indexOf('foto') !== -1;
  }

  // estratégia de montagem de slides — ver nota no cabeçalho do arquivo.
  const ESTRATEGIA_SLIDES = { formacao: 'carrossel-com-fechamento', formatura: 'carrossel-simples' };
  function estrategiaSlides(templateId) { return ESTRATEGIA_SLIDES[templateId] || 'unico'; }

  const templatesRegistrados = MagmaTemplates.listar();
  // default: 'formacao' se estiver registrado E disponível no contexto
  // (compat com o fluxo crítico atual), senão o primeiro disponível — no
  // Studio da marca isso cai num template sem requer:['turma'] (educativo).
  const templatesDisponiveis = templatesRegistrados.filter(templateDisponivel);
  const DEFAULT_TEMPLATE_ID = templatesDisponiveis.some((t) => t.id === 'formacao')
    ? 'formacao'
    : (templatesDisponiveis[0] ? templatesDisponiveis[0].id : 'formacao');

  // sorteio com "saco embaralhado": todas aparecem antes de repetir, sem repetir a anterior
  let variantBag = [];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function pickVariant(prev) {
    const variantes = variantesDoTemplate(obterTemplate(state.templateId));
    if (!variantes.length) return undefined;
    if (!variantBag.length) variantBag = shuffle(variantes.slice());
    const last = variantBag.length - 1;
    if (variantBag[last] === prev && variantBag.length > 1) {
      [variantBag[last], variantBag[last - 1]] = [variantBag[last - 1], variantBag[last]];
    }
    return variantBag.pop();
  }

  /* nº da turma default: só os dígitos do código, se houver algum */
  function digitsOrCodigo(codigo) {
    const digits = String(codigo || '').replace(/\D/g, '');
    return digits || String(codigo || '');
  }

  // "dd/mm" curto (sem ano) pro prefill do campo "Data de início" do template
  // vagas — a legenda em si usa MagmaMarca.resolverLegenda, que formata
  // {{data_inicio}} como "dd/mm/aaaa" completo.
  function dataCurtaBR(isoOuVazio) {
    const m = String(isoOuVazio || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}` : '';
  }

  // contexto pra MagmaMarca.resolverLegenda — turma vem do campo editável (se o
  // template tiver um) senão do código oficial da turma.
  function legendaContexto() {
    return {
      curso: TURMA.curso || '',
      cursoSlug: TURMA.cursoSlug || '',
      turma: (state.campos && state.campos.turma) || TURMA.codigo || '',
      dataInicio: TURMA.dataInicio || '',
    };
  }

  // fallback de legenda, usado só se o template ativo não declarar `legendaPadrao`
  const LEGENDA_TEMPLATE_FALLBACK = '🎓 Turma {{codigo}} formada! Parabéns aos nossos alunos de {{curso}}. #magmacursos #aph';
  function legendaDefault(tpl) {
    const padrao = (tpl && tpl.legendaPadrao) || LEGENDA_TEMPLATE_FALLBACK;
    // compat: a legendaPadrao do 'formacao' (T1, caminho crítico já ENTREGUE) usa
    // {{codigo}}, variável que MagmaMarca.resolverLegenda não conhece — resolve
    // à parte antes de passar pro resolvedor oficial (spec 003, marca.js).
    const comCodigoResolvido = padrao.replace(/\{\{\s*codigo\s*\}\}/gi, TURMA.codigo || '');
    if (window.MagmaMarca && typeof MagmaMarca.resolverLegenda === 'function') {
      return MagmaMarca.resolverLegenda(comCodigoResolvido, legendaContexto());
    }
    // fallback se marca.js não carregou por algum motivo — nunca deixa "{{...}}" cru
    return comCodigoResolvido
      .replace(/\{\{\s*curso\s*\}\}/gi, TURMA.curso || '')
      .replace(/\{\{\s*turma\s*\}\}/gi, TURMA.codigo || '')
      .replace(/\{\{\s*data_inicio\s*\}\}/gi, '')
      .replace(/\{\{\s*hashtags_curso\s*\}\}/gi, '');
  }

  // valor inicial de cada campo declarado em `template.campos` — só os ids que o
  // Studio já conhece têm default "esperto" (alguns pré-preenchidos com dados reais
  // da turma via `window.MAGMA_TURMA`); campo novo/desconhecido cai em ''.
  function defaultParaCampo(id, templateId) {
    switch (id) {
      case 'turma': return digitsOrCodigo(TURMA.codigo);
      case 'frase':
        return templateId === 'formatura'
          ? 'Mais profissionais prontos para atuar de verdade.'
          : 'Parabéns à nossa turma!';
      case 'instagram': return '@magma_curso';
      case 'whatsapp': return '(21) 97100-5197';
      case 'curso': return TURMA.curso || '';
      // vagasRestantes === 0 é legítimo (mostra "0"); só null/'' vira '' (placeholder).
      // TURMA.vagasRestantes já chega como string do template Django; "0" é truthy
      // em JS, então `|| ''` só substitui quando realmente vazio/ausente.
      case 'vagasRestantes': return TURMA.vagasRestantes || '';
      case 'dataInicio': return dataCurtaBR(TURMA.dataInicio);
      case 'diasAula': return TURMA.diasAula || 'Sábados';
      case 'proximaTurma': return '';
      case 'titulo': return templateId === 'capa_reel' ? 'Prática de verdade' : 'Você sabia?';
      case 'corpo': return 'Atendimento pré-hospitalar bem feito começa com prática de verdade, em equipamento profissional.';
      case 'errado': return 'Improvisar procedimentos sem treino prático real.';
      case 'certo': return 'Treinar com instrutores atuantes e equipamento de verdade.';
      default: return '';
    }
  }
  function camposParaTemplate(tpl) {
    const campos = {};
    ((tpl && tpl.campos) || []).forEach((c) => { campos[c.id] = defaultParaCampo(c.id, tpl && tpl.id); });
    return campos;
  }

  const state = {
    templateId: DEFAULT_TEMPLATE_ID,
    campos: {},               // {[campoId]: valor} — preenchido logo abaixo, a partir do template ativo
    formatosDisponiveis: [],  // formatos declarados pelo template ativo (ex.: ['feed','story'])
    formatoAtivo: 'feed',     // formato exibido no preview/thumbs
    formatosExport: new Set(), // formatos incluídos no kit (Criar postagem)
    legenda: '',
    photos: [],            // {id, itemId, name, img, offsetY, variant} — carrossel (formacao/formatura)
    destaqueId: null,      // foto usada na capa/fechamento (só 'carrossel-com-fechamento')
    activeIndex: 0,        // slide em foco
    fotoUnica: null,       // {itemId, id, img, offsetY} — foto opcional p/ arte única (vagas/capa_reel/depoimento)
    avaliacaoId: null,     // id da avaliação escolhida (depoimento)
    varianteUnica: null,   // variante escolhida manualmente p/ arte única (sem carrossel de fotos)
  };
  (function initEstadoTemplate() {
    const tpl = obterTemplate(state.templateId);
    state.campos = camposParaTemplate(tpl);
    state.formatosDisponiveis = formatosDoTemplate(tpl);
    state.formatoAtivo = state.formatosDisponiveis[0] || 'feed';
    state.formatosExport = new Set(state.formatosDisponiveis);
    state.legenda = legendaDefault(tpl);
  })();
  let slides = [];
  let uid = 0;
  let ready = false;
  let acervoItens = [];         // itens tipo=foto do acervo da turma
  let avaliacoesItens = [];     // avaliações aprovadas da turma (template 'depoimento')
  let avaliacoesCarregadas = false;
  let postagens = [];
  const imgCache = new Map(); // itemId -> HTMLImageElement

  /* ---------- helpers gerais ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function fileNameFromUrl(url) {
    try { return decodeURIComponent(String(url).split('/').pop()); } catch (e) { return 'foto'; }
  }

  /* ---------- cliente da API /api/midia/ ---------- */
  function apiFetch(url, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    const method = (opts.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      opts.headers = Object.assign({}, opts.headers, { 'X-CSRFToken': CSRF });
    }
    return fetch(url, opts).then(async (res) => {
      if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try { const j = await res.clone().json(); if (j && (j.detail || j.erro)) msg = j.detail || j.erro; } catch (e) { /* ignora */ }
        throw new Error(msg);
      }
      if (res.status === 204) return null;
      const ct = res.headers.get('content-type') || '';
      return ct.includes('application/json') ? res.json() : res;
    });
  }

  /* símbolo na sidebar */
  $('#brandMark').innerHTML =
    `<svg viewBox="0 0 100 110"><polygon points="50,8 90,31 90,79 50,102 10,79 10,31" fill="#232c3d" stroke="#232c3d" stroke-width="12" stroke-linejoin="round"/><polygon points="50,15 84.5,35 84.5,75 50,95 15.5,75 15.5,35" fill="#fff" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><polygon points="50,19 81,37 81,73 50,91 19,73 19,37" fill="#c8102e" stroke="#c8102e" stroke-width="7" stroke-linejoin="round"/><g transform="translate(50,55)"><g fill="#fff"><rect x="-9" y="-27" width="18" height="54" rx="3.5"/><rect x="-9" y="-27" width="18" height="54" rx="3.5" transform="rotate(60)"/><rect x="-9" y="-27" width="18" height="54" rx="3.5" transform="rotate(-60)"/></g><g fill="#1d4f91"><rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4"/><rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4" transform="rotate(60)"/><rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4" transform="rotate(-60)"/></g><circle cx="0" cy="-17.5" r="3.1" fill="#fff"/><rect x="-1.7" y="-15" width="3.4" height="33" rx="1.7" fill="#fff"/><path d="M-5 -10 C 6 -7.5, 6 -3.5, 0 -1.5 C -6 0.5, -6 4.5, 0 6.5 C 5 8.2, 5 11.5, -3 13.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></g></svg>`;

  /* ---------- seletor de modo (cards de template) ---------- */
  function renderTemplateSelector() {
    const grid = $('#templateGrid');
    grid.innerHTML = '';
    templatesRegistrados.forEach((tpl) => {
      const disponivel = templateDisponivel(tpl);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tplcard'
        + (tpl.id === state.templateId ? ' tplcard--on' : '')
        + (disponivel ? '' : ' tplcard--off');
      btn.innerHTML = `<strong>${escapeHtml(tpl.nome || tpl.id)}</strong><small>${escapeHtml(disponivel ? (tpl.descricao || '') : 'Disponível no Studio de uma turma')}</small>`;
      if (disponivel) {
        btn.onclick = () => selecionarTemplate(tpl.id);
      } else {
        btn.disabled = true;
        btn.title = 'Este modelo usa dados da turma — abra o Studio a partir de uma turma.';
      }
      grid.appendChild(btn);
    });
  }

  function selecionarTemplate(id) {
    if (id === state.templateId) return;
    const tpl = obterTemplate(id);
    if (!tpl || !templateDisponivel(tpl)) return;
    state.templateId = id;
    state.campos = camposParaTemplate(tpl);
    state.formatosDisponiveis = formatosDoTemplate(tpl);
    state.formatoAtivo = state.formatosDisponiveis[0] || 'feed';
    state.formatosExport = new Set(state.formatosDisponiveis);
    state.legenda = legendaDefault(tpl);
    state.activeIndex = 0;
    state.varianteUnica = null;
    // a fonte de dados muda de template pra template — a seleção anterior
    // (fotos do carrossel, foto única, avaliação) não faz sentido no novo modo.
    state.photos = [];
    state.destaqueId = null;
    state.fotoUnica = null;
    state.avaliacaoId = null;
    variantBag = []; // as variantes mudam por template — descarta o saco embaralhado antigo

    $('#panelTitle').textContent = tpl.nome || '';
    $('#panelDesc').textContent = tpl.descricao || '';
    $('#fLegenda').value = state.legenda;

    renderTemplateSelector();
    renderCampos();
    renderFormatoSelector();
    renderExportKit();
    renderPickerContainer();
    renderPhotoList();
    updateStageAspect();
    buildSlides();
    render();

    if (pickerMode(tpl) === 'avaliacao') loadAvaliacoes();
  }

  /* ---------- toggle de formato (preview) ---------- */
  function renderFormatoSelector() {
    const wrap = $('#formatoSelector');
    const box = $('#formatoOpts');
    const disponiveis = state.formatosDisponiveis.length ? state.formatosDisponiveis : ['feed'];
    wrap.hidden = disponiveis.length <= 1;
    box.innerHTML = '';
    disponiveis.forEach((fid) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'vopt' + (fid === state.formatoAtivo ? ' vopt--on' : '');
      b.textContent = FORMATO_LABELS[fid] || fid;
      b.onclick = () => {
        if (state.formatoAtivo === fid) return;
        state.formatoAtivo = fid;
        renderFormatoSelector();
        updateStageAspect();
        render();
      };
      box.appendChild(b);
    });
  }

  /* ---------- export kit (formatos incluídos na Postagem) ---------- */
  function renderExportKit() {
    const wrap = $('#exportKit');
    const box = $('#exportOpts');
    const disponiveis = state.formatosDisponiveis.length ? state.formatosDisponiveis : ['feed'];
    wrap.hidden = disponiveis.length <= 1;
    box.innerHTML = '';
    disponiveis.forEach((fid) => {
      const label = document.createElement('label');
      label.className = 'checkopt';
      const checked = state.formatosExport.has(fid);
      label.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''}><span>${escapeHtml(FORMATO_LABELS[fid] || fid)}</span>`;
      const input = label.querySelector('input');
      input.onchange = () => {
        if (input.checked) {
          state.formatosExport.add(fid);
        } else if (state.formatosExport.size > 1) {
          state.formatosExport.delete(fid);
        } else {
          input.checked = true; // sempre ao menos 1 formato selecionado no kit
        }
      };
      box.appendChild(label);
    });
  }

  // limite de caracteres por id de campo (mesma regra do input fixo anterior — só
  // "turma" tinha maxlength; qualquer outro campo fica sem limite)
  const MAXLENGTH_CAMPO = { turma: 5 };

  /* ============================================================
     ✨ IA: geração/melhoria de texto por campo (spec 004-T2, doc 10 §5.4)
     Complemento opcional (doc 10 §1.3 "IA é complemento, nunca requisito"):
     sem provedor de texto configurado E testado, o botão fica esmaecido e
     um clique nele só abre a página de Integrações — o resto do Studio
     segue funcionando 100% igual (nenhuma chamada de rede aqui pode
     travar o resto da UI). Nunca sobrescreve o campo direto (§5.4 ponto
     2): todo resultado vira proposta com Aplicar/Descartar/Tentar de novo
     (ou, em "3 variações", cards lado a lado — toque escolhe).
     ============================================================ */
  const IA_API_BASE = '/api/ia';
  const IA_INTEGRACOES_URL = window.MAGMA_IA_INTEGRACOES_URL || '/dj-admin/ia/provedoria/integracoes/';
  const IA_ROTULO_ACAO = { gerar: 'Gerar', melhorar: 'Melhorar', encurtar: 'Encurtar', variacoes: '3 variações' };
  let iaCapacidades = { 'texto.gerar': false, 'texto.melhorar': false, 'texto.variacoes': false };

  function iaTextoDisponivel() {
    return !!(iaCapacidades['texto.gerar'] || iaCapacidades['texto.melhorar'] || iaCapacidades['texto.variacoes']);
  }

  function iaFetch(caminho, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    opts.headers = Object.assign({ 'Content-Type': 'application/json', 'X-CSRFToken': CSRF }, opts.headers);
    return fetch(`${IA_API_BASE}${caminho}`, opts).then(async (res) => {
      let corpo = null;
      try { corpo = await res.json(); } catch (e) { /* ignora */ }
      if (!res.ok) throw new Error((corpo && corpo.detail) || `Erro ${res.status}`);
      return corpo;
    });
  }

  // fecha qualquer menu ✨ aberto ao clicar fora dele — 1 listener global só
  // (evita empilhar listeners a cada renderCampos/troca de template).
  document.addEventListener('click', (e) => {
    if (e.target.closest('.ia-wrap')) return;
    document.querySelectorAll('.ia-menu').forEach((m) => { m.hidden = true; });
  });

  function iaAtualizarBotao(btn) {
    const disponivel = iaTextoDisponivel();
    btn.classList.toggle('ia-btn--off', !disponivel);
    btn.title = disponivel
      ? 'Escrever com IA'
      : 'Configure um provedor de texto para ativar (⚙ Integrações de IA)';
  }

  // consulta GET /api/ia/capacidades/ uma vez no carregamento — se falhar
  // (sem provedor, erro de rede etc.), os botões ✨ simplesmente ficam
  // esmaecidos; nunca propaga erro pro resto do Studio.
  function carregarCapacidadesIA() {
    return iaFetch('/capacidades/')
      .then((caps) => {
        iaCapacidades = caps || iaCapacidades;
        document.querySelectorAll('.ia-btn').forEach(iaAtualizarBotao);
      })
      .catch((err) => console.warn('IA indisponível (Studio segue funcionando sem ela):', err.message));
  }

  // contexto comum enviado pro adaptador de IA (ver notas T4 da spec 003 e
  // plan.md da 004: {tipo_conteudo, template, turma, curso, texto_atual?, instrucao?})
  function contextoIA(campoId, extra) {
    return Object.assign({
      tipo_conteudo: campoId === 'legenda' ? 'legenda' : `campo:${campoId}`,
      template: state.templateId,
      turma: TURMA.codigo || '',
      curso: TURMA.curso || '',
    }, extra || {});
  }

  // monta o botão ✨ (+ menu de ações + área de proposta) dentro de `label`
  // (um <label class="field">) — `label.querySelector('.field__ia')` é o
  // slot ao lado do rótulo (ver renderCampos e o markup do #fLegenda no
  // studio.html); a proposta entra como último filho do label, abaixo do
  // input. `getValor`/`aplicar` leem/escrevem o valor do campo no mesmo
  // padrão do listener `input` já existente (quem chama decide se precisa
  // de buildSlides()/render() — campos de arte precisam, a legenda não).
  function montarBotaoIA(label, campoId, getValor, aplicar) {
    const slot = label && label.querySelector('.field__ia');
    if (!slot) return;

    const wrap = document.createElement('span');
    wrap.className = 'ia-wrap';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ia-btn';
    btn.textContent = '✨';
    wrap.appendChild(btn);
    const menu = document.createElement('div');
    menu.className = 'ia-menu';
    menu.hidden = true;
    wrap.appendChild(menu);
    slot.appendChild(wrap);
    iaAtualizarBotao(btn);

    const proposta = document.createElement('div');
    proposta.className = 'ia-proposta';
    proposta.hidden = true;
    label.appendChild(proposta);

    function montarMenu() {
      menu.innerHTML = '';
      const temValor = !!(getValor() || '').trim();
      const acoes = temValor ? ['melhorar', 'encurtar', 'variacoes'] : ['gerar'];
      acoes.forEach((acao) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'ia-menu__item';
        item.textContent = IA_ROTULO_ACAO[acao];
        item.onclick = () => { menu.hidden = true; executar(acao); };
        menu.appendChild(item);
      });
    }

    function executar(acao) {
      const capacidade = acao === 'gerar' ? 'texto.gerar' : acao === 'variacoes' ? 'texto.variacoes' : 'texto.melhorar';
      const contexto = contextoIA(campoId, {
        texto_atual: getValor() || undefined,
        instrucao: (acao === 'melhorar' || acao === 'encurtar') ? acao : undefined,
      });
      proposta.hidden = false;
      proposta.innerHTML = `<p class="ia-proposta__status">${acao === 'variacoes' ? 'escrevendo 3 variações…' : 'escrevendo…'}</p>`;
      iaFetch('/executar/', { method: 'POST', body: JSON.stringify({ capacidade, contexto }) })
        .then((resp) => mostrarResultado(acao, resp && resp.resultado))
        .catch((err) => mostrarErro(acao, err.message));
    }

    function mostrarErro(acao, mensagem) {
      proposta.innerHTML = `
        <p class="ia-proposta__erro">${escapeHtml(mensagem)}</p>
        <div class="ia-proposta__btns">
          <button type="button" class="btn btn--ghost btn--sm ia-tentar">Tentar de novo</button>
          <button type="button" class="btn btn--ghost btn--sm ia-fechar">Fechar</button>
        </div>`;
      proposta.querySelector('.ia-tentar').onclick = () => executar(acao);
      proposta.querySelector('.ia-fechar').onclick = () => { proposta.hidden = true; };
    }

    function mostrarResultado(acao, resultado) {
      const texto = (resultado || '').trim();
      if (!texto) { mostrarErro(acao, 'A IA não devolveu nenhum texto.'); return; }
      if (acao === 'variacoes') {
        const variantes = texto.split(/\n?-{3,}\n?/).map((v) => v.trim()).filter(Boolean);
        if (!variantes.length) variantes.push(texto);
        proposta.innerHTML =
          '<div class="ia-variantes"></div>' +
          '<div class="ia-proposta__btns"><button type="button" class="btn btn--ghost btn--sm ia-fechar">Descartar</button></div>';
        const box = proposta.querySelector('.ia-variantes');
        variantes.forEach((v) => {
          const card = document.createElement('button');
          card.type = 'button';
          card.className = 'ia-variante';
          card.textContent = v;
          card.onclick = () => { aplicar(v); proposta.hidden = true; };
          box.appendChild(card);
        });
        proposta.querySelector('.ia-fechar').onclick = () => { proposta.hidden = true; };
        return;
      }
      proposta.innerHTML = `
        <p class="ia-proposta__texto">${escapeHtml(texto)}</p>
        <div class="ia-proposta__btns">
          <button type="button" class="btn btn--gold btn--sm ia-aplicar">Aplicar</button>
          <button type="button" class="btn btn--ghost btn--sm ia-tentar">Tentar de novo</button>
          <button type="button" class="btn btn--ghost btn--sm ia-fechar">Descartar</button>
        </div>`;
      proposta.querySelector('.ia-aplicar').onclick = () => { aplicar(texto); proposta.hidden = true; };
      proposta.querySelector('.ia-tentar').onclick = () => executar(acao);
      proposta.querySelector('.ia-fechar').onclick = () => { proposta.hidden = true; };
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!iaTextoDisponivel()) {
        // descoberta > mistério (§5.4 ponto 4): 1 clique até resolver
        window.open(IA_INTEGRACOES_URL, '_blank', 'noopener');
        return;
      }
      const abrir = menu.hidden;
      document.querySelectorAll('.ia-menu').forEach((m) => { m.hidden = true; });
      if (abrir) { montarMenu(); menu.hidden = false; }
    });
  }

  // campos "de conteúdo" (frase livre/corpo de texto) ganham o botão ✨ de
  // IA (spec 004-T2) — campos estruturais/factuais (turma, contato, datas,
  // vagas etc.) ficam de fora: não são prosa, não faz sentido "escrever com
  // IA" neles. `texto-longo` sempre entra (é sempre corpo de texto no
  // template educativo).
  const CAMPOS_COM_IA = new Set(['frase', 'titulo', 'corpo', 'errado', 'certo']);

  /* ---------- campos dinâmicos (a partir de template.campos) ----------
     tipos suportados: 'texto' (padrão), 'numero' (vagasRestantes) e
     'texto-longo' (educativo: corpo/errado/certo, vira <textarea>). Tipo
     desconhecido cai no fallback de texto simples — nunca quebra. */
  function renderCampos() {
    const tpl = obterTemplate(state.templateId);
    const campos = (tpl && tpl.campos) || [];
    const grid = $('#fieldGrid');
    grid.innerHTML = '';
    campos.forEach((campo) => {
      const label = document.createElement('label');
      const ehLongo = campo.tipo === 'texto-longo';
      label.className = 'field' + (ehLongo ? ' field--full' : '');
      const valor = state.campos[campo.id] != null ? state.campos[campo.id] : '';
      const maxlength = MAXLENGTH_CAMPO[campo.id];
      let campoHtml;
      if (ehLongo) {
        campoHtml = '<textarea></textarea>';
      } else if (campo.tipo === 'numero') {
        campoHtml = '<input type="number" inputmode="numeric">';
      } else {
        // 'texto' e qualquer tipo desconhecido caem aqui — fallback seguro
        campoHtml = `<input type="text"${maxlength ? ` maxlength="${maxlength}"` : ''}>`;
      }
      label.innerHTML =
        `<div class="field__row"><span>${escapeHtml(campo.rotulo || campo.id)}</span><span class="field__ia"></span></div>${campoHtml}`;
      const input = label.querySelector('input, textarea');
      input.value = valor;
      input.addEventListener('input', (e) => {
        state.campos[campo.id] = e.target.value;
        buildSlides(); render();
      });
      if (ehLongo || CAMPOS_COM_IA.has(campo.id)) {
        montarBotaoIA(label, campo.id, () => input.value, (texto) => {
          input.value = texto;
          state.campos[campo.id] = texto;
          buildSlides(); render();
        });
      }
      grid.appendChild(label);
    });
  }

  $('#fLegenda').value = state.legenda;
  $('#fLegenda').addEventListener('input', (e) => { state.legenda = e.target.value; });
  // ✨ na legenda — mesmo componente dos campos, slot fixo no studio.html
  montarBotaoIA($('#fLegenda').closest('label'), 'legenda', () => $('#fLegenda').value, (texto) => {
    state.legenda = texto;
    $('#fLegenda').value = texto;
  });
  carregarCapacidadesIA();

  /* ---------- acervo em camadas → picker de fotos (spec 008) ----------
     A camada ativa do picker é um value do <select #pickerCamada>:
     'turma:<id>' | 'geral' | 'instrutores' | 'estrutura' | 'externa' |
     'curso:<id>'. Default: a turma da página (contexto turma) ou 'geral'
     (Studio da marca). Trocar de camada NÃO limpa a seleção — é assim que
     uma arte mistura fotos de camadas diferentes. */
  let camadaFoto = TURMA.id ? `turma:${TURMA.id}` : 'geral';

  function urlAcervoDaCamada() {
    const [tipoCamada, alvoId] = camadaFoto.indexOf(':') !== -1
      ? camadaFoto.split(':')
      : [camadaFoto, null];
    if (tipoCamada === 'turma') return `${API_BASE}/acervo/?tipo=foto&camada=turma&turma=${alvoId}`;
    if (tipoCamada === 'curso') return `${API_BASE}/acervo/?tipo=foto&camada=curso&curso=${alvoId}`;
    return `${API_BASE}/acervo/?tipo=foto&camada=${tipoCamada}`;
  }

  function loadAcervo() {
    return apiFetch(urlAcervoDaCamada())
      .then((data) => {
        acervoItens = (data.itens || []).filter((it) => it.tipo === 'foto');
        const empty = $('#pickerEmpty');
        empty.classList.remove('picker__error');
        renderPicker();
      })
      .catch((err) => {
        console.error('Falha ao carregar acervo:', err);
        acervoItens = [];
        const empty = $('#pickerEmpty');
        empty.hidden = false;
        empty.classList.add('picker__error');
        empty.textContent = 'Não foi possível carregar o acervo desta camada.';
      });
  }

  /* seletor de camada do picker — populado por /acervo/camadas/ (contagem de
     fotos entre parênteses; camadas vazias continuam selecionáveis) */
  function renderSeletorCamadaPicker(resumo) {
    const sel = $('#pickerCamada');
    if (!sel) return;
    const opcoes = [];
    const gerais = (resumo && resumo.gerais) || [
      { camada: 'geral', rotulo: 'Geral da marca' },
      { camada: 'instrutores', rotulo: 'Instrutores' },
      { camada: 'estrutura', rotulo: 'Estrutura' },
      { camada: 'externa', rotulo: 'Externa' },
    ];
    const nFotos = (c) => (c && c.contagens ? ` (${c.contagens.fotos})` : '');
    ((resumo && resumo.turmas) || []).forEach((t) => {
      if (TURMA.id && t.id === TURMA.id) {
        // a turma da página vem primeiro, com rótulo "desta turma"
        opcoes.unshift({ valor: `turma:${t.id}`, rotulo: `Desta turma — ${t.codigo}${nFotos(t)}` });
      } else {
        opcoes.push({ valor: `turma:${t.id}`, rotulo: `Turma ${t.codigo} — ${t.curso}${nFotos(t)}` });
      }
    });
    let posGerais = TURMA.id && opcoes.length && opcoes[0].valor === `turma:${TURMA.id}` ? 1 : 0;
    gerais.forEach((c) => {
      opcoes.splice(posGerais++, 0, { valor: c.camada, rotulo: `Marca — ${c.rotulo}${nFotos(c)}` });
    });
    ((resumo && resumo.cursos) || []).forEach((c) => {
      opcoes.splice(posGerais++, 0, { valor: `curso:${c.id}`, rotulo: `Curso — ${c.nome}${nFotos(c)}` });
    });
    if (!opcoes.some((o) => o.valor === camadaFoto)) camadaFoto = opcoes.length ? opcoes[0].valor : 'geral';
    sel.innerHTML = opcoes
      .map((o) => `<option value="${escapeHtml(o.valor)}"${o.valor === camadaFoto ? ' selected' : ''}>${escapeHtml(o.rotulo)}</option>`)
      .join('');
  }

  function loadCamadasPicker() {
    return apiFetch(`${API_BASE}/acervo/camadas/`)
      .then((resumo) => renderSeletorCamadaPicker(resumo))
      .catch((err) => {
        console.warn('Resumo de camadas indisponível (picker segue na camada atual):', err.message);
        renderSeletorCamadaPicker(null);
      });
  }

  function isSelected(itemId) {
    return state.photos.some((p) => p.itemId === itemId);
  }

  function loadImage(item) {
    if (imgCache.has(item.id)) return Promise.resolve(imgCache.get(item.id));
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { imgCache.set(item.id, img); resolve(img); };
      img.onerror = () => reject(new Error('imagem não carregou'));
      img.src = item.arquivo_url;
    });
  }

  function addPhoto(item) {
    return loadImage(item).then((img) => {
      const prevVariant = state.photos.length ? state.photos[state.photos.length - 1].variant : null;
      const p = {
        id: ++uid,
        itemId: item.id,
        name: item.legenda || fileNameFromUrl(item.arquivo_url),
        img,
        offsetY: 0.5,
        variant: pickVariant(prevVariant),
      };
      state.photos.push(p);
      if (state.destaqueId == null) state.destaqueId = p.id;
      return p;
    });
  }

  function removePhotoByItemId(itemId) {
    const idx = state.photos.findIndex((p) => p.itemId === itemId);
    if (idx < 0) return;
    const [p] = state.photos.splice(idx, 1);
    if (p.id === state.destaqueId) state.destaqueId = state.photos[0] ? state.photos[0].id : null;
    if (state.activeIndex >= slidesCount()) state.activeIndex = 0;
  }

  /* fotos com tag "destaque" entram pré-selecionadas, na ordem do acervo */
  function preselectDestaques() {
    const destaques = acervoItens.filter((it) => Array.isArray(it.tags) && it.tags.includes('destaque'));
    return destaques.reduce(
      (chain, item) => chain.then(() => addPhoto(item).catch((err) => console.warn('Não carregou foto destaque:', item.id, err))),
      Promise.resolve()
    );
  }

  function onPickClick(item) {
    const modo = pickerMode(obterTemplate(state.templateId));
    if (modo === 'fotos') {
      // carrossel (formacao/formatura): multi-seleção, ordenável
      if (isSelected(item.id)) {
        removePhotoByItemId(item.id);
        renderPicker(); renderPhotoList(); buildSlides(); render();
      } else {
        addPhoto(item)
          .then(() => { renderPicker(); renderPhotoList(); buildSlides(); render(); })
          .catch(() => alert('Não foi possível carregar esta foto do acervo.'));
      }
    } else {
      // foto única opcional (vagas/capa_reel, ou fundo do depoimento): 1 seleção só
      toggleFotoUnica(item);
    }
  }

  // troca/limpa a foto única opcional — usada por templates de arte única
  // (vagas/capa_reel) e pelo fundo opcional do depoimento
  function toggleFotoUnica(item) {
    if (state.fotoUnica && state.fotoUnica.itemId === item.id) {
      state.fotoUnica = null;
      renderPicker(); renderFotoUnicaControls(); buildSlides(); render();
      return;
    }
    loadImage(item)
      .then((img) => {
        state.fotoUnica = { itemId: item.id, id: ++uid, img, offsetY: 0.5 };
        renderPicker(); renderFotoUnicaControls(); buildSlides(); render();
      })
      .catch(() => alert('Não foi possível carregar esta foto do acervo.'));
  }

  /* ---------- container do picker: qual bloco mostrar na coluna 1
     (fotos do acervo | avaliações | nada), a partir de `fontes` do
     template ativo (picker contextual, spec 003-T4) ---------- */
  function renderPickerContainer() {
    const tpl = obterTemplate(state.templateId);
    const modo = pickerMode(tpl);
    const mostraFotos = modo === 'fotos' || modo === 'foto-unica' || (modo === 'avaliacao' && aceitaFotoOpcional(tpl));
    $('#pickerFotos').hidden = !mostraFotos;
    $('#pickerAvaliacoes').hidden = modo !== 'avaliacao';
    $('#pickerNone').hidden = modo !== 'nenhum';
    $('#pickerFotosLabel').textContent = modo === 'fotos' ? 'Fotos do acervo' : 'Foto de fundo (opcional)';
    renderPicker();
    renderFotoUnicaControls();
    renderAvaliacoes();
  }

  function renderPicker() {
    const tpl = obterTemplate(state.templateId);
    const modo = pickerMode(tpl);
    const mostraFotos = modo === 'fotos' || modo === 'foto-unica' || (modo === 'avaliacao' && aceitaFotoOpcional(tpl));
    if (!mostraFotos) return; // container já está hidden (renderPickerContainer)
    const multi = modo === 'fotos';
    const grid = $('#pickerGrid');
    const empty = $('#pickerEmpty');
    if (!empty.classList.contains('picker__error')) {
      empty.hidden = acervoItens.length !== 0;
      empty.textContent = 'Nenhuma foto nesta camada ainda. Envie fotos na Mesa de Luz.';
    }
    grid.innerHTML = '';
    acervoItens.forEach((item) => {
      let sel = false, selIdx = -1;
      if (multi) {
        selIdx = state.photos.findIndex((p) => p.itemId === item.id);
        sel = selIdx >= 0;
      } else {
        sel = !!(state.fotoUnica && state.fotoUnica.itemId === item.id);
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pick' + (sel ? ' pick--on' : '');
      btn.title = item.legenda || '';
      const isDestaque = Array.isArray(item.tags) && item.tags.includes('destaque');
      btn.innerHTML =
        `<img src="${item.thumb_url || item.arquivo_url}" alt="" loading="lazy">` +
        (sel && multi ? `<span class="pick__order">${selIdx + 1}</span>` : '') +
        (isDestaque ? '<span class="pick__star" title="Destaque no acervo">★</span>' : '');
      btn.onclick = () => onPickClick(item);
      grid.appendChild(btn);
    });
    $('#pickerCount').textContent = multi
      ? `${state.photos.length} selecionada${state.photos.length === 1 ? '' : 's'}`
      : (state.fotoUnica ? '1 selecionada' : '0 selecionadas');
  }

  /* controles (offset/remover) da foto única opcional — só aparecem quando
     há uma foto escolhida nesse modo */
  function renderFotoUnicaControls() {
    const box = $('#fotoUnicaControls');
    const tpl = obterTemplate(state.templateId);
    const modo = pickerMode(tpl);
    const usaFotoUnica = modo === 'foto-unica' || (modo === 'avaliacao' && aceitaFotoOpcional(tpl));
    if (!usaFotoUnica || !state.fotoUnica) { box.hidden = true; return; }
    box.hidden = false;
    $('#fotoUnicaThumb').src = state.fotoUnica.img.src;
    const upBtn = $('#fotoUnicaUp');
    const downBtn = $('#fotoUnicaDown');
    upBtn.disabled = state.fotoUnica.offsetY >= 1;
    downBtn.disabled = state.fotoUnica.offsetY <= 0;
    const nudge = (dir) => {
      state.fotoUnica.offsetY = clampOffset(state.fotoUnica.offsetY + dir * OFFSET_STEP);
      renderFotoUnicaControls(); buildSlides(); render();
    };
    upBtn.onclick = () => nudge(+1);
    downBtn.onclick = () => nudge(-1);
    $('#fotoUnicaRm').onclick = () => {
      state.fotoUnica = null;
      renderPicker(); renderFotoUnicaControls(); buildSlides(); render();
    };
  }

  /* ---------- avaliações da turma → picker do template 'depoimento' ---------- */
  function loadAvaliacoes() {
    if (!TURMA.id || avaliacoesCarregadas) return Promise.resolve();
    return apiFetch(`${API_BASE}/turmas/${TURMA.id}/avaliacoes/`)
      .then((data) => {
        avaliacoesItens = data || [];
        avaliacoesCarregadas = true;
        if (state.avaliacaoId == null && avaliacoesItens.length) state.avaliacaoId = avaliacoesItens[0].id;
        renderAvaliacoes(); buildSlides(); render();
      })
      .catch((err) => {
        console.error('Falha ao carregar avaliações:', err);
        const empty = $('#avaliacoesEmpty');
        empty.hidden = false;
        empty.classList.add('picker__error');
        empty.textContent = 'Não foi possível carregar as avaliações da turma.';
      });
  }

  function avaliacaoSelecionada() {
    return avaliacoesItens.find((a) => a.id === state.avaliacaoId) || null;
  }

  function renderAvaliacoes() {
    if (pickerMode(obterTemplate(state.templateId)) !== 'avaliacao') return;
    const box = $('#avaliacoesList');
    const empty = $('#avaliacoesEmpty');
    if (!empty.classList.contains('picker__error')) {
      empty.hidden = avaliacoesItens.length !== 0;
      empty.textContent = 'Nenhuma avaliação aprovada ainda.';
    }
    box.innerHTML = '';
    avaliacoesItens.forEach((a) => {
      const n = Math.max(0, Math.min(5, Number(a.estrelas) || 0));
      const estrelasTxt = '★'.repeat(n) + '☆'.repeat(5 - n);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'avcard' + (a.id === state.avaliacaoId ? ' avcard--on' : '');
      btn.innerHTML = `<strong>${escapeHtml(a.nome || '')}</strong><span class="avcard__estrelas">${estrelasTxt}</span><small>${escapeHtml(a.comentario || '')}</small>`;
      btn.onclick = () => { state.avaliacaoId = a.id; renderAvaliacoes(); buildSlides(); render(); };
      box.appendChild(btn);
    });
    $('#avaliacoesCount').textContent = `${avaliacoesItens.length} disponí${avaliacoesItens.length === 1 ? 'vel' : 'veis'}`;
  }

  /* ---------- lista de fotos selecionadas (controles) ----------
     o toggle ★ "foto do fechamento" só faz sentido pra estratégia
     'carrossel-com-fechamento' (formacao); formatura (carrossel-simples)
     não tem conceito de fechamento — some o botão e a dica pra não
     mostrar controle sem efeito nenhum na arte. */
  function renderPhotoList() {
    const box = $('#photoList');
    const ul = $('#photoItems');
    const usaDestaque = estrategiaSlides(state.templateId) === 'carrossel-com-fechamento';
    $('#photoHint').hidden = !usaDestaque;
    box.hidden = state.photos.length === 0;
    ul.innerHTML = '';
    state.photos.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'pitem';
      const isStar = usaDestaque && p.id === state.destaqueId;
      li.innerHTML =
        `<img class="pitem__thumb" src="${p.img.src}" alt="">
         <span class="pitem__name">${escapeHtml(p.name)}</span>
         ${isStar ? '<span class="pitem__tag">fechamento</span>' : ''}
         <span class="pitem__btns">
           <button class="iconbtn imgup" title="Subir imagem no quadro" ${p.offsetY >= 1 ? 'disabled' : ''}>↥</button>
           <button class="iconbtn imgdn" title="Descer imagem no quadro" ${p.offsetY <= 0 ? 'disabled' : ''}>↧</button>
           ${usaDestaque ? `<button class="iconbtn star ${isStar ? 'star--on' : ''}" title="Usar como foto do fechamento">★</button>` : ''}
           <button class="iconbtn up" title="Reordenar para cima" ${i === 0 ? 'disabled' : ''}>↑</button>
           <button class="iconbtn down" title="Reordenar para baixo" ${i === state.photos.length - 1 ? 'disabled' : ''}>↓</button>
           <button class="iconbtn rm" title="Remover da seleção">✕</button>
         </span>`;
      const nudge = (dir) => { p.offsetY = clampOffset(p.offsetY + dir * OFFSET_STEP); renderPhotoList(); buildSlides(); render(); };
      li.querySelector('.imgup').onclick = () => nudge(+1); // sobe a foto → revela a parte de baixo
      li.querySelector('.imgdn').onclick = () => nudge(-1); // desce a foto → revela a parte de cima
      if (usaDestaque) {
        li.querySelector('.star').onclick = () => { state.destaqueId = p.id; renderPhotoList(); buildSlides(); render(); };
      }
      li.querySelector('.up').onclick = () => move(i, -1);
      li.querySelector('.down').onclick = () => move(i, 1);
      li.querySelector('.rm').onclick = () => { removePhotoByItemId(p.itemId); renderPicker(); renderPhotoList(); buildSlides(); render(); };
      ul.appendChild(li);
    });
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= state.photos.length) return;
    [state.photos[i], state.photos[j]] = [state.photos[j], state.photos[i]];
    renderPhotoList(); buildSlides(); render();
  }

  /* ---------- montagem dos slides — estratégia por template (ver
     ESTRATEGIA_SLIDES/estrategiaSlides no topo do arquivo) ---------- */
  function destaquePhoto() {
    return state.photos.find((x) => x.id === state.destaqueId) || state.photos[0] || null;
  }
  function buildSlides() {
    const estrategia = estrategiaSlides(state.templateId);
    if (estrategia === 'carrossel-com-fechamento') {
      // formacao: capa → 1 slide por foto (exceto a de destaque) → fechamento
      slides = [];
      slides.push({ type: 'cover', tag: 'Capa' });
      let n = 0;
      state.photos.forEach((p) => {
        if (p.id === state.destaqueId) return; // reservada só para o fechamento
        slides.push({ type: 'photo', imgKey: p.id, offsetY: p.offsetY, variant: p.variant, photoId: p.id, tag: `Foto ${++n}` });
      });
      const dp = destaquePhoto();
      slides.push({ type: 'closing', imgKey: dp ? dp.id : null, offsetY: dp ? dp.offsetY : 0.5, tag: 'Fechamento' });
    } else if (estrategia === 'carrossel-simples') {
      // formatura: 1 slide por foto selecionada, sem capa/fechamento (o template
      // não usa `dados.tipo` — cada slide é uma arte completa por si só)
      slides = state.photos.map((p, i) => ({
        type: 'photo', imgKey: p.id, offsetY: p.offsetY, variant: p.variant, photoId: p.id, tag: `Foto ${i + 1}`,
      }));
    } else {
      // arte única (depoimento/vagas/educativo/capa_reel): 1 slide só, com a
      // foto opcional (se houver) e a variante escolhida manualmente
      const variantesTpl = variantesDoTemplate(obterTemplate(state.templateId));
      const foto = state.fotoUnica;
      slides = [{
        type: 'unico',
        imgKey: foto ? foto.id : null,
        offsetY: foto ? foto.offsetY : 0.5,
        variant: state.varianteUnica || variantesTpl[0],
        photoId: null,
        tag: 'Arte',
      }];
    }
    if (state.activeIndex >= slides.length) state.activeIndex = 0;
    renderThumbs();
  }
  function slidesCount() { return slides.length; }

  /* ---------- motor: dados/assets do slide + render num canvas novo ---------- */
  function imagensDoAcervo() {
    const m = new Map();
    state.photos.forEach((p) => m.set(p.id, p.img));
    if (state.fotoUnica) m.set(state.fotoUnica.id, state.fotoUnica.img);
    return m;
  }
  function dadosDoSlide(sl) {
    // campos dinâmicos do template ativo (turma/frase/instagram/whatsapp/etc.)
    // + a avaliação escolhida (depoimento, se houver) + o que descreve o slide
    // em si (tipo/variante/foto)
    const extra = {};
    const av = avaliacaoSelecionada();
    if (av) extra.avaliacao = { nome: av.nome, cargo_atual: av.cargo_atual, estrelas: av.estrelas, comentario: av.comentario };
    return Object.assign({}, state.campos, extra, {
      tipo: sl.type,
      variant: sl.variant,
      offsetY: sl.offsetY,
      imgKey: sl.imgKey,
    });
  }
  function renderizarSlide(sl, formatoId) {
    return MagmaTemplates.renderizar(state.templateId, formatoId || state.formatoAtivo, dadosDoSlide(sl), { imagens: imagensDoAcervo() });
  }

  /* ---------- formato ativo: dimensões do preview/thumbs ---------- */
  function formatoAtual() {
    return MagmaTemplates.FORMATOS[state.formatoAtivo] || MagmaTemplates.FORMATOS.feed;
  }
  // largura/altura de exibição da thumb, preservando a proporção do formato ativo
  // (feed = quadrado 84×84; story/capa_reel = 9:16, mais estreito e alto)
  function thumbDims() {
    const f = formatoAtual();
    const base = 84;
    if (f.w >= f.h) return { dw: base, dh: Math.round((base * f.h) / f.w) };
    return { dw: Math.round((base * f.w) / f.h), dh: base };
  }
  // aplica a proporção do formato ativo no wrapper do preview grande (--stage-ar, ver studio.css)
  function updateStageAspect() {
    const f = formatoAtual();
    $('.canvas-wrap').style.setProperty('--stage-ar', String(f.w / f.h));
  }

  /* ---------- thumbnails do carrossel ---------- */
  function renderThumbs() {
    const box = $('#slides');
    box.innerHTML = '';
    const { dw, dh } = thumbDims();
    slides.forEach((sl, i) => {
      const d = document.createElement('div');
      d.className = 'slide-thumb' + (i === state.activeIndex ? ' slide-thumb--active' : '');
      d.style.width = dw + 'px';
      d.style.height = dh + 'px';
      const cv = document.createElement('canvas');
      cv.width = dw * 2; cv.height = dh * 2; // 2x pra ficar nítida (mesma ideia do 176 anterior)
      d.appendChild(cv);
      const tag = document.createElement('span');
      tag.className = 'slide-thumb__tag'; tag.textContent = sl.tag;
      d.appendChild(tag);
      d.onclick = () => { state.activeIndex = i; render(); };
      box.appendChild(d);
      if (ready) {
        const full = renderizarSlide(sl);
        cv.getContext('2d').drawImage(full, 0, 0, full.width, full.height, 0, 0, cv.width, cv.height);
      }
    });
  }

  /* ---------- barra de variante do slide ativo ---------- */
  function renderVariantBar() {
    const bar = $('#variantBar');
    const sl = slides[state.activeIndex];
    const variantesTpl = variantesDoTemplate(obterTemplate(state.templateId));
    // aparece pra qualquer slide com variante (carrossel de fotos OU arte
    // única) — capa/fechamento do formacao não têm `.variant` e ficam de fora
    const mostraBarra = !!(sl && sl.variant != null && variantesTpl.length);
    bar.hidden = !mostraBarra;
    if (!mostraBarra) return;
    const estrategia = estrategiaSlides(state.templateId);
    const opts = $('#variantOpts');
    opts.innerHTML = '';
    variantesTpl.forEach((v) => {
      const b = document.createElement('button');
      b.className = 'vopt' + (v === sl.variant ? ' vopt--on' : '');
      b.textContent = VARIANT_LABELS[v] || v;
      b.onclick = () => {
        if (estrategia === 'unico') {
          state.varianteUnica = v;
        } else {
          const p = state.photos.find((x) => x.id === sl.photoId);
          if (p) p.variant = v;
        }
        buildSlides(); render();
      };
      opts.appendChild(b);
    });
  }

  // texto do placeholder do preview, por modo de picker (spec 003-T4)
  const STAGE_EMPTY_TEXT = {
    fotos: 'Selecione fotos do acervo para montar o carrossel ←',
    avaliacao: 'Escolha uma avaliação aprovada à esquerda ←',
    'foto-unica': 'Preencha os campos ao lado pra gerar a arte',
    nenhum: 'Preencha os campos ao lado pra gerar a arte',
  };
  // há conteúdo suficiente pra gerar a arte? 'fotos' exige ao menos 1 foto
  // selecionada; 'avaliacao' exige uma avaliação escolhida; os demais modos
  // (foto opcional ou só campos) sempre têm uma arte única pronta.
  function temConteudoParaGerar() {
    const modo = pickerMode(obterTemplate(state.templateId));
    if (modo === 'fotos') return state.photos.length > 0;
    if (modo === 'avaliacao') return state.avaliacaoId != null;
    return true;
  }

  /* ---------- preview grande ---------- */
  function render() {
    if (!ready) return;
    const modo = pickerMode(obterTemplate(state.templateId));
    const pronto = temConteudoParaGerar() && slides.length > 0;
    $('#stageEmpty').textContent = STAGE_EMPTY_TEXT[modo] || STAGE_EMPTY_TEXT.fotos;
    $('#stageEmpty').style.display = pronto ? 'none' : 'block';
    $('.canvas-wrap').classList.toggle('show', pronto);
    $('#btnDownOne').disabled = !pronto;
    $('#btnCreatePost').disabled = !pronto;
    if (!pronto) { $('#variantBar').hidden = true; return; }
    if (state.activeIndex >= slides.length) state.activeIndex = 0;
    const cv = renderizarSlide(slides[state.activeIndex]);
    const preview = $('#preview');
    preview.width = cv.width; preview.height = cv.height;
    preview.getContext('2d').drawImage(cv, 0, 0);
    renderThumbs();
    renderVariantBar();
  }

  /* nome amigável da turma p/ arquivo/título — usa o campo "turma" do template
     ativo quando ele existe (e foi preenchido); templates sem esse campo
     (capa_reel/educativo) caem no código oficial da turma (TURMA.codigo). */
  function nomeArquivoTurma() {
    const valor = state.campos.turma;
    const t = (valor != null && valor !== '') ? valor : (TURMA.codigo || '');
    return String(t).replace(/\s+/g, '');
  }

  /* ---------- nome de arquivo por slide (sufixo de formato — kit multi-formato)
     contexto turma: magma-turma<t>-…; Studio da marca: magma-<template>-… ---------- */
  function fname(i, sl, formatoId) {
    const t = nomeArquivoTurma();
    const prefixo = (TURMA.id && t) ? `turma${t}` : (state.templateId || 'marca');
    const kind = sl.type === 'cover' ? 'capa' : sl.type === 'closing' ? 'fechamento' : sl.type === 'unico' ? 'arte' : 'foto';
    return `magma-${prefixo}-${formatoId}-${String(i + 1).padStart(2, '0')}-${kind}.png`;
  }

  /* ---------- baixar uma arte (local) ---------- */
  function downloadCanvas(canvas, name) {
    return new Promise((res) => {
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => { URL.revokeObjectURL(url); res(); }, 400);
      }, 'image/png');
    });
  }
  // baixa só o slide/formato em foco no preview (não é o kit — o kit sai pela Postagem)
  $('#btnDownOne').onclick = async () => {
    const sl = slides[state.activeIndex];
    const cv = renderizarSlide(sl, state.formatoAtivo);
    await downloadCanvas(cv, fname(state.activeIndex, sl, state.formatoAtivo));
  };

  /* ---------- criar postagem (renderiza o kit — todos os formatos marcados
     em "Exportar em" × todos os slides — e envia multipart) ---------- */
  async function createPostagem() {
    if (!slides.length || !temConteudoParaGerar()) return;
    if (!TURMA.id && !MODO_MARCA) return;
    const btn = $('#btnCreatePost');
    const orig = btn.textContent;
    btn.disabled = true;
    try {
      const formatos = state.formatosDisponiveis.filter((f) => state.formatosExport.has(f));
      const kit = formatos.length ? formatos : [state.formatoAtivo];
      const total = slides.length * kit.length;
      const artes = [];
      let feitas = 0;
      for (const formatoId of kit) {
        for (let i = 0; i < slides.length; i++) {
          feitas += 1;
          btn.textContent = `Renderizando ${feitas}/${total}…`;
          const cv = renderizarSlide(slides[i], formatoId);
          const blob = await MagmaTemplates.exportarBlob(cv);
          artes.push({ blob, name: fname(i, slides[i], formatoId) });
        }
      }
      btn.textContent = 'Enviando…';
      const fd = new FormData();
      const t = nomeArquivoTurma();
      // "Carrossel" só faz sentido pra formacao/formatura (várias artes numa
      // sequência); os demais templates são 1 arte só — usa o próprio nome dele.
      const tpl = obterTemplate(state.templateId);
      const rotuloBase = estrategiaSlides(state.templateId) === 'unico' ? (tpl ? tpl.nome : 'Arte') : 'Carrossel';
      fd.append('titulo', (TURMA.id && t) ? `${rotuloBase} Turma ${t}` : rotuloBase);
      fd.append('legenda', state.legenda || '');
      artes.forEach((a) => fd.append('artes', a.blob, a.name));
      // contexto turma → rota histórica; Studio da marca → postagem da marca
      // via rota geral (spec 008)
      const urlPostagem = TURMA.id
        ? `${API_BASE}/turmas/${TURMA.id}/postagens/`
        : `${API_BASE}/postagens/`;
      const postagem = await apiFetch(urlPostagem, { method: 'POST', body: fd });
      postagens.unshift(postagem);
      renderPostagens();
      btn.textContent = 'Postagem criada ✓';
      setTimeout(() => { btn.textContent = orig; btn.disabled = !temConteudoParaGerar(); }, 2000);
    } catch (err) {
      console.error(err);
      alert('Não foi possível criar a postagem: ' + err.message);
      btn.textContent = orig;
      btn.disabled = !temConteudoParaGerar();
    }
  }
  $('#btnCreatePost').onclick = createPostagem;

  /* ---------- painel de postagens (da turma ou da marca) ---------- */
  function loadPostagens() {
    if (!TURMA.id && !MODO_MARCA) return Promise.resolve();
    const url = TURMA.id
      ? `${API_BASE}/turmas/${TURMA.id}/postagens/`
      : `${API_BASE}/postagens/?contexto=marca`;
    return apiFetch(url)
      .then((list) => { postagens = list || []; renderPostagens(); })
      .catch((err) => console.warn('Falha ao carregar postagens:', err));
  }

  const STATUS_STEPS = [['rascunho', 'Rascunho'], ['pronta', 'Pronta'], ['publicada', 'Publicada']];
  function statusIndex(status) {
    const i = STATUS_STEPS.findIndex(([key]) => key === status);
    return i < 0 ? 0 : i;
  }

  function makeBtn(label, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + cls;
    b.textContent = label;
    b.onclick = () => onClick(b);
    return b;
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignora */ }
    document.body.removeChild(ta);
    done();
  }
  function copyLegenda(p, btn) {
    const text = p.legenda || '';
    const orig = btn.textContent;
    const done = () => { btn.textContent = 'copiado ✓'; setTimeout(() => { btn.textContent = orig; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function setStatus(p, status, btn) {
    let urlPublicada = p.url_publicada || '';
    if (status === 'publicada') {
      const resp = window.prompt('URL da publicação (opcional):', urlPublicada);
      if (resp === null) return; // cancelou
      urlPublicada = resp;
    }
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Salvando…';
    const body = { status };
    if (status === 'publicada') body.url_publicada = urlPublicada;
    apiFetch(`${API_BASE}/postagens/${p.id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((updated) => {
        const idx = postagens.findIndex((x) => x.id === p.id);
        if (idx >= 0) postagens[idx] = updated;
        renderPostagens();
        if (status === 'publicada') launchConfetti();
      })
      .catch((err) => {
        alert('Não foi possível atualizar a postagem: ' + err.message);
        btn.disabled = false; btn.textContent = orig;
      });
  }

  function renderPostagemCard(p, open) {
    const el = document.createElement('div');
    el.className = 'postagem-card' + (open ? ' is-open' : '');
    const curIdx = statusIndex(p.status);
    const stepsHtml = STATUS_STEPS.map(([, label], i) => {
      let cls = 'timeline__step';
      if (i < curIdx) cls += ' is-done';
      else if (i === curIdx) cls += ' is-active';
      else cls += ' is-pending';
      const dot = `<div class="${cls}"><span class="timeline__dot"></span><span class="timeline__label">${label}</span></div>`;
      const line = i < STATUS_STEPS.length - 1 ? `<div class="timeline__line ${i < curIdx ? 'is-done' : ''}"></div>` : '';
      return dot + line;
    }).join('');
    const thumbsHtml = (p.artes || [])
      .map((a) => `<img class="postagem-card__thumb" src="${a.thumb_url || a.arquivo_url}" alt="">`)
      .join('');
    const statusLabel = (STATUS_STEPS[curIdx] || STATUS_STEPS[0])[1];
    el.innerHTML = `
      <div class="postagem-card__head">
        <span class="postagem-card__caret">▶</span>
        <span class="postagem-card__title">
          <strong>${escapeHtml(p.titulo || '')}</strong>
          <span class="postagem-card__date">${formatDate(p.criado_em)}</span>
        </span>
        <span class="postagem-card__chip postagem-card__chip--${p.status}">${statusLabel}</span>
      </div>
      <div class="postagem-card__body">
        <div class="timeline">${stepsHtml}</div>
        <div class="postagem-card__thumbs">${thumbsHtml}</div>
        <div class="postagem-card__actions"></div>
      </div>
    `;
    // accordion: clicar no cabeçalho abre este e fecha os outros (no máximo 1 aberto)
    el.querySelector('.postagem-card__head').onclick = () => {
      const jaAberto = el.classList.contains('is-open');
      el.parentNode.querySelectorAll('.postagem-card.is-open').forEach((c) => c.classList.remove('is-open'));
      if (!jaAberto) el.classList.add('is-open');
    };
    const actions = el.querySelector('.postagem-card__actions');
    actions.appendChild(makeBtn('Baixar ZIP', 'btn--ghost btn--sm', () => {
      window.location.href = `${API_BASE}/postagens/${p.id}/zip/`;
    }));
    actions.appendChild(makeBtn('Copiar legenda', 'btn--ghost btn--sm', (btn) => copyLegenda(p, btn)));
    if (p.status === 'rascunho') {
      actions.appendChild(makeBtn('Marcar pronta', 'btn--gold btn--sm', (btn) => setStatus(p, 'pronta', btn)));
    } else if (p.status === 'pronta') {
      actions.appendChild(makeBtn('Marcar publicada', 'btn--gold btn--sm', (btn) => setStatus(p, 'publicada', btn)));
    } else if (p.status === 'publicada' && p.url_publicada) {
      const a = document.createElement('a');
      a.href = p.url_publicada; a.target = '_blank'; a.rel = 'noopener';
      a.className = 'btn btn--ghost btn--sm';
      a.textContent = 'Ver publicação ↗';
      actions.appendChild(a);
    }
    return el;
  }

  function renderPostagens() {
    const box = $('#postagensList');
    const empty = $('#postagensEmpty');
    empty.hidden = postagens.length !== 0;
    box.innerHTML = '';
    // só a primeira (mais recente) começa aberta — as demais ficam recolhidas
    postagens.forEach((p, i) => box.appendChild(renderPostagemCard(p, i === 0)));
  }

  /* ---------- confete (porte de CarteirinhaExperience.tsx) ---------- */
  function launchConfetti() {
    const layer = $('#confettiLayer');
    const colors = ['#b8933f', '#dcb96a', '#c8102e', '#1d4f91', '#faf8f4'];
    for (let i = 0; i < 46; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      const size = 5 + Math.random() * 6;
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.width = size + 'px';
      piece.style.height = size * (Math.random() > 0.5 ? 1 : 2.2) + 'px';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.setProperty('--rot', `${(Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360)}deg`);
      piece.style.animationDuration = 2.2 + Math.random() * 1.6 + 's';
      piece.style.animationDelay = Math.random() * 0.4 + 's';
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), 4200);
    }
  }

  /* ---------- colunas ajustáveis ---------- */
  function initResizers() {
    const root = document.documentElement;
    const LIMITS = { picker: [200, 420, '--col-picker'], panel: [280, 640, '--col-panel'] };
    try {
      const saved = JSON.parse(localStorage.getItem('magma_studio_cols') || 'null');
      if (saved) {
        if (saved.picker) root.style.setProperty('--col-picker', saved.picker + 'px');
        if (saved.panel) root.style.setProperty('--col-panel', saved.panel + 'px');
      }
    } catch (e) { /* ignora */ }

    document.querySelectorAll('.gutter').forEach((g) => {
      g.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const [min, max, varName] = LIMITS[g.dataset.target];
        const startX = e.clientX;
        const startW = parseFloat(getComputedStyle(root).getPropertyValue(varName)) || min;
        document.body.classList.add('resizing');
        try { g.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
        const onMove = (ev) => {
          const w = Math.max(min, Math.min(max, startW + (ev.clientX - startX)));
          root.style.setProperty(varName, w + 'px');
        };
        const onUp = () => {
          document.body.classList.remove('resizing');
          g.removeEventListener('pointermove', onMove);
          g.removeEventListener('pointerup', onUp);
          const read = (v) => parseFloat(getComputedStyle(root).getPropertyValue(v));
          try {
            localStorage.setItem('magma_studio_cols', JSON.stringify({
              picker: read('--col-picker'), panel: read('--col-panel'),
            }));
          } catch (e) { /* ignora */ }
        };
        g.addEventListener('pointermove', onMove);
        g.addEventListener('pointerup', onUp);
      });
    });
  }
  initResizers();

  /* ---------- init ---------- */
  (function initUiTemplateAtual() {
    const tpl = obterTemplate(state.templateId);
    $('#panelTitle').textContent = tpl ? (tpl.nome || '') : '';
    $('#panelDesc').textContent = tpl ? (tpl.descricao || '') : '';
    renderTemplateSelector();
    renderCampos();
    renderFormatoSelector();
    renderExportKit();
    renderPickerContainer();
    updateStageAspect();
    if (pickerMode(tpl) === 'avaliacao') loadAvaliacoes();
  })();

  // troca de camada no picker: recarrega a grade daquela camada; a seleção
  // já feita (state.photos/fotoUnica) fica intacta — dá pra misturar camadas
  const pickerCamadaSel = $('#pickerCamada');
  if (pickerCamadaSel) {
    pickerCamadaSel.addEventListener('change', () => {
      camadaFoto = pickerCamadaSel.value;
      loadAcervo();
    });
  }

  Promise.all([MagmaTemplates.ready(), loadAcervo(), loadCamadasPicker()])
    .then(() => (pickerMode(obterTemplate(state.templateId)) === 'fotos' ? preselectDestaques() : Promise.resolve()))
    .then(() => {
      ready = true;
      renderPicker();
      renderFotoUnicaControls();
      renderPhotoList();
      buildSlides();
      render();
    })
    .catch((err) => {
      console.error(err);
      ready = true;
      render();
    });
  loadPostagens();
})();
