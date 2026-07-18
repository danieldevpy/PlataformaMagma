/* ============================================================
   MAGMA STUDIO INTEGRADO — app (acervo, carrossel, postagens)
   Porta de mvp-apps/studio/montar-templates/app/js/app.js, adaptada
   pra ler fotos do Acervo da Turma (API /api/midia/) em vez de upload
   local, e pra criar/gerenciar Postagens. Motor de canvas intocado
   (templates-engine.js == cópia do MVP).
   ============================================================ */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const DPR = 2; // exporta 2160px internos → PNG nítido

  const API_BASE = window.MAGMA_API_BASE || '/api/midia';
  const TURMA = window.MAGMA_TURMA || { id: null, codigo: '', curso: '' };
  const CSRF = window.MAGMA_CSRF || '';

  // deslocamento vertical da foto no quadro (0=topo … 0.5=centro … 1=base)
  const OFFSET_STEP = 0.1;
  const clampOffset = (v) => Math.max(0, Math.min(1, +v.toFixed(3)));

  // variantes de slide de foto (rótulos p/ UI)
  const VARIANT_LABELS = { moldura: 'Moldura', lateral: 'Lateral', full: 'Foto cheia', classic: 'Clássico' };
  const VARIANTS = window.MagmaTemplates ? MagmaTemplates.PHOTO_VARIANTS : ['moldura', 'lateral', 'full', 'classic'];

  // sorteio com "saco embaralhado": todas aparecem antes de repetir, sem repetir a anterior
  let variantBag = [];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function pickVariant(prev) {
    if (!variantBag.length) variantBag = shuffle(VARIANTS.slice());
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

  const LEGENDA_TEMPLATE = '🎓 Turma {{codigo}} formada! Parabéns aos nossos alunos de {{curso}}. #magmacursos #aph';
  function legendaDefault() {
    return LEGENDA_TEMPLATE
      .replace('{{codigo}}', TURMA.codigo || '')
      .replace('{{curso}}', TURMA.curso || '');
  }

  const state = {
    turma: digitsOrCodigo(TURMA.codigo),
    frase: 'Parabéns à nossa turma!',
    instagram: '@magma_curso',
    whatsapp: '(21) 97100-5197',
    legenda: legendaDefault(),
    photos: [],            // {id, itemId, name, img, offsetY, variant}
    destaqueId: null,      // foto usada na capa/fechamento
    activeIndex: 0,        // slide em foco
  };
  let slides = [];
  let uid = 0;
  let ready = false;
  let acervoItens = [];   // itens tipo=foto do acervo da turma
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

  /* ---------- campos ---------- */
  $('#fTurma').value = state.turma;
  $('#fFrase').value = state.frase;
  $('#fInsta').value = state.instagram;
  $('#fZap').value = state.whatsapp;
  $('#fLegenda').value = state.legenda;

  const bindField = (sel, key, rebuild) => {
    $(sel).addEventListener('input', (e) => {
      state[key] = e.target.value;
      if (rebuild) { buildSlides(); render(); }
    });
  };
  bindField('#fTurma', 'turma', true);
  bindField('#fFrase', 'frase', true);
  bindField('#fInsta', 'instagram', true);
  bindField('#fZap', 'whatsapp', true);
  bindField('#fLegenda', 'legenda', false);

  /* ---------- acervo → picker de fotos ---------- */
  function loadAcervo() {
    if (!TURMA.id) return Promise.resolve();
    return apiFetch(`${API_BASE}/turmas/${TURMA.id}/acervo/`)
      .then((data) => {
        acervoItens = (data.itens || []).filter((it) => it.tipo === 'foto');
        renderPicker();
      })
      .catch((err) => {
        console.error('Falha ao carregar acervo:', err);
        const empty = $('#pickerEmpty');
        empty.hidden = false;
        empty.classList.add('picker__error');
        empty.textContent = 'Não foi possível carregar o acervo da turma.';
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
    if (isSelected(item.id)) {
      removePhotoByItemId(item.id);
      renderPicker(); renderPhotoList(); buildSlides(); render();
    } else {
      addPhoto(item)
        .then(() => { renderPicker(); renderPhotoList(); buildSlides(); render(); })
        .catch(() => alert('Não foi possível carregar esta foto do acervo.'));
    }
  }

  function renderPicker() {
    const grid = $('#pickerGrid');
    const empty = $('#pickerEmpty');
    if (!empty.classList.contains('picker__error')) {
      empty.hidden = acervoItens.length !== 0;
      empty.textContent = 'Nenhuma foto no acervo ainda. Envie fotos na Mesa de Luz da turma.';
    }
    grid.innerHTML = '';
    acervoItens.forEach((item) => {
      const selIdx = state.photos.findIndex((p) => p.itemId === item.id);
      const sel = selIdx >= 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pick' + (sel ? ' pick--on' : '');
      btn.title = item.legenda || '';
      const isDestaque = Array.isArray(item.tags) && item.tags.includes('destaque');
      btn.innerHTML =
        `<img src="${item.thumb_url || item.arquivo_url}" alt="" loading="lazy">` +
        (sel ? `<span class="pick__order">${selIdx + 1}</span>` : '') +
        (isDestaque ? '<span class="pick__star" title="Destaque no acervo">★</span>' : '');
      btn.onclick = () => onPickClick(item);
      grid.appendChild(btn);
    });
    $('#pickerCount').textContent = `${state.photos.length} selecionada${state.photos.length === 1 ? '' : 's'}`;
  }

  /* ---------- lista de fotos selecionadas (controles) ---------- */
  function renderPhotoList() {
    const box = $('#photoList');
    const ul = $('#photoItems');
    box.hidden = state.photos.length === 0;
    ul.innerHTML = '';
    state.photos.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'pitem';
      const isStar = p.id === state.destaqueId;
      li.innerHTML =
        `<img class="pitem__thumb" src="${p.img.src}" alt="">
         <span class="pitem__name">${escapeHtml(p.name)}</span>
         ${isStar ? '<span class="pitem__tag">fechamento</span>' : ''}
         <span class="pitem__btns">
           <button class="iconbtn imgup" title="Subir imagem no quadro" ${p.offsetY >= 1 ? 'disabled' : ''}>↥</button>
           <button class="iconbtn imgdn" title="Descer imagem no quadro" ${p.offsetY <= 0 ? 'disabled' : ''}>↧</button>
           <button class="iconbtn star ${isStar ? 'star--on' : ''}" title="Usar como foto do fechamento">★</button>
           <button class="iconbtn up" title="Reordenar para cima" ${i === 0 ? 'disabled' : ''}>↑</button>
           <button class="iconbtn down" title="Reordenar para baixo" ${i === state.photos.length - 1 ? 'disabled' : ''}>↓</button>
           <button class="iconbtn rm" title="Remover da seleção">✕</button>
         </span>`;
      const nudge = (dir) => { p.offsetY = clampOffset(p.offsetY + dir * OFFSET_STEP); renderPhotoList(); buildSlides(); render(); };
      li.querySelector('.imgup').onclick = () => nudge(+1); // sobe a foto → revela a parte de baixo
      li.querySelector('.imgdn').onclick = () => nudge(-1); // desce a foto → revela a parte de cima
      li.querySelector('.star').onclick = () => { state.destaqueId = p.id; renderPhotoList(); buildSlides(); render(); };
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

  /* ---------- montagem do carrossel ---------- */
  function destaquePhoto() {
    return state.photos.find((x) => x.id === state.destaqueId) || state.photos[0] || null;
  }
  function buildSlides() {
    slides = [];
    slides.push({ type: 'cover', tag: 'Capa' });
    let n = 0;
    state.photos.forEach((p) => {
      if (p.id === state.destaqueId) return; // reservada só para o fechamento
      slides.push({ type: 'photo', img: p.img, offsetY: p.offsetY, variant: p.variant, photoId: p.id, tag: `Foto ${++n}` });
    });
    const dp = destaquePhoto();
    slides.push({ type: 'closing', img: dp ? dp.img : null, offsetY: dp ? dp.offsetY : 0.5, tag: 'Fechamento' });
    if (state.activeIndex >= slides.length) state.activeIndex = 0;
    renderThumbs();
  }
  function slidesCount() { return slides.length; }

  /* ---------- thumbnails do carrossel ---------- */
  function renderThumbs() {
    const box = $('#slides');
    box.innerHTML = '';
    slides.forEach((sl, i) => {
      const d = document.createElement('div');
      d.className = 'slide-thumb' + (i === state.activeIndex ? ' slide-thumb--active' : '');
      const cv = document.createElement('canvas');
      cv.width = 176; cv.height = 176;
      d.appendChild(cv);
      const tag = document.createElement('span');
      tag.className = 'slide-thumb__tag'; tag.textContent = sl.tag;
      d.appendChild(tag);
      d.onclick = () => { state.activeIndex = i; render(); };
      box.appendChild(d);
      if (ready) MagmaTemplates.render(cv, sl, state, 176 / MagmaTemplates.SIZE);
    });
  }

  /* ---------- barra de variante do slide ativo ---------- */
  function renderVariantBar() {
    const bar = $('#variantBar');
    const sl = slides[state.activeIndex];
    const isPhoto = sl && sl.type === 'photo';
    bar.hidden = !isPhoto;
    if (!isPhoto) return;
    const opts = $('#variantOpts');
    opts.innerHTML = '';
    VARIANTS.forEach((v) => {
      const b = document.createElement('button');
      b.className = 'vopt' + (v === sl.variant ? ' vopt--on' : '');
      b.textContent = VARIANT_LABELS[v] || v;
      b.onclick = () => {
        const p = state.photos.find((x) => x.id === sl.photoId);
        if (p) { p.variant = v; buildSlides(); render(); }
      };
      opts.appendChild(b);
    });
  }

  /* ---------- preview grande ---------- */
  function render() {
    if (!ready) return;
    const has = slides.length > 0;
    $('#stageEmpty').style.display = state.photos.length ? 'none' : 'block';
    $('.canvas-wrap').classList.toggle('show', state.photos.length > 0);
    $('#btnDownOne').disabled = !state.photos.length;
    $('#btnCreatePost').disabled = !state.photos.length;
    if (!has) { $('#variantBar').hidden = true; return; }
    if (state.activeIndex >= slides.length) state.activeIndex = 0;
    MagmaTemplates.render($('#preview'), slides[state.activeIndex], state, DPR);
    renderThumbs();
    renderVariantBar();
  }

  /* ---------- nome de arquivo por slide ---------- */
  function fname(i, sl) {
    const t = String(state.turma).replace(/\s+/g, '');
    const kind = sl.type === 'cover' ? 'capa' : sl.type === 'closing' ? 'fechamento' : 'foto';
    return `magma-turma${t}-${String(i + 1).padStart(2, '0')}-${kind}.png`;
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
  $('#btnDownOne').onclick = async () => {
    const sl = slides[state.activeIndex];
    const cv = document.createElement('canvas');
    MagmaTemplates.render(cv, sl, state, DPR);
    await downloadCanvas(cv, fname(state.activeIndex, sl));
  };

  /* ---------- criar postagem (renderiza tudo, envia multipart) ---------- */
  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  async function createPostagem() {
    if (!slides.length || !TURMA.id) return;
    const btn = $('#btnCreatePost');
    const orig = btn.textContent;
    btn.disabled = true;
    try {
      const artes = [];
      for (let i = 0; i < slides.length; i++) {
        btn.textContent = `Renderizando ${i + 1}/${slides.length}…`;
        const cv = document.createElement('canvas');
        MagmaTemplates.render(cv, slides[i], state, DPR);
        const blob = await canvasToBlob(cv);
        artes.push({ blob, name: fname(i, slides[i]) });
      }
      btn.textContent = 'Enviando…';
      const fd = new FormData();
      const t = String(state.turma).replace(/\s+/g, '');
      fd.append('titulo', `Carrossel Turma ${t}`);
      fd.append('legenda', state.legenda || '');
      artes.forEach((a) => fd.append('artes', a.blob, a.name));
      const postagem = await apiFetch(`${API_BASE}/turmas/${TURMA.id}/postagens/`, { method: 'POST', body: fd });
      postagens.unshift(postagem);
      renderPostagens();
      btn.textContent = 'Postagem criada ✓';
      setTimeout(() => { btn.textContent = orig; btn.disabled = !state.photos.length; }, 2000);
    } catch (err) {
      console.error(err);
      alert('Não foi possível criar a postagem: ' + err.message);
      btn.textContent = orig;
      btn.disabled = !state.photos.length;
    }
  }
  $('#btnCreatePost').onclick = createPostagem;

  /* ---------- painel de postagens da turma ---------- */
  function loadPostagens() {
    if (!TURMA.id) return Promise.resolve();
    return apiFetch(`${API_BASE}/turmas/${TURMA.id}/postagens/`)
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

  function renderPostagemCard(p) {
    const el = document.createElement('div');
    el.className = 'postagem-card';
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
    el.innerHTML = `
      <div class="postagem-card__head">
        <strong>${escapeHtml(p.titulo || '')}</strong>
        <span class="postagem-card__date">${formatDate(p.criado_em)}</span>
      </div>
      <div class="timeline">${stepsHtml}</div>
      <div class="postagem-card__thumbs">${thumbsHtml}</div>
      <div class="postagem-card__actions"></div>
    `;
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
    postagens.forEach((p) => box.appendChild(renderPostagemCard(p)));
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
  Promise.all([MagmaTemplates.ready(), loadAcervo()])
    .then(() => preselectDestaques())
    .then(() => {
      ready = true;
      renderPicker();
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
