(() => {
  'use strict';

  /* ------------------------------------------------------------
     0. dados vindos do link de convite (magic link — ver
     docs/plataforma/05-avaliacoes-magic-link.md), personalizando
     a saudação sem exigir cadastro.
     ex: avaliacao/?nome=Marcos&curso=Socorrista+APH+%E2%80%94+Turma+2025
  ------------------------------------------------------------- */
  const params = new URLSearchParams(location.search);
  const NOME = params.get('nome') || '';
  const CURSO = params.get('curso') || 'Socorrista APH';
  const PRIMEIRO_NOME = (NOME.split(' ')[0] || '').trim();

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // como requestAnimationFrame pode ser adiado indefinidamente (aba em
  // segundo plano, guia sem foco), garante que a troca de classe que
  // dispara a transição CSS sempre aconteça — com o timeout como reforço.
  function nextPaint(cb) {
    let done = false;
    const run = () => { if (done) return; done = true; cb(); };
    requestAnimationFrame(run);
    setTimeout(run, 50);
  }

  // computador: o convite de avaliação complementa o layout, abaixo do
  // carrossel. Celular: aparece como um "modal" flutuante com backdrop.
  const DESKTOP_QUERY = window.matchMedia('(min-width: 768px)');

  $('#subCurso').textContent = CURSO;
  if (PRIMEIRO_NOME) {
    $('#heroTitle').textContent = `Parabéns pela formatura, ${PRIMEIRO_NOME}! 🎓`;
  }

  /* ------------------------------------------------------------
     1. entrada: revela o conteúdo de fundo primeiro (fade + slide
     sutil) — o carrossel já nasce como parte normal da página.
  ------------------------------------------------------------- */
  nextPaint(() => {
    $$('.reveal').forEach(el => el.classList.add('in'));
  });

  /* ------------------------------------------------------------
     2. carrossel — sempre visível, parte do layout. Autoplay de
     ~3 fotos, depois convida a continuar sem travar a navegação
     manual (swipe/setas).
  ------------------------------------------------------------- */
  const track = $('#track');
  const slides = $$('.slide', track);
  const total = slides.length;
  const dotsWrap = $('#dots');
  const dots = $$('button', dotsWrap);
  const prevBtn = $('#prevBtn');
  const nextBtn = $('#nextBtn');
  const caption = $('#caption');
  const captions = [
    'Prática de RCP em manequim',
    'Simulação em ambulância',
    'Técnicas de imobilização',
    'Treinamento com DEA',
    'Aula prática com instrutor',
  ];

  const AUTOPLAY_INTERVAL = 2600;
  const AUTOPLAY_STEPS = 3; // ~3 fotos mostradas automaticamente
  let index = 0;
  let autoplayTimer = null;
  let autoplayTicks = 0;

  function renderSlide() {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, i) => d.setAttribute('aria-selected', String(i === index)));
    caption.textContent = captions[index] || '';
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === total - 1;
    if (index === total - 1) nextBtn.classList.remove('attn'); // não há mais para onde chamar atenção
  }

  function goTo(i) {
    index = Math.max(0, Math.min(total - 1, i));
    renderSlide();
  }

  function startAutoplay() {
    autoplayTimer = setInterval(() => {
      autoplayTicks++;
      goTo(index + 1 >= total ? total - 1 : index + 1);
      if (autoplayTicks >= AUTOPLAY_STEPS - 1 || index === total - 1) {
        stopAutoplay();
        if (index < total - 1) nextBtn.classList.add('attn'); // "tem mais fotos" — chama atenção sem bloquear
      }
    }, AUTOPLAY_INTERVAL);
  }

  function stopAutoplay() {
    if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
  }

  prevBtn.addEventListener('click', () => { stopAutoplay(); goTo(index - 1); });
  nextBtn.addEventListener('click', () => { stopAutoplay(); nextBtn.classList.remove('attn'); goTo(index + 1); });
  dots.forEach((d, i) => d.addEventListener('click', () => { stopAutoplay(); goTo(i); }));

  /* swipe no mobile */
  let touchStartX = 0, touchStartY = 0, dragging = false;
  const viewport = $('.carousel-viewport');
  viewport.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    dragging = true;
  }, { passive: true });
  viewport.addEventListener('touchmove', e => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) e.preventDefault(); // gesto horizontal: não deixa a página rolar
  }, { passive: false });
  viewport.addEventListener('touchend', e => {
    if (!dragging) return;
    dragging = false;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 40) return;
    stopAutoplay();
    goTo(dx < 0 ? index + 1 : index - 1);
  });

  startAutoplay();
  renderSlide();

  /* ------------------------------------------------------------
     3. convite para avaliação — dois estágios:
     "peek": depois de ~3s, só as estrelas aparecem (barra no rodapé
     no celular, bloco compacto abaixo do carrossel no computador) —
     discreto, sem backdrop, não atrapalha quem ainda quer ver fotos.
     "aberto": ao tocar numa estrela, revela o resto (agradecimento +
     comentário + botão) — no celular a barra vira modal de verdade;
     no computador o bloco expande e a página rola até ele.
  ------------------------------------------------------------- */
  const RATE_REVEAL_DELAY = 3000;
  setTimeout(revealAvaliacaoPeek, RATE_REVEAL_DELAY);

  const ratePanel = $('#ratePanel');
  const starsField = $('#stars');
  const rateExpand = $('#rateExpand');
  const thanksMsg = $('#thanksMsg');

  starsField.addEventListener('change', e => {
    if (e.target.name !== 'nota') return;
    const nota = Number(e.target.value);

    starsField.classList.remove('pop');
    void starsField.offsetWidth; // reinicia a animação mesmo se o aluno trocar de nota
    starsField.classList.add('pop');

    thanksMsg.textContent = nota >= 4
      ? 'Ficamos muito felizes que você tenha participado deste curso ❤️'
      : 'Sua opinião é muito importante para continuarmos melhorando.';

    rateExpand.classList.add('open');
    openFullReview();
  });

  /* ------------------------------------------------------------
     4. envio — loading no botão, depois agradecimento e
     fechamento suave (sem interromper mais nada).
  ------------------------------------------------------------- */
  const submitBtn = $('#submitBtn');
  const btnLabel = $('.btn-label', submitBtn);
  const btnSpinner = $('.btn-spinner', submitBtn);
  const successView = $('#successView');

  submitBtn.addEventListener('click', () => {
    submitBtn.disabled = true;
    btnLabel.hidden = true;
    btnSpinner.hidden = false;

    // MVP estático: simula o envio. Integração futura: POST em
    // /api/avaliacoes/convite/{token}/ (docs/plataforma/05-avaliacoes-magic-link.md).
    submitAvaliacao().then(() => {
      ratePanel.hidden = true;
      successView.hidden = false;
      successView.classList.add('in');
      setTimeout(closeAvaliacao, 2000);
    });
  });

  function submitAvaliacao() {
    return new Promise(resolve => setTimeout(resolve, 1100));
  }

  /* ------------------------------------------------------------
     5. peek / abrir / fechar o convite de avaliação.
  ------------------------------------------------------------- */
  const backdrop = $('#backdrop');
  const rateCard = $('#rateCard');
  const closeBtn = $('#closeBtn');
  let lastFocused = null;
  let opened = false;

  // estágio 1: só mostra a barra/bloco com as estrelas — sem backdrop,
  // sem travar scroll, sem role de dialog (não é modal ainda).
  function revealAvaliacaoPeek() {
    rateCard.hidden = false;
    nextPaint(() => rateCard.classList.add('show'));
  }

  // estágio 2: disparado ao tocar numa estrela. No celular a barra vira
  // modal de verdade (backdrop, scroll travado, foco preso). No
  // computador só rola a página até o bloco expandido ficar visível.
  function openFullReview() {
    if (opened) return;
    opened = true;
    const mobile = !DESKTOP_QUERY.matches;

    if (mobile) {
      lastFocused = document.activeElement;
      rateCard.classList.add('opened');
      rateCard.setAttribute('role', 'dialog');
      rateCard.setAttribute('aria-modal', 'true');
      document.body.classList.add('modal-open');
      document.addEventListener('keydown', onKeydown);
      nextPaint(() => backdrop.classList.add('show'));
      setTimeout(() => closeBtn.focus(), 500);
    } else {
      // espera a expansão (grid-template-rows) começar antes de calcular
      // a posição final, senão o scroll para antes do card crescer todo.
      setTimeout(() => {
        rateCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }

  function closeAvaliacao() {
    backdrop.classList.remove('show');
    rateCard.classList.remove('show', 'opened');
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKeydown);
    setTimeout(() => { rateCard.hidden = true; }, 650);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { closeAvaliacao(); return; }
    if (e.key !== 'Tab') return;
    const focusable = $$('button:not([disabled]), [href], input, textarea, select', rateCard)
      .filter(el => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  closeBtn.addEventListener('click', closeAvaliacao);
})();
