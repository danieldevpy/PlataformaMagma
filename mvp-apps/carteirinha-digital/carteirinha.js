(() => {
  'use strict';

  /* ------------------------------------------------------------
     0. dados vindos do link (query string) — a turma/curso já é
     conhecida antes do aluno preencher qualquer coisa.
     ex: carteirinha-digital/?curso=Socorrista+de+Emerg%C3%AAncia+(APH)&codigo=APH&validade=24
  ------------------------------------------------------------- */
  const params = new URLSearchParams(location.search);
  const CURSO = params.get('curso') || 'Socorrista de Emergência (APH)';
  const CODIGO = (params.get('codigo') || 'APH').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'MAG';
  const VALIDADE_MESES = parseInt(params.get('validade'), 10) || 24;

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ------------------------------------------------------------
     1. revelar elementos de entrada + curso no subtítulo
  ------------------------------------------------------------- */
  $('#subCurso').textContent = CURSO;
  $('#cardCourse').textContent = CURSO;

  requestAnimationFrame(() => {
    $$('.reveal').forEach(el => el.classList.add('in'));
  });

  const idCard = $('#idCard');
  idCard.classList.add('settling');

  /* ------------------------------------------------------------
     2. matrícula + validade "materializam" sozinhas ao carregar
     (dado do sistema, não do aluno) com efeito de contagem
  ------------------------------------------------------------- */
  function randDigits(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
    return s;
  }

  function formatDatePtBr(d) {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const matricula = `${CODIGO}-${yy}${mm}-${randDigits(4)}`;

  const validadeDate = new Date(now);
  validadeDate.setMonth(validadeDate.getMonth() + VALIDADE_MESES);

  function typeInto(el, text, speed = 55) {
    el.textContent = '';
    let i = 0;
    return new Promise(resolve => {
      const t = setInterval(() => {
        el.textContent += text[i];
        i++;
        if (i >= text.length) { clearInterval(t); resolve(); }
      }, speed);
    });
  }

  setTimeout(() => {
    typeInto($('#cardMatricula'), matricula, 45);
    typeInto($('#cardValidade'), formatDatePtBr(validadeDate), 55);
    drawQrMock(matricula);
  }, 1000);

  /* ------------------------------------------------------------
     3. QR mock — grade determinística a partir da matrícula,
     puramente decorativa (não é um QR escaneável real)
  ------------------------------------------------------------- */
  function drawQrMock(seedStr) {
    const canvas = $('#qrMock');
    const ctx = canvas.getContext('2d');
    const size = canvas.width, cells = 9, cell = size / cells;
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    function rand() { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 16) / 65535; }

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#101c38';

    const isFinder = (x, y) => (x < 3 && y < 3) || (x >= cells - 3 && y < 3) || (x < 3 && y >= cells - 3);

    for (let x = 0; x < cells; x++) {
      for (let y = 0; y < cells; y++) {
        if (isFinder(x, y)) continue;
        if (rand() > 0.52) ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    // três "olhos" de localizador, como em QR reais
    [[0, 0], [cells - 3, 0], [0, cells - 3]].forEach(([fx, fy]) => {
      ctx.fillRect(fx * cell, fy * cell, cell * 3, cell * 3);
      ctx.fillStyle = '#fff';
      ctx.fillRect((fx + 0.6) * cell, (fy + 0.6) * cell, cell * 1.8, cell * 1.8);
      ctx.fillStyle = '#101c38';
      ctx.fillRect((fx + 1) * cell, (fy + 1) * cell, cell * 1, cell * 1);
    });
  }

  /* ------------------------------------------------------------
     4. tilt 3D do cartão (desktop) — parallax sutil ao mover o mouse
  ------------------------------------------------------------- */
  const cardStage = $('#cardStage');
  let tiltRaf = null;
  cardStage.addEventListener('mousemove', (e) => {
    const rect = idCard.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    if (tiltRaf) cancelAnimationFrame(tiltRaf);
    tiltRaf = requestAnimationFrame(() => {
      idCard.style.setProperty('--ry', `${px * 14}deg`);
      idCard.style.setProperty('--rx', `${-py * 14}deg`);
    });
  });
  cardStage.addEventListener('mouseleave', () => {
    idCard.style.setProperty('--ry', '0deg');
    idCard.style.setProperty('--rx', '0deg');
  });

  /* ------------------------------------------------------------
     5. fluxo do bottom sheet
  ------------------------------------------------------------- */
  const steps = $$('.step');
  const TOTAL = steps.length;
  let current = 0;
  const answers = {};

  const backdrop = $('#backdrop');
  const sheet = $('#sheet');
  const sheetBack = $('#sheetBack');
  const sheetNext = $('#sheetNext');
  const sheetCount = $('#sheetCount');
  const dots = $$('.sheet-progress .dot');

  function openSheet() {
    $('#fillBtn').style.display = 'none';
    document.body.classList.add('filling');
    backdrop.classList.add('show');
    sheet.classList.add('show');
    goToStep(0);
  }

  function closeSheet() {
    document.body.classList.remove('filling');
    backdrop.classList.remove('show');
    sheet.classList.remove('show');
  }

  /* teclado mobile: mantém o botão "avançar" visível acima do teclado
     em vez de deixá-lo escondido atrás dele */
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const onVVResize = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb-inset', (kb > 60 ? kb : 0) + 'px');
    };
    vv.addEventListener('resize', onVVResize);
    vv.addEventListener('scroll', onVVResize);
  }

  function goToStep(i) {
    current = i;
    steps.forEach(s => s.classList.toggle('active', Number(s.dataset.step) === i));
    dots.forEach(d => {
      const di = Number(d.dataset.i);
      d.classList.toggle('active', di === i);
      d.classList.toggle('done', di < i);
    });
    sheetCount.textContent = `${i + 1}/${TOTAL}`;
    sheetBack.classList.toggle('show', i > 0);
    focusCurrentInput();
  }

  function focusCurrentInput() {
    const active = steps[current];
    const input = active.querySelector('input[type="text"]');
    if (input) setTimeout(() => input.focus(), 380);
  }

  $('#fillBtn').addEventListener('click', openSheet);
  sheetBack.addEventListener('click', () => { if (current > 0) goToStep(current - 1); });

  /* ---- máscaras ---- */
  const inpCPF = $('#inpCPF');
  inpCPF.addEventListener('input', () => {
    let v = inpCPF.value.replace(/\D/g, '').slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    inpCPF.value = v;
  });

  const inpBirth = $('#inpBirth');
  inpBirth.addEventListener('input', () => {
    let v = inpBirth.value.replace(/\D/g, '').slice(0, 8);
    v = v.replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2');
    inpBirth.value = v;
  });

  /* ---- Enter avança ---- */
  $$('.step input[type="text"]').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); handleNext(); }
    });
  });

  function shakeInput(inp) {
    inp.classList.remove('shake');
    void inp.offsetWidth;
    inp.classList.add('shake');
  }

  function validateStep(i) {
    if (i === 0) {
      const v = $('#inpNome').value.trim();
      if (v.length < 3) { shakeInput($('#inpNome')); return null; }
      return v.replace(/\s+/g, ' ');
    }
    if (i === 1) {
      const v = inpCPF.value.replace(/\D/g, '');
      if (v.length !== 11) { shakeInput(inpCPF); return null; }
      return inpCPF.value;
    }
    if (i === 2) {
      const v = inpBirth.value;
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(v)) { shakeInput(inpBirth); return null; }
      return v;
    }
    if (i === 3) return answers.photo || null; // pode ser preenchido via skip
    return null;
  }

  /* ------------------------------------------------------------
     6. animação "fly" — clona o valor e voa até a posição no cartão
  ------------------------------------------------------------- */
  function flyText(sourceEl, targetEl, text) {
    return new Promise(resolve => {
      const sRect = sourceEl.getBoundingClientRect();
      const tRect = targetEl.getBoundingClientRect();
      const sStyle = getComputedStyle(sourceEl);
      const tStyle = getComputedStyle(targetEl);

      const ghost = document.createElement('span');
      ghost.className = 'fly-ghost';
      ghost.textContent = text;
      ghost.style.left = sRect.left + 'px';
      ghost.style.top = sRect.top + 'px';
      ghost.style.fontSize = sStyle.fontSize;
      document.body.appendChild(ghost);

      const targetFont = parseFloat(tStyle.fontSize);
      const sourceFont = parseFloat(sStyle.fontSize);
      const scale = targetFont / sourceFont;
      const dx = tRect.left - sRect.left;
      const dy = tRect.top - sRect.top;

      const anim = ghost.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.6}px) scale(${(1 + scale) / 2})`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0, offset: 1 }
      ], { duration: 620, easing: 'cubic-bezier(.3,0,.2,1)' });

      anim.onfinish = () => {
        ghost.remove();
        targetEl.textContent = text;
        targetEl.classList.remove('placeholder');
        targetEl.classList.add('filled-pop');
        setTimeout(() => targetEl.classList.remove('filled-pop'), 500);
        resolve();
      };
    });
  }

  function flyPhoto(sourceEl, targetEl) {
    return new Promise(resolve => {
      const sRect = sourceEl.getBoundingClientRect();
      const tRect = targetEl.getBoundingClientRect();

      const ghost = document.createElement('img');
      ghost.src = sourceEl.src || '';
      ghost.className = 'fly-photo';
      ghost.style.left = sRect.left + 'px';
      ghost.style.top = sRect.top + 'px';
      ghost.style.width = sRect.width + 'px';
      ghost.style.height = sRect.height + 'px';
      document.body.appendChild(ghost);

      const dx = tRect.left - sRect.left;
      const dy = tRect.top - sRect.top;
      const scaleW = tRect.width / sRect.width;
      const scaleH = tRect.height / sRect.height;

      const anim = ghost.animate([
        { transform: 'translate(0,0) scale(1,1)', borderRadius: '10px', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scaleW}, ${scaleH})`, borderRadius: '50%', opacity: 1 }
      ], { duration: 650, easing: 'cubic-bezier(.3,0,.2,1)' });

      anim.onfinish = () => {
        ghost.remove();
        if (targetEl.dataset.imgSrc) {
          targetEl.style.backgroundImage = `url(${targetEl.dataset.imgSrc})`;
        }
        targetEl.classList.add('filled', 'pop');
        targetEl.innerHTML = '';
        setTimeout(() => targetEl.classList.remove('pop'), 500);
        resolve();
      };
    });
  }

  /* ------------------------------------------------------------
     7. foto: upload real ou fallback de iniciais
  ------------------------------------------------------------- */
  const photoDrop = $('#photoDrop');
  const photoDropEmpty = $('#photoDropEmpty');
  const photoPreviewImg = $('#photoPreviewImg');
  const inpPhoto = $('#inpPhoto');
  const photoSlot = $('#photoSlot');

  photoDrop.addEventListener('click', () => inpPhoto.click());
  inpPhoto.addEventListener('change', () => {
    const file = inpPhoto.files && inpPhoto.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      photoPreviewImg.src = reader.result;
      photoPreviewImg.hidden = false;
      photoDropEmpty.hidden = true;
      answers.photo = { type: 'image', src: reader.result };
    };
    reader.readAsDataURL(file);
  });

  $('#skipPhoto').addEventListener('click', () => {
    const nome = answers.nome || $('#inpNome').value.trim() || 'Aluno Magma';
    const initials = nome.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    answers.photo = { type: 'initials', value: initials };
    photoDropEmpty.querySelector('span').textContent = `Usando as iniciais "${initials}"`;
    photoPreviewImg.hidden = true;
    handleNext();
  });

  /* ------------------------------------------------------------
     8. avançar etapa
  ------------------------------------------------------------- */
  async function handleNext() {
    const value = validateStep(current);
    if (value === null) return;

    const stepEl = steps[current];
    const targetId = stepEl.dataset.target;
    const targetEl = $('#' + targetId);

    sheetNext.style.pointerEvents = 'none';

    if (current === 0) {
      answers.nome = value;
      await flyText($('#inpNome'), targetEl, value);
    } else if (current === 1) {
      answers.cpf = value;
      await flyText(inpCPF, targetEl, value);
    } else if (current === 2) {
      answers.nascimento = value;
      await flyText(inpBirth, targetEl, value);
    } else if (current === 3) {
      if (answers.photo && answers.photo.type === 'image') {
        targetEl.dataset.imgSrc = answers.photo.src;
        await flyPhoto(photoPreviewImg, targetEl);
      } else {
        const initials = (answers.photo && answers.photo.value) ||
          (answers.nome || 'AM').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
        targetEl.classList.add('filled', 'pop');
        targetEl.innerHTML = `<span class="initials">${initials}</span>`;
        await new Promise(r => setTimeout(r, 400));
      }
      sheetNext.style.pointerEvents = '';
      finish();
      return;
    }

    sheetNext.style.pointerEvents = '';

    if (current < TOTAL - 1) {
      goToStep(current + 1);
    } else {
      finish();
    }
  }

  sheetNext.addEventListener('click', handleNext);

  /* ------------------------------------------------------------
     9. finalização — fecha o sheet, move o cartão de verdade (já
     preenchido) para dentro do painel de sucesso, que cresce para
     acomodá-lo, e dispara confete
  ------------------------------------------------------------- */
  function finish() {
    closeSheet();
    setTimeout(() => {
      $('#successCardSlot').appendChild(cardStage);
      idCard.classList.add('sweep');
      launchConfetti();
      $('#successName').textContent = (answers.nome || '').split(' ')[0] || 'Aluno';
      $('#successPanel').classList.add('show');
    }, 420);
  }

  function launchConfetti() {
    const layer = $('#confettiLayer');
    const colors = ['#b8933f', '#dcb96a', '#c8102e', '#1d4f91', '#faf8f4'];
    const n = 46;
    for (let i = 0; i < n; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      const size = 5 + Math.random() * 6;
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.width = size + 'px';
      piece.style.height = size * (Math.random() > 0.5 ? 1 : 2.2) + 'px';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.setProperty('--rot', `${(Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360)}deg`);
      piece.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
      piece.style.animationDelay = (Math.random() * 0.4) + 's';
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), 4200);
    }
  }

  /* ------------------------------------------------------------
     10. ação final
  ------------------------------------------------------------- */
  $('#btnDownload').addEventListener('click', () => window.print());

})();
