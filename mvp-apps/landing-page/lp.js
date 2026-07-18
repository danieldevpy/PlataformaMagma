/* ============================================================
   MAGMA CURSOS — LP de vendas: interações e animações
   Reutilizado por todas as páginas de curso.
   BACKEND FUTURO: os pontos de integração estão marcados com
   "INTEGRAÇÃO:" — hoje tudo resolve para WhatsApp.
   ============================================================ */
(function () {
  var WHATS = '5521964946079';

  /* ---------- WhatsApp com origem (UTM) ---------- */
  function origem() {
    var p = new URLSearchParams(location.search);
    var src = p.get('utm_source') || '';
    var camp = p.get('utm_campaign') || '';
    if (src || camp) return ' [origem: ' + [src, camp].filter(Boolean).join('/') + ']';
    return ' [origem: site]';
  }
  function waUrl(msg) {
    return 'https://wa.me/' + WHATS + '?text=' + encodeURIComponent(msg + origem());
  }
  document.querySelectorAll('[data-wa]').forEach(function (a) {
    a.setAttribute('href', waUrl(a.getAttribute('data-msg') || 'Olá! Vim pelo site da Magma.'));
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });

  /* ---------- formulário de lead ----------
     INTEGRAÇÃO: antes do redirect, enviar payload para webhook
     (n8n/CRM): fetch('SEU_WEBHOOK', {method:'POST', body: JSON.stringify(dados)}) */
  var leadForm = document.getElementById('leadForm');
  if (leadForm) leadForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var nome = document.getElementById('nome').value.trim();
    var quando = document.getElementById('quando').value;
    var curso = leadForm.getAttribute('data-curso') || 'curso da Magma';
    var msg = 'Olá! Me chamo ' + nome + ' e quero garantir minha vaga no curso: ' + curso + '. Pretendo começar: ' + quando + '.';
    window.open(waUrl(msg), '_blank');
  });

  /* ---------- reveal on scroll ---------- */
  /* ?noanim na URL desliga as animações (testes visuais / screenshots) */
  if (new URLSearchParams(location.search).has('noanim')) {
    var st = document.createElement('style');
    st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}.reveal{opacity:1!important;transform:none!important}';
    document.head.appendChild(st);
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    document.querySelectorAll('[data-count]').forEach(function (el) {
      el.textContent = el.getAttribute('data-count') + (el.getAttribute('data-suffix') || '');
    });
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.14 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  /* ---------- contadores animados ----------
     uso: <b data-count="500" data-suffix="+">0</b> */
  var ioNum = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      ioNum.unobserve(en.target);
      var el = en.target;
      var alvo = parseFloat(el.getAttribute('data-count'));
      var suf = el.getAttribute('data-suffix') || '';
      var dec = (String(el.getAttribute('data-count')).split('.')[1] || '').length;
      var t0 = null;
      function step(t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / 1400, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (alvo * eased).toFixed(dec) + suf;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach(function (el) { ioNum.observe(el); });

  /* ---------- countdown ----------
     uso: <div class="count" data-deadline="2026-08-01T23:59:59-03:00">
     INTEGRAÇÃO: o backend injeta a data da próxima turma no atributo. */
  document.querySelectorAll('[data-deadline]').forEach(function (box) {
    var dias = box.querySelector('[data-t="d"]'), hrs = box.querySelector('[data-t="h"]'),
        min = box.querySelector('[data-t="m"]'), seg = box.querySelector('[data-t="s"]');
    var fim = new Date(box.getAttribute('data-deadline')).getTime();
    function tick() {
      var dif = Math.max(0, fim - Date.now());
      var d = Math.floor(dif / 864e5), h = Math.floor(dif % 864e5 / 36e5),
          m = Math.floor(dif % 36e5 / 6e4), s = Math.floor(dif % 6e4 / 1e3);
      if (dias) dias.textContent = String(d).padStart(2, '0');
      if (hrs) hrs.textContent = String(h).padStart(2, '0');
      if (min) min.textContent = String(m).padStart(2, '0');
      if (seg) seg.textContent = String(s).padStart(2, '0');
    }
    tick(); setInterval(tick, 1000);
  });

  /* ---------- barra fixa de CTA (mobile) ---------- */
  var sticky = document.querySelector('.sticky-cta');
  var hero = document.querySelector('.hero');
  if (sticky && hero) {
    var ioSticky = new IntersectionObserver(function (entries) {
      sticky.classList.toggle('show', !entries[0].isIntersecting);
    }, { threshold: 0 });
    ioSticky.observe(hero);
  }
})();
