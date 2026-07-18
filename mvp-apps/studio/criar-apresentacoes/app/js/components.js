/* ============================================================
   COMPONENTS.JS — registro dos 10 componentes Magma.
   Cada componente define:
     label   : nome exibido
     dark    : fundo escuro (afeta preview)
     fields  : schema do editor (usado por studio.js)
     make()  : dados iniciais de um slide novo
     render(d, n) : HTML do preview (espelha montar_powerpoint.py)
   Schema de deck (studio <-> deck.json) idêntico ao do Python.
   ============================================================ */
(function (global) {
  "use strict";

  // ---------------- helpers ----------------
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  // markdown inline: **negrito** -> <b>
  const md = (s) =>
    esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

  const deckDate = () => (global.STUDIO_META && global.STUDIO_META.date) || "17/07/2026";

  const IMG_BASE = "../../textos e imagens/";
  const imgSrc = (name) =>
    /^(https?:|data:|blob:|\.|\/)/.test(name) ? name : IMG_BASE + name;

  const imgTag = (name) =>
    name
      ? `<img src="${esc(imgSrc(name))}" alt="" onerror="window.__imgFallback&&window.__imgFallback(this)">`
      : `<div class="ph">Imagem</div>`;

  const pad2 = (n) => String(n).padStart(2, "0");

  // logo lockup (símbolo + wordmark)
  function symbolSVG(size) {
    const bar = 'width="60" height="15" rx="7.5"';
    return (
      `<svg width="${size}" height="${size}" viewBox="0 0 100 100">` +
      `<polygon points="50,2 91.6,26 91.6,74 50,98 8.4,74 8.4,26" fill="#C8102E" stroke="#232C3D" stroke-width="3"/>` +
      `<g fill="#fff">` +
      `<rect x="20" y="42.5" ${bar}/>` +
      `<rect x="20" y="42.5" ${bar} transform="rotate(60 50 50)"/>` +
      `<rect x="20" y="42.5" ${bar} transform="rotate(120 50 50)"/>` +
      `</g></svg>`
    );
  }
  function logoLockup(size, onDark) {
    return (
      `<div class="s-logo ${onDark ? "" : "on-light"}">` +
      symbolSVG(size) +
      `<div class="wm" style="font-size:${Math.round(size * 0.42)}px">` +
      `<b>MAGMA</b><span style="font-size:${Math.round(size * 0.2)}px">CURSOS</span></div>` +
      `</div>`
    );
  }

  // ---------------- fragmentos compartilhados ----------------
  function headerHTML(d) {
    return (
      `<div class="s-header">` +
      `<span class="s-rule"></span>` +
      (d.eyebrow ? `<span class="s-eyebrow">${esc(d.eyebrow)}</span>` : "") +
      `<h2 class="s-title">${esc(d.title || "")}</h2>` +
      `</div>`
    );
  }
  function footerHTML(n) {
    return (
      `<div class="s-footer"><span>MAGMA Cursos</span>` +
      `<span class="mid">${esc(deckDate())}</span>` +
      `<span class="end">Slide ${pad2(n)}</span></div>`
    );
  }
  function numberHTML(n) {
    return `<div class="s-footer"><span></span><span class="mid"></span><span class="end">Slide ${pad2(n)}</span></div>`;
  }
  function calloutHTML(c, cls) {
    if (!c || !c.desc) return "";
    return (
      `<div class="s-callout ${esc(c.kind || "info")} ${cls || ""}">` +
      (c.title ? `<span class="ct">${esc(c.title)}</span>` : "") +
      `<span class="cd">${md(c.desc)}</span></div>`
    );
  }
  function blocksHTML(blocks) {
    const rows = (blocks || [])
      .map((b) => {
        switch (b.type) {
          case "intro": return `<div class="b-intro">${esc(b.text)}</div>`;
          case "h": return `<div class="b-h">${esc(b.text)}</div>`;
          case "p": return `<div class="b-p">${md(b.text)}</div>`;
          case "bullet": return `<div class="b-bullet">${esc(b.text)}</div>`;
          case "warn": return `<div class="b-warn">${esc(b.text)}</div>`;
          case "hint": return `<div class="b-hint">${esc(b.text)}</div>`;
          case "step":
            return (
              `<div class="b-step"><div class="lead">` +
              (b.badge ? `<span class="badge">${esc(b.badge)}</span>` : "") +
              `<span class="txt">${esc(b.lead)}</span></div>` +
              `<div class="desc">${esc(b.text)}</div></div>`
            );
          default: return "";
        }
      })
      .join("");
    return `<div class="s-flow">${rows}</div>`;
  }

  // opções reutilizadas nos formulários
  const CALLOUT_KINDS = [
    { v: "alert", label: "Alerta (vermelho)" },
    { v: "info", label: "Info (azul)" },
    { v: "success", label: "Sucesso (verde)" },
    { v: "tip", label: "Dica (dourado)" },
  ];
  const BLOCK_TYPES = [
    { v: "h", label: "Subtítulo" },
    { v: "p", label: "Parágrafo" },
    { v: "bullet", label: "Bullet" },
    { v: "intro", label: "Intro (cinza)" },
    { v: "step", label: "Passo (badge+lead+texto)" },
    { v: "warn", label: "Aviso (!)" },
    { v: "hint", label: "Dica (»)" },
  ];

  // campos comuns
  const F_EYEBROW = { k: "eyebrow", label: "Eyebrow", type: "text", placeholder: "SEÇÃO" };
  const F_TITLE = { k: "title", label: "Título", type: "text" };
  const F_CALLOUT = { k: "callout", label: "Callout (opcional)", type: "callout" };

  // ---------------- registro ----------------
  const COMPONENTS = {
    cover: {
      label: "Capa",
      dark: true,
      fields: [
        F_EYEBROW, F_TITLE,
        { k: "subtitle", label: "Subtítulo", type: "textarea" },
        { k: "image", label: "Imagem (direita)", type: "image" },
      ],
      make: () => ({
        component: "cover", eyebrow: "TREINAMENTO", title: "Título da Capa",
        subtitle: "Subtítulo descritivo do curso.", image: "",
      }),
      render(d) {
        return (
          `<div class="cov-left"></div>` +
          `<div class="cov-right">${d.image ? imgTag(d.image) : `<div class="ph">Foto de aula prática</div>`}</div>` +
          `<span class="s-rule cov-rule"></span>` +
          `<div class="cov-logo">${logoLockup(60, true)}</div>` +
          (d.eyebrow ? `<div class="cov-eyebrow">${esc(d.eyebrow)}</div>` : "") +
          `<div class="cov-title">${esc(d.title)}</div>` +
          (d.subtitle ? `<div class="cov-sub">${esc(d.subtitle)}</div>` : "")
        );
      },
    },

    content_card: {
      label: "Card de conteúdo",
      dark: false,
      fields: [
        F_EYEBROW, F_TITLE,
        { k: "body", label: "Corpo (parágrafos)", type: "list", multiline: true, md: true,
          help: "Um parágrafo por item. Use **negrito**." },
        { k: "stats", label: "Destaques / stats", type: "list" },
        { k: "footnote", label: "Rodapé (nota)", type: "textarea" },
        F_CALLOUT,
      ],
      make: () => ({
        component: "content_card", eyebrow: "SEÇÃO", title: "Título do card",
        body: ["Texto do parágrafo com **destaque**."], stats: [], footnote: "",
      }),
      render(d, n) {
        const hasCo = d.callout && d.callout.desc;
        const body =
          (d.body || []).map((p) => `<p>${md(p)}</p>`).join("") +
          (d.stats || []).map((s) => `<div class="stat">${esc(s)}</div>`).join("") +
          (d.footnote ? `<div class="foot">${esc(d.footnote)}</div>` : "");
        return (
          `<span class="s-rule" style="position:absolute;left:90px;top:150px"></span>` +
          (d.eyebrow ? `<span class="s-eyebrow" style="position:absolute;left:90px;top:182px">${esc(d.eyebrow)}</span>` : "") +
          `<div class="icon-tile">${symbolSVG(60)}</div>` +
          `<div class="cc-title">${esc(d.title)}</div>` +
          `<div class="cc-body" style="${hasCo ? "bottom:280px" : ""}">${body}</div>` +
          (hasCo ? `<div class="cc-callout">${calloutHTML(d.callout)}</div>` : "") +
          footerHTML(n)
        );
      },
    },

    step_card: {
      label: "Passos (numerados)",
      dark: false,
      fields: [
        F_EYEBROW, F_TITLE,
        { k: "intro", label: "Intro", type: "textarea" },
        { k: "steps", label: "Passos", type: "objlist", addLabel: "Adicionar passo",
          fields: [
            { k: "badge", label: "Badge", type: "text", w: "s" },
            { k: "lead", label: "Lead", type: "text" },
            { k: "text", label: "Texto", type: "textarea" },
          ] },
        { k: "image", label: "Imagem (opcional)", type: "image" },
        { k: "note", label: "Aviso (!)", type: "textarea" },
        { k: "hint", label: "Dica (»)", type: "textarea" },
        F_CALLOUT,
      ],
      make: () => ({
        component: "step_card", eyebrow: "SEÇÃO", title: "Título dos passos", intro: "",
        steps: [{ badge: "1", lead: "Primeiro passo", text: "Descrição do passo." }],
        image: "", note: "", hint: "",
      }),
      render(d, n) {
        const hasCo = d.callout && d.callout.desc;
        const blocks = [];
        if (d.intro) blocks.push({ type: "intro", text: d.intro });
        (d.steps || []).forEach((s) => blocks.push({ type: "step", badge: s.badge, lead: s.lead, text: s.text }));
        if (d.note) blocks.push({ type: "warn", text: d.note });
        if (d.hint) blocks.push({ type: "hint", text: d.hint });
        const img = d.image
          ? `<div class="col-img"><div class="imgbox">${imgTag(d.image)}</div></div>` : "";
        return (
          headerHTML(d) +
          `<div class="s-content" style="${hasCo ? "bottom:250px" : ""}">` +
          `<div class="col-text">${blocksHTML(blocks)}</div>${img}</div>` +
          (hasCo ? calloutHTML(d.callout, "slide-callout-bottom") : "") +
          footerHTML(n)
        );
      },
    },

    split: {
      label: "Texto + imagem",
      dark: false,
      fields: [
        F_EYEBROW, F_TITLE,
        { k: "blocks", label: "Blocos", type: "blocks" },
        { k: "image", label: "Imagem", type: "image" },
        F_CALLOUT,
      ],
      make: () => ({
        component: "split", eyebrow: "SEÇÃO", title: "Título",
        blocks: [{ type: "h", text: "Subtítulo" }, { type: "bullet", text: "Ponto importante" }],
        image: "",
      }),
      render(d, n) {
        const hasCo = d.callout && d.callout.desc;
        return (
          headerHTML(d) +
          `<div class="s-content" style="${hasCo ? "bottom:250px" : ""}">` +
          `<div class="col-text">${blocksHTML(d.blocks)}</div>` +
          `<div class="col-img"><div class="imgbox">${imgTag(d.image)}</div></div></div>` +
          (hasCo ? calloutHTML(d.callout, "slide-callout-bottom") : "") +
          footerHTML(n)
        );
      },
    },

    two_col: {
      label: "Duas colunas",
      dark: false,
      fields: [
        F_EYEBROW, F_TITLE,
        { k: "left", label: "Coluna esquerda", type: "blocks" },
        { k: "right", label: "Coluna direita", type: "blocks" },
        F_CALLOUT,
      ],
      make: () => ({
        component: "two_col", eyebrow: "SEÇÃO", title: "Título",
        left: [{ type: "h", text: "Coluna A" }, { type: "p", text: "Texto." }],
        right: [{ type: "h", text: "Coluna B" }, { type: "bullet", text: "Item" }],
      }),
      render(d, n) {
        const hasCo = d.callout && d.callout.desc;
        return (
          headerHTML(d) +
          `<div class="s-content" style="${hasCo ? "bottom:250px" : ""}">` +
          `<div class="col">${blocksHTML(d.left)}</div>` +
          `<div class="col">${blocksHTML(d.right)}</div></div>` +
          (hasCo ? calloutHTML(d.callout, "slide-callout-bottom") : "") +
          footerHTML(n)
        );
      },
    },

    grid: {
      label: "Grade de cards",
      dark: false,
      fields: [
        F_EYEBROW, F_TITLE,
        { k: "cols", label: "Colunas", type: "select", options: [
          { v: 2, label: "2 colunas" }, { v: 3, label: "3 colunas" }] },
        { k: "quote", label: "Citação (opcional)", type: "textarea" },
        { k: "intro", label: "Intro (opcional)", type: "textarea" },
        { k: "cards", label: "Cards", type: "objlist", addLabel: "Adicionar card",
          fields: [
            { k: "label", label: "Título", type: "text" },
            { k: "desc", label: "Descrição", type: "textarea" },
          ] },
        { k: "badges", label: "Badges (1 por card, opcional)", type: "list" },
        F_CALLOUT,
      ],
      make: () => ({
        component: "grid", eyebrow: "SEÇÃO", title: "Título", cols: 2,
        cards: [
          { label: "Card 1", desc: "Descrição do card." },
          { label: "Card 2", desc: "Descrição do card." },
        ],
        badges: [], intro: "", quote: "",
      }),
      render(d, n) {
        const cols = Number(d.cols) || 2;
        const badges = d.badges || [];
        const cards = (d.cards || [])
          .map((c, i) => {
            const b = badges[i];
            return (
              `<div class="g-card ${b ? "badged" : ""}"><div class="g-head">` +
              (b ? `<span class="g-badge">${esc(b)}</span>` : "") +
              `<span class="g-label">${esc(c.label)}</span></div>` +
              `<div class="g-desc">${esc(c.desc)}</div></div>`
            );
          })
          .join("");
        const co = d.callout && d.callout.desc;
        return (
          headerHTML(d) +
          `<div class="s-content">` +
          (d.quote ? `<div class="quote">“${esc(d.quote)}”</div>` : "") +
          (d.intro ? `<div class="g-intro">${esc(d.intro)}</div>` : "") +
          `<div class="cards" style="grid-template-columns:repeat(${cols},1fr)">${cards}</div>` +
          (co ? `<div class="g-callout">${calloutHTML(d.callout)}</div>` : "") +
          `</div>` +
          footerHTML(n)
        );
      },
    },

    grid3: {
      label: "3 colunas com imagem",
      dark: false,
      fields: [
        F_EYEBROW, F_TITLE,
        { k: "columns", label: "Colunas", type: "objlist", addLabel: "Adicionar coluna",
          fields: [
            { k: "head", label: "Cabeçalho", type: "text" },
            { k: "img", label: "Imagem", type: "image" },
            { k: "bullets", label: "Bullets", type: "list" },
          ] },
      ],
      make: () => ({
        component: "grid3", eyebrow: "SEÇÃO", title: "Título",
        columns: [
          { head: "Coluna A", img: "", bullets: ["Item 1", "Item 2"] },
          { head: "Coluna B", img: "", bullets: ["Item 1", "Item 2"] },
          { head: "Coluna C", img: "", bullets: ["Item 1", "Item 2"] },
        ],
      }),
      render(d, n) {
        const cols = (d.columns || [])
          .map(
            (c) =>
              `<div class="g3-col"><div class="g3-img">${imgTag(c.img)}</div>` +
              `<div class="g3-head">${esc(c.head)}</div>` +
              (c.bullets || []).map((b) => `<div class="g3-bullet">${esc(b)}</div>`).join("") +
              `</div>`
          )
          .join("");
        return headerHTML(d) + `<div class="s-content">${cols}</div>` + footerHTML(n);
      },
    },

    do_dont: {
      label: "Faça / Não faça",
      dark: false,
      fields: [
        F_EYEBROW, F_TITLE,
        { k: "do", label: "FAÇA", type: "list" },
        { k: "dont", label: "NÃO FAÇA", type: "list" },
        F_CALLOUT,
      ],
      make: () => ({
        component: "do_dont", eyebrow: "SEÇÃO", title: "Título",
        do: ["Ação recomendada"], dont: ["Ação a evitar"],
      }),
      render(d, n) {
        const list = (arr) => (arr || []).map((i) => `<div class="dd-item">${esc(i)}</div>`).join("");
        const co = d.callout && d.callout.desc;
        return (
          headerHTML(d) +
          `<div class="s-content" style="${co ? "bottom:250px" : ""}">` +
          `<div class="dd-col do"><div class="dd-head">FAÇA</div><div class="dd-items">${list(d.do)}</div></div>` +
          `<div class="dd-col dont"><div class="dd-head">NÃO FAÇA</div><div class="dd-items">${list(d.dont)}</div></div>` +
          `</div>` +
          (co ? calloutHTML(d.callout, "slide-callout-bottom") : "") +
          footerHTML(n)
        );
      },
    },

    flow: {
      label: "Fluxograma (chevrons)",
      dark: true,
      fields: [
        F_EYEBROW, F_TITLE,
        { k: "stages", label: "Etapas", type: "list", multiline: true,
          help: "Use Enter para quebra de linha dentro da etapa." },
        { k: "caption", label: "Legenda", type: "textarea" },
      ],
      make: () => ({
        component: "flow", eyebrow: "FLUXO", title: "Título do fluxo",
        stages: ["Etapa 1", "Etapa 2", "Etapa 3"], caption: "Descrição do fluxograma.",
      }),
      render(d, n) {
        const st = d.stages || [];
        const chev = st
          .map((s, i) => {
            const last = i === st.length - 1;
            const cls = last ? "last" : i % 2 === 0 ? "a" : "b";
            return `<div class="chev ${cls}">${esc(s).replace(/\n/g, "<br>")}</div>`;
          })
          .join("");
        return (
          headerHTML(d) +
          `<div class="fl-stages">${chev}</div>` +
          `<div class="fl-caption">${esc(d.caption)}</div>` +
          footerHTML(n)
        );
      },
    },

    hero: {
      label: "Hero / Encerramento",
      dark: true,
      fields: [
        F_EYEBROW, F_TITLE,
        { k: "big", label: "Tamanho do título (pt)", type: "number", min: 30, max: 110 },
        { k: "subtitle", label: "Subtítulo", type: "textarea" },
        { k: "contact", label: "Contatos", type: "objlist", addLabel: "Adicionar contato",
          fields: [
            { k: "lead", label: "Rótulo", type: "text" },
            { k: "desc", label: "Texto", type: "text" },
          ] },
        { k: "tagline", label: "Tagline", type: "text" },
      ],
      make: () => ({
        component: "hero", eyebrow: "", title: "Título hero", big: 60,
        subtitle: "", contact: [], tagline: "",
      }),
      render(d, n) {
        const big = Number(d.big) || 60;
        let yy = 770;
        let stack = "";
        if (d.subtitle) { stack += `<div class="h-sub" style="top:${yy}px">${esc(d.subtitle)}</div>`; yy += 130; }
        (d.contact || []).forEach((c) => {
          stack += `<div class="h-contact" style="top:${yy}px"><span class="lead">${esc(c.lead)}</span>${esc(c.desc)}</div>`;
          yy += 46;
        });
        if ((d.contact || []).length) yy += 10;
        if (d.tagline) stack += `<div class="h-tagline" style="top:${yy}px">${esc(d.tagline)}</div>`;
        return (
          `<div class="hero-top"></div>` +
          `<span class="s-rule h-rule"></span>` +
          (d.eyebrow ? `<div class="h-eyebrow">${esc(d.eyebrow)}</div>` : "") +
          `<div class="h-title" style="font-size:${big * 2}px">${esc(d.title)}</div>` +
          stack +
          `<div class="h-logo">${logoLockup(54, true)}</div>` +
          numberHTML(n)
        );
      },
    },
  };

  // ordem de exibição no menu "adicionar slide"
  const ORDER = ["cover", "content_card", "step_card", "split", "two_col",
    "grid", "grid3", "do_dont", "flow", "hero"];

  global.MAGMA = { COMPONENTS, ORDER, esc, md, CALLOUT_KINDS, BLOCK_TYPES };
})(window);
