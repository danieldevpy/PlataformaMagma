/* ============================================================
   INTEGRAÇÕES DE IA — página staff (doc 10 §5.3)
   Vanilla JS, mesmo padrão de cliente HTTP do studio.js (fetch +
   X-CSRFToken). 3 cards (Texto/Imagem/Vídeo): dropdown de provedor,
   modelo, chave (write-only), "testar conexão" e a matriz de
   capacidades que cada tipo destrava. Card de uso do mês via
   ExecucaoIA. Nada aqui é requisito pro Studio funcionar — só
   configura o que liga os botões ✨ (ver studio.js).
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, el) => (el || document).querySelector(s);
  const API_BASE = window.MAGMA_API_BASE || '/api/ia';
  const CSRF = window.MAGMA_CSRF || '';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function apiFetch(url, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    const method = (opts.method || 'GET').toUpperCase();
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers);
    if (method !== 'GET') opts.headers['X-CSRFToken'] = CSRF;
    return fetch(url, opts).then(async (res) => {
      if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try { const j = await res.clone().json(); if (j && j.detail) msg = j.detail; } catch (e) { /* ignora */ }
        throw new Error(msg);
      }
      if (res.status === 204) return null;
      const ct = res.headers.get('content-type') || '';
      return ct.includes('application/json') ? res.json() : res;
    });
  }

  /* símbolo na sidebar — mesmo SVG do Studio (design-system/AGENTS.md §2) */
  const brandMark = $('#brandMark');
  if (brandMark) {
    brandMark.innerHTML =
      `<svg viewBox="0 0 100 110"><polygon points="50,8 90,31 90,79 50,102 10,79 10,31" fill="#232c3d" stroke="#232c3d" stroke-width="12" stroke-linejoin="round"/><polygon points="50,15 84.5,35 84.5,75 50,95 15.5,75 15.5,35" fill="#fff" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><polygon points="50,19 81,37 81,73 50,91 19,73 19,37" fill="#c8102e" stroke="#c8102e" stroke-width="7" stroke-linejoin="round"/><g transform="translate(50,55)"><g fill="#fff"><rect x="-9" y="-27" width="18" height="54" rx="3.5"/><rect x="-9" y="-27" width="18" height="54" rx="3.5" transform="rotate(60)"/><rect x="-9" y="-27" width="18" height="54" rx="3.5" transform="rotate(-60)"/></g><g fill="#1d4f91"><rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4"/><rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4" transform="rotate(60)"/><rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4" transform="rotate(-60)"/></g><circle cx="0" cy="-17.5" r="3.1" fill="#fff"/><rect x="-1.7" y="-15" width="3.4" height="33" rx="1.7" fill="#fff"/><path d="M-5 -10 C 6 -7.5, 6 -3.5, 0 -1.5 C -6 0.5, -6 4.5, 0 6.5 C 5 8.2, 5 11.5, -3 13.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></g></svg>`;
  }

  // Provedores conhecidos pelo model (ProvedorIA.Provedor) — ver
  // docs/subsistemas/10-studio-2.0.md §5.5.
  const PROVEDORES_OPCOES = [
    { valor: 'anthropic', label: 'Anthropic' },
    { valor: 'openai', label: 'OpenAI' },
    { valor: 'gemini', label: 'Google Gemini' },
  ];
  const MODELO_SUGERIDO = {
    anthropic: 'claude-sonnet-5',
    openai: 'gpt-4o-mini',
    gemini: 'gemini-2.0-flash',
  };

  // 1 card por tipo — capacidades e rótulos humanos (ver CAPACIDADES_CONHECIDAS
  // em apps/ia/views.py; rótulos aqui só pra exibição, não afetam a API).
  const CARDS = [
    {
      tipo: 'texto', titulo: 'Texto',
      capacidades: [
        ['texto.gerar', 'Gerar legendas e textos'],
        ['texto.melhorar', 'Melhorar/encurtar textos'],
        ['texto.variacoes', '3 variações de texto'],
      ],
    },
    {
      tipo: 'imagem', titulo: 'Imagem',
      capacidades: [
        ['imagem.melhorar', 'Melhorar fotos'],
        ['imagem.remover_fundo', 'Remover fundo'],
        ['imagem.gerar', 'Gerar ilustrações'],
      ],
    },
    {
      tipo: 'video', titulo: 'Vídeo',
      capacidades: [
        ['video.gerar', 'Gerar vídeo/reel'],
      ],
    },
  ];

  let provedoresPorTipo = {};
  let capacidades = {};

  function provedorAtualDoTipo(tipo) {
    // Meta.ordering do model já é ["tipo","-ativo","-criado_em"] — o 1º item
    // de cada tipo na resposta de GET provedores/ é sempre "o atual"
    // (ativo, se existir; senão o mais recente).
    return (provedoresPorTipo[tipo] || [])[0] || null;
  }

  function renderCards() {
    const box = $('#cards');
    box.innerHTML = '';
    CARDS.forEach((cardDef) => box.appendChild(renderCard(cardDef)));
  }

  function renderCard(cardDef) {
    const provedor = provedorAtualDoTipo(cardDef.tipo);
    const el = document.createElement('article');
    el.className = 'card';

    const badge = badgeHtml(provedor);
    el.innerHTML = `
      <div class="card__head">
        <h2>${escapeHtml(cardDef.titulo)}</h2>
        <span class="card__badge ${badge.cls}">${badge.txt}</span>
      </div>
      <div class="card__form">
        <label class="field">
          <span>Provedor</span>
          <select class="f-provedor"></select>
        </label>
        <label class="field">
          <span>Modelo</span>
          <input class="f-modelo" type="text" placeholder="${escapeHtml(MODELO_SUGERIDO.anthropic)}">
        </label>
        <label class="field field--full">
          <span>Chave de API</span>
          <input class="f-credencial" type="password" autocomplete="new-password"
                 placeholder="${provedor && provedor.tem_credencial ? '•••• (chave já salva — deixe em branco para manter)' : 'Cole a chave aqui'}">
        </label>
        <label class="field checkfield field--full">
          <input class="f-ativo" type="checkbox" ${!provedor || provedor.ativo ? 'checked' : ''}>
          <span>Usar este provedor (ativo)</span>
        </label>
      </div>
      <div class="card__actions">
        <button type="button" class="btn btn--gold f-salvar">Salvar</button>
        <button type="button" class="btn btn--ghost f-testar" ${provedor ? '' : 'disabled'}>Testar conexão</button>
        <span class="card__status f-status"></span>
      </div>
      <div class="matriz"></div>
    `;

    const selectProvedor = el.querySelector('.f-provedor');
    PROVEDORES_OPCOES.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.valor; o.textContent = opt.label;
      selectProvedor.appendChild(o);
    });
    selectProvedor.value = (provedor && provedor.provedor) || PROVEDORES_OPCOES[0].valor;
    const inputModelo = el.querySelector('.f-modelo');
    inputModelo.value = (provedor && provedor.modelo) || '';
    selectProvedor.addEventListener('change', () => {
      if (!inputModelo.value) inputModelo.placeholder = MODELO_SUGERIDO[selectProvedor.value] || '';
    });

    const statusEl = el.querySelector('.f-status');
    if (provedor && provedor.testado_em) {
      statusEl.textContent = `Testado em ${formatDateTime(provedor.testado_em)}`;
      statusEl.classList.add('card__status--ok');
    } else if (provedor) {
      statusEl.textContent = 'Cadastrado, mas ainda não testado — a capacidade só acende depois de testar.';
    }

    el.querySelector('.f-salvar').addEventListener('click', () => salvar(cardDef, el, provedor));
    const btnTestar = el.querySelector('.f-testar');
    if (provedor) btnTestar.addEventListener('click', () => testar(cardDef, el, provedor));

    renderMatriz(el, cardDef);
    return el;
  }

  function badgeHtml(provedor) {
    if (!provedor) return { cls: 'card__badge--off', txt: '⚪ não configurado' };
    if (provedor.ativo && provedor.testado_em) return { cls: 'card__badge--ok', txt: '✅ funcionando' };
    if (provedor.ativo) return { cls: 'card__badge--off', txt: '⚪ aguardando teste' };
    return { cls: 'card__badge--off', txt: '⚪ desativado' };
  }

  function renderMatriz(el, cardDef) {
    const box = el.querySelector('.matriz');
    box.innerHTML = '';
    cardDef.capacidades.forEach(([chave, rotulo]) => {
      const acesa = !!capacidades[chave];
      const item = document.createElement('div');
      item.className = 'matriz__item' + (acesa ? '' : ' matriz__item--off');
      item.innerHTML = `<span class="matriz__dot">${acesa ? '✅' : '⚪'}</span><span>${escapeHtml(rotulo)}</span>`;
      box.appendChild(item);
    });
  }

  function salvar(cardDef, el, provedorExistente) {
    const btn = el.querySelector('.f-salvar');
    const statusEl = el.querySelector('.f-status');
    const orig = btn.textContent;
    const payload = {
      tipo: cardDef.tipo,
      provedor: el.querySelector('.f-provedor').value,
      modelo: el.querySelector('.f-modelo').value.trim() || MODELO_SUGERIDO[el.querySelector('.f-provedor').value] || '',
      ativo: el.querySelector('.f-ativo').checked,
    };
    const credencial = el.querySelector('.f-credencial').value;
    if (credencial) payload.credencial_nova = credencial;

    btn.disabled = true; btn.textContent = 'Salvando…';
    statusEl.classList.remove('card__status--erro', 'card__status--ok');
    statusEl.textContent = '';

    const requisicao = provedorExistente
      ? apiFetch(`${API_BASE}/provedores/${provedorExistente.id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
      : apiFetch(`${API_BASE}/provedores/`, { method: 'POST', body: JSON.stringify(payload) });

    requisicao
      .then(() => carregarTudo())
      .catch((err) => {
        statusEl.textContent = err.message;
        statusEl.classList.add('card__status--erro');
      })
      .finally(() => { btn.disabled = false; btn.textContent = orig; });
  }

  function testar(cardDef, el, provedor) {
    const btn = el.querySelector('.f-testar');
    const statusEl = el.querySelector('.f-status');
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Testando…';
    statusEl.classList.remove('card__status--erro', 'card__status--ok');
    statusEl.textContent = 'Testando conexão…';

    apiFetch(`${API_BASE}/provedores/${provedor.id}/testar/`, { method: 'POST' })
      .then(() => carregarTudo())
      .catch((err) => {
        statusEl.textContent = `❌ ${err.message}`;
        statusEl.classList.add('card__status--erro');
      })
      .finally(() => { btn.disabled = false; btn.textContent = orig; });
  }

  function renderUso(uso) {
    const box = $('#usoGrid');
    box.innerHTML = '';
    const stats = [
      ['Execuções', uso.execucoes],
      ['OK', uso.execucoes_ok],
      ['Com erro', uso.execucoes_erro],
      ['Tokens de entrada', uso.tokens_entrada],
      ['Tokens de saída', uso.tokens_saida],
    ];
    stats.forEach(([label, valor]) => {
      const d = document.createElement('div');
      d.className = 'uso__stat';
      d.innerHTML = `<strong>${escapeHtml(valor)}</strong><small>${escapeHtml(label)}</small>`;
      box.appendChild(d);
    });
  }

  function carregarTudo() {
    return Promise.all([
      apiFetch(`${API_BASE}/provedores/`),
      apiFetch(`${API_BASE}/capacidades/`),
      apiFetch(`${API_BASE}/uso/`),
    ]).then(([provedores, caps, uso]) => {
      provedoresPorTipo = {};
      (provedores || []).forEach((p) => {
        (provedoresPorTipo[p.tipo] = provedoresPorTipo[p.tipo] || []).push(p);
      });
      capacidades = caps || {};
      const loading = $('#cardsLoading');
      if (loading) loading.remove();
      renderCards();
      renderUso(uso || {});
    }).catch((err) => {
      const box = $('#cards');
      box.innerHTML = `<p class="loading">Não foi possível carregar as integrações: ${escapeHtml(err.message)}</p>`;
    });
  }

  carregarTudo();
})();
