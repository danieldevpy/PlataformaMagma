/* ============================================================
   MAGMA STUDIO — app (estado, upload, carrossel, download)
   ============================================================ */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const DPR = 2; // exporta 2160px internos → PNG nítido

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

  const state = {
    turma: '025',
    frase: 'Parabéns à nossa turma!',
    instagram: '@magma_curso',
    whatsapp: '(21) 97100-5197',
    photos: [],            // {id, name, img}
    destaqueId: null,      // foto usada na capa/fechamento
    activeIndex: 0,        // slide em foco
  };
  let slides = [];
  let uid = 0;
  let ready = false;

  /* símbolo na sidebar */
  $('#brandMark').innerHTML =
    `<svg viewBox="0 0 100 110"><polygon points="50,8 90,31 90,79 50,102 10,79 10,31" fill="#232c3d" stroke="#232c3d" stroke-width="12" stroke-linejoin="round"/><polygon points="50,15 84.5,35 84.5,75 50,95 15.5,75 15.5,35" fill="#fff" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><polygon points="50,19 81,37 81,73 50,91 19,73 19,37" fill="#c8102e" stroke="#c8102e" stroke-width="7" stroke-linejoin="round"/><g transform="translate(50,55)"><g fill="#fff"><rect x="-9" y="-27" width="18" height="54" rx="3.5"/><rect x="-9" y="-27" width="18" height="54" rx="3.5" transform="rotate(60)"/><rect x="-9" y="-27" width="18" height="54" rx="3.5" transform="rotate(-60)"/></g><g fill="#1d4f91"><rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4"/><rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4" transform="rotate(60)"/><rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4" transform="rotate(-60)"/></g><circle cx="0" cy="-17.5" r="3.1" fill="#fff"/><rect x="-1.7" y="-15" width="3.4" height="33" rx="1.7" fill="#fff"/><path d="M-5 -10 C 6 -7.5, 6 -3.5, 0 -1.5 C -6 0.5, -6 4.5, 0 6.5 C 5 8.2, 5 11.5, -3 13.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></g></svg>`;

  /* ---------- campos ---------- */
  const bindField = (sel, key) => {
    $(sel).addEventListener('input', (e) => { state[key] = e.target.value; buildSlides(); render(); });
  };
  bindField('#fTurma', 'turma');
  bindField('#fFrase', 'frase');
  bindField('#fInsta', 'instagram');
  bindField('#fZap', 'whatsapp');

  /* ---------- upload ---------- */
  const uploader = $('#uploader');
  const fileInput = $('#fileInput');
  uploader.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => addFiles(e.target.files));
  ['dragenter', 'dragover'].forEach((ev) =>
    uploader.addEventListener(ev, (e) => { e.preventDefault(); uploader.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) =>
    uploader.addEventListener(ev, (e) => { e.preventDefault(); uploader.classList.remove('drag'); }));
  uploader.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

  function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    const slots = new Array(files.length).fill(undefined); // preserva a ordem de upload
    let pending = files.length;
    const done = () => {
      if (--pending > 0) return;
      slots.filter(Boolean).forEach((p) => {
        const prev = state.photos.length ? state.photos[state.photos.length - 1].variant : null;
        p.variant = pickVariant(prev);
        state.photos.push(p);
        if (state.destaqueId == null) state.destaqueId = p.id;
      });
      renderPhotoList(); buildSlides(); render();
    };
    files.forEach((f, idx) => {
      const img = new Image();
      img.onload = () => { slots[idx] = { id: ++uid, name: f.name, img, offsetY: 0.5 }; done(); };
      img.onerror = () => { slots[idx] = null; done(); };
      img.src = URL.createObjectURL(f);
    });
    fileInput.value = '';
  }

  /* ---------- lista de fotos ---------- */
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
         <span class="pitem__name">${p.name}</span>
         ${isStar ? '<span class="pitem__tag">fechamento</span>' : ''}
         <span class="pitem__btns">
           <button class="iconbtn imgup" title="Subir imagem no quadro" ${p.offsetY >= 1 ? 'disabled' : ''}>↥</button>
           <button class="iconbtn imgdn" title="Descer imagem no quadro" ${p.offsetY <= 0 ? 'disabled' : ''}>↧</button>
           <button class="iconbtn star ${isStar ? 'star--on' : ''}" title="Usar como foto do fechamento">★</button>
           <button class="iconbtn up" title="Reordenar para cima" ${i === 0 ? 'disabled' : ''}>↑</button>
           <button class="iconbtn down" title="Reordenar para baixo" ${i === state.photos.length - 1 ? 'disabled' : ''}>↓</button>
           <button class="iconbtn rm" title="Remover">✕</button>
         </span>`;
      const nudge = (dir) => { p.offsetY = clampOffset(p.offsetY + dir * OFFSET_STEP); renderPhotoList(); buildSlides(); render(); };
      li.querySelector('.imgup').onclick = () => nudge(+1); // sobe a foto → revela a parte de baixo
      li.querySelector('.imgdn').onclick = () => nudge(-1); // desce a foto → revela a parte de cima
      li.querySelector('.star').onclick = () => { state.destaqueId = p.id; renderPhotoList(); buildSlides(); render(); };
      li.querySelector('.up').onclick = () => move(i, -1);
      li.querySelector('.down').onclick = () => move(i, 1);
      li.querySelector('.rm').onclick = () => remove(i);
      ul.appendChild(li);
    });
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= state.photos.length) return;
    [state.photos[i], state.photos[j]] = [state.photos[j], state.photos[i]];
    renderPhotoList(); buildSlides(); render();
  }
  function remove(i) {
    const [p] = state.photos.splice(i, 1);
    if (p.id === state.destaqueId) state.destaqueId = state.photos[0] ? state.photos[0].id : null;
    if (state.activeIndex >= slidesCount()) state.activeIndex = 0;
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
    $('#btnDownAll').disabled = !state.photos.length;
    if (!has) { $('#variantBar').hidden = true; return; }
    if (state.activeIndex >= slides.length) state.activeIndex = 0;
    MagmaTemplates.render($('#preview'), slides[state.activeIndex], state, DPR);
    renderThumbs();
    renderVariantBar();
  }

  /* ---------- download ---------- */
  function fname(i, sl) {
    const t = String(state.turma).replace(/\s+/g, '');
    const kind = sl.type === 'cover' ? 'capa' : sl.type === 'closing' ? 'fechamento' : 'foto';
    return `magma-turma${t}-${String(i + 1).padStart(2, '0')}-${kind}.png`;
  }
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
  $('#btnDownAll').onclick = async () => {
    const btn = $('#btnDownAll');
    btn.disabled = true; const orig = btn.textContent;
    for (let i = 0; i < slides.length; i++) {
      btn.textContent = `Baixando ${i + 1}/${slides.length}…`;
      const cv = document.createElement('canvas');
      MagmaTemplates.render(cv, slides[i], state, DPR);
      await downloadCanvas(cv, fname(i, slides[i]));
    }
    btn.textContent = orig; btn.disabled = false;
  };

  /* ---------- colunas ajustáveis ---------- */
  function initResizers() {
    const root = document.documentElement;
    const LIMITS = { sidebar: [170, 420, '--col-sidebar'], panel: [280, 640, '--col-panel'] };
    try {
      const saved = JSON.parse(localStorage.getItem('magma_cols') || 'null');
      if (saved) {
        if (saved.sidebar) root.style.setProperty('--col-sidebar', saved.sidebar + 'px');
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
            localStorage.setItem('magma_cols', JSON.stringify({
              sidebar: read('--col-sidebar'), panel: read('--col-panel'),
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
  MagmaTemplates.ready().then(() => {
    ready = true;
    buildSlides();
    render();
  });
})();
