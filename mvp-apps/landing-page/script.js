(function(){
  var WHATS = '5521964946079';

  // Origem da visita (para o funil): utm_source ou referrer, anexado à mensagem
  function origem(){
    var p = new URLSearchParams(location.search);
    var src = p.get('utm_source') || '';
    var camp = p.get('utm_campaign') || '';
    if (src || camp) return ' [origem: ' + [src, camp].filter(Boolean).join('/') + ']';
    return ' [origem: site]';
  }

  function waUrl(msg){
    return 'https://wa.me/' + WHATS + '?text=' + encodeURIComponent(msg + origem());
  }

  // Aplica em todos os CTAs de WhatsApp
  document.querySelectorAll('[data-wa]').forEach(function(a){
    a.setAttribute('href', waUrl(a.getAttribute('data-msg') || 'Olá! Vim pelo site da Magma.'));
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });

  // Formulário de lead → abre WhatsApp com mensagem estruturada.
  // FUTURO: enviar também para um webhook (n8n) antes do redirect, registrando o lead no CRM.
  var leadForm = document.getElementById('leadForm');
  if (leadForm) leadForm.addEventListener('submit', function(e){
    e.preventDefault();
    var nome = document.getElementById('nome').value.trim();
    var curso = document.getElementById('curso').value;
    var quando = document.getElementById('quando').value;
    var msg = 'Olá! Me chamo ' + nome + ' e quero receber o calendário e valores do curso: ' + curso + '. Pretendo começar: ' + quando + '.';
    window.open(waUrl(msg), '_blank');
  });
})();
