/* ============================================================
   STUDIO.JS — estado, editor e export do Studio Magma.
   Deck: { meta:{project,brand,date,output_file}, slides:[...] }
   O deck.json exportado é lido por montar_powerpoint.py.
   ============================================================ */
(function () {
  "use strict";
  const { COMPONENTS, ORDER, CALLOUT_KINDS, BLOCK_TYPES } = window.MAGMA;
  const LS_KEY = "magma-studio-deck-v1";

  // ---------------- DOM helpers (definidos antes do estado) ----------------
  const $ = (s, r = document) => r.querySelector(s);
  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  const uid = () => "s" + Math.random().toString(36).slice(2, 9);

  // ---------------- estado ----------------
  let deck = load() || starter();
  let cur = deck.slides.length ? 0 : -1;
  window.STUDIO_META = deck.meta;

  window.__imgFallback = function (imgEl) {
    const ph = document.createElement("div");
    ph.className = "ph";
    ph.textContent = "Imagem";
    imgEl.replaceWith(ph);
  };

  // ---------------- persistência ----------------
  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(deck)); } catch (e) {}
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { return null; }
  }
  function starter() {
    const c = COMPONENTS.cover.make();
    c.id = uid();
    return {
      meta: { project: "Novo deck", brand: "MAGMA Cursos", date: "17/07/2026",
        output_file: "meu_deck.pptx" },
      slides: [c],
    };
  }

  // ---------------- render: palco ----------------
  const stageWrap = $("#stage");
  function renderStage() {
    stageWrap.innerHTML = "";
    if (cur < 0 || !deck.slides[cur]) {
      const em = el("div", "empty");
      em.innerHTML = "<b>Nenhum slide</b>Clique em <b>+ Slide</b> para começar.";
      stageWrap.appendChild(em);
      return;
    }
    const slide = deck.slides[cur];
    const comp = COMPONENTS[slide.component];
    const canvas = el("div", "canvas");
    const scaler = el("div", "stage-scaler");
    const s = el("div", "slide c-" + slide.component + (comp.dark ? " dark" : ""));
    s.innerHTML = comp.render(slide, cur + 1);
    scaler.appendChild(s);
    canvas.appendChild(scaler);
    stageWrap.appendChild(canvas);
    fitStage(canvas, scaler);
  }
  function fitStage(canvas, scaler) {
    const pad = 56;
    const availW = stageWrap.clientWidth - pad;
    const availH = stageWrap.clientHeight - pad;
    const scale = Math.min(availW / 1920, availH / 1080);
    scaler.style.transform = "scale(" + scale + ")";
    canvas.style.width = 1920 * scale + "px";
    canvas.style.height = 1080 * scale + "px";
  }

  // ---------------- render: rail ----------------
  const listEl = $("#list");
  function renderRail() {
    listEl.innerHTML = "";
    deck.slides.forEach((slide, i) => {
      const comp = COMPONENTS[slide.component];
      const thumb = el("div", "thumb" + (i === cur ? " sel" : ""));
      const frame = el("div", "frame");
      const scaler = el("div", "stage-scaler");
      const s = el("div", "slide c-" + slide.component + (comp.dark ? " dark" : ""));
      s.innerHTML = comp.render(slide, i + 1);
      scaler.appendChild(s);
      frame.appendChild(scaler);
      thumb.appendChild(frame);

      const cap = el("div", "cap");
      cap.innerHTML =
        `<span class="num">${String(i + 1).padStart(2, "0")}</span>` +
        `<span class="nm">${comp.label}</span>`;
      thumb.appendChild(cap);

      const tools = el("div", "tools");
      tools.innerHTML =
        `<button data-a="up" title="Subir">↑</button>` +
        `<button data-a="down" title="Descer">↓</button>` +
        `<button data-a="dup" title="Duplicar">⧉</button>` +
        `<button class="del" data-a="del" title="Excluir">✕</button>`;
      tools.addEventListener("click", (ev) => {
        const a = ev.target.getAttribute("data-a");
        if (!a) return;
        ev.stopPropagation();
        slideAction(a, i);
      });
      thumb.appendChild(tools);

      thumb.addEventListener("click", () => select(i));
      listEl.appendChild(thumb);

      // escala do thumb após inserir (largura real disponível)
      requestAnimationFrame(() => {
        const w = frame.clientWidth;
        scaler.style.transform = "scale(" + w / 1920 + ")";
      });
    });
  }

  // ---------------- ações de slide ----------------
  function slideAction(a, i) {
    if (a === "up" && i > 0) { swap(i, i - 1); cur = i - 1; }
    else if (a === "down" && i < deck.slides.length - 1) { swap(i, i + 1); cur = i + 1; }
    else if (a === "dup") {
      const copy = JSON.parse(JSON.stringify(deck.slides[i]));
      copy.id = uid();
      deck.slides.splice(i + 1, 0, copy);
      cur = i + 1;
    } else if (a === "del") {
      if (!confirm("Excluir este slide?")) return;
      deck.slides.splice(i, 1);
      if (cur >= deck.slides.length) cur = deck.slides.length - 1;
    } else return;
    renderAll();
  }
  function swap(a, b) { const t = deck.slides[a]; deck.slides[a] = deck.slides[b]; deck.slides[b] = t; }
  function select(i) { cur = i; renderRail(); renderStage(); renderInspector(); }

  function addSlide(type) {
    const d = COMPONENTS[type].make();
    d.id = uid();
    const at = cur < 0 ? deck.slides.length : cur + 1;
    deck.slides.splice(at, 0, d);
    cur = at;
    renderAll();
  }

  // ---------------- render tudo ----------------
  function renderAll() { persist(); renderRail(); renderStage(); renderInspector(); }
  function soft() { persist(); renderStage(); renderRail(); }   // sem reconstruir form

  // ================= INSPETOR / form builder =================
  const inspEl = $("#inspector");
  function renderInspector() {
    inspEl.innerHTML = "";
    if (cur < 0) { inspEl.appendChild(el("div", "hint-bar", "Selecione ou adicione um slide.")); return; }
    const slide = deck.slides[cur];
    const comp = COMPONENTS[slide.component];

    const head = el("div", "insp-head");
    head.innerHTML = `<span class="chip">${slide.component}</span><span class="t">${comp.label}</span>`;
    inspEl.appendChild(head);

    const form = el("div", "form");
    comp.fields.forEach((f) => form.appendChild(buildField(slide, f)));
    inspEl.appendChild(form);
  }

  // constrói um campo (data = objeto dono, f = spec)
  function buildField(data, f) {
    switch (f.type) {
      case "text":
      case "number":
      case "image":
        return fInput(data, f);
      case "textarea":
        return fTextarea(data, f);
      case "select":
        return fSelect(data, f);
      case "list":
        return fList(data, f);
      case "objlist":
        return fObjList(data, f);
      case "blocks":
        return fBlocks(data, f);
      case "callout":
        return fCallout(data, f);
      default:
        return el("div");
    }
  }

  function labelEl(f) { return el("label", null, f.label); }
  function helpEl(f) { return f.help ? el("div", "help", f.help) : null; }

  function fInput(data, f) {
    const w = el("div", "fld");
    w.appendChild(labelEl(f));
    const inp = el("input");
    inp.type = f.type === "number" ? "number" : "text";
    if (f.type === "number") { if (f.min != null) inp.min = f.min; if (f.max != null) inp.max = f.max; }
    if (f.type === "image") inp.placeholder = "arquivo.png ou URL";
    if (f.placeholder) inp.placeholder = f.placeholder;
    inp.value = data[f.k] != null ? data[f.k] : "";
    inp.addEventListener("input", () => {
      data[f.k] = f.type === "number" ? Number(inp.value) : inp.value;
      soft();
    });
    w.appendChild(inp);
    if (f.type === "image") w.appendChild(el("div", "help", "Busca em ../textos e imagens/. Aceita também URL http(s)."));
    const h = helpEl(f); if (h) w.appendChild(h);
    return w;
  }

  function fTextarea(data, f) {
    const w = el("div", "fld");
    w.appendChild(labelEl(f));
    const t = el("textarea");
    t.value = data[f.k] || "";
    t.addEventListener("input", () => { data[f.k] = t.value; soft(); });
    w.appendChild(t);
    const h = helpEl(f); if (h) w.appendChild(h);
    return w;
  }

  function fSelect(data, f) {
    const w = el("div", "fld");
    w.appendChild(labelEl(f));
    const sel = el("select");
    f.options.forEach((o) => {
      const op = el("option", null, o.label);
      op.value = o.v;
      if (String(data[f.k]) === String(o.v)) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener("change", () => {
      const raw = sel.value;
      data[f.k] = /^\d+$/.test(raw) ? Number(raw) : raw;
      soft();
    });
    w.appendChild(sel);
    return w;
  }

  // lista de strings
  function fList(data, f) {
    const arr = data[f.k] || (data[f.k] = []);
    const w = el("div", "fld");
    w.appendChild(labelEl(f));
    arr.forEach((v, i) => {
      const row = el("div", "row-item");
      const ctl = f.multiline ? el("textarea") : el("input");
      if (!f.multiline) ctl.type = "text";
      ctl.className = "grow";
      ctl.value = v;
      ctl.addEventListener("input", () => { arr[i] = ctl.value; soft(); });
      row.appendChild(ctl);
      row.appendChild(mini("↑", "iconbtn", () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; reFld(); } }));
      row.appendChild(mini("↓", "iconbtn", () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; reFld(); } }));
      row.appendChild(mini("✕", "iconbtn del", () => { arr.splice(i, 1); reFld(); }));
      w.appendChild(row);
    });
    w.appendChild(mini((f.addLabel || "+ Adicionar item"), "addrow", () => { arr.push(""); reFld(); }));
    const h = helpEl(f); if (h) w.appendChild(h);
    function reFld() { const nw = fList(data, f); w.replaceWith(nw); soft(); }
    return w;
  }

  // lista de objetos (subfields podem incluir list / image)
  function fObjList(data, f) {
    const arr = data[f.k] || (data[f.k] = []);
    const w = el("div", "fld");
    w.appendChild(labelEl(f));
    arr.forEach((item, i) => {
      const box = el("div", "sub");
      const bar = el("div", "sub-bar");
      bar.appendChild(el("span", "lbl", "#" + (i + 1)));
      bar.appendChild(mini("↑", "iconbtn", () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; reFld(); } }));
      bar.appendChild(mini("↓", "iconbtn", () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; reFld(); } }));
      bar.appendChild(mini("✕", "iconbtn del", () => { arr.splice(i, 1); reFld(); }));
      box.appendChild(bar);
      f.fields.forEach((sf) => box.appendChild(buildField(item, sf)));
      w.appendChild(box);
    });
    w.appendChild(mini((f.addLabel || "+ Adicionar"), "addrow", () => { arr.push(blankFromFields(f.fields)); reFld(); }));
    const h = helpEl(f); if (h) w.appendChild(h);
    function reFld() { const nw = fObjList(data, f); w.replaceWith(nw); soft(); }
    return w;
  }
  function blankFromFields(fields) {
    const o = {};
    fields.forEach((sf) => { o[sf.k] = sf.type === "list" ? [] : ""; });
    return o;
  }

  // blocos tipados (h/p/bullet/intro/step/warn/hint)
  function fBlocks(data, f) {
    const arr = data[f.k] || (data[f.k] = []);
    const w = el("div", "fld");
    w.appendChild(labelEl(f));
    arr.forEach((b, i) => {
      const box = el("div", "sub");
      const bar = el("div", "sub-bar");
      const sel = el("select");
      sel.style.flex = "1";
      BLOCK_TYPES.forEach((o) => {
        const op = el("option", null, o.label); op.value = o.v;
        if (b.type === o.v) op.selected = true; sel.appendChild(op);
      });
      sel.addEventListener("change", () => {
        b.type = sel.value;
        if (b.type === "step") { b.badge = b.badge || ""; b.lead = b.lead || ""; b.text = b.text || ""; }
        reFld();
      });
      bar.appendChild(sel);
      bar.appendChild(mini("↑", "iconbtn", () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; reFld(); } }));
      bar.appendChild(mini("↓", "iconbtn", () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; reFld(); } }));
      bar.appendChild(mini("✕", "iconbtn del", () => { arr.splice(i, 1); reFld(); }));
      box.appendChild(bar);
      if (b.type === "step") {
        box.appendChild(buildField(b, { k: "badge", label: "Badge", type: "text" }));
        box.appendChild(buildField(b, { k: "lead", label: "Lead", type: "text" }));
        box.appendChild(buildField(b, { k: "text", label: "Texto", type: "textarea" }));
      } else {
        box.appendChild(buildField(b, { k: "text", label: "Texto", type: "textarea",
          help: b.type === "p" ? "Use **negrito**." : null }));
      }
      w.appendChild(box);
    });
    const add = el("div", "row-item");
    add.appendChild(mini("+ Bloco", "addrow", () => { arr.push({ type: "p", text: "" }); reFld(); }));
    w.appendChild(add);
    function reFld() { const nw = fBlocks(data, f); w.replaceWith(nw); soft(); }
    return w;
  }

  // callout opcional
  function fCallout(data, f) {
    const w = el("div", "fld");
    const on = !!(data.callout && data.callout.desc !== undefined);
    const tog = el("label", "toggle");
    const cb = el("input"); cb.type = "checkbox"; cb.checked = on;
    tog.appendChild(cb); tog.appendChild(document.createTextNode(f.label));
    cb.addEventListener("change", () => {
      if (cb.checked) data.callout = { kind: "info", title: "", desc: "" };
      else delete data.callout;
      const nw = fCallout(data, f); w.replaceWith(nw); soft();
    });
    w.appendChild(tog);
    if (on) {
      const box = el("div", "sub");
      box.appendChild(buildField(data.callout, { k: "kind", label: "Tipo", type: "select", options: CALLOUT_KINDS }));
      box.appendChild(buildField(data.callout, { k: "title", label: "Título (opcional)", type: "text" }));
      box.appendChild(buildField(data.callout, { k: "desc", label: "Texto", type: "textarea", help: "Use **negrito**." }));
      w.appendChild(box);
    }
    return w;
  }

  function mini(txt, cls, fn) {
    const b = el("button", cls, txt);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  // ================= topbar / menu / export =================
  function buildAddMenu() {
    const menu = $("#addmenu");
    menu.innerHTML = "";
    menu.classList.add("previews");
    const scale = 120 / 1920; // largura do mini frame / largura do slide
    ORDER.forEach((t) => {
      const comp = COMPONENTS[t];
      const b = el("button", "opt");
      const frame = el("div", "mini");
      const scaler = el("div", "stage-scaler");
      scaler.style.transform = "scale(" + scale + ")";
      const s = el("div", "slide c-" + t + (comp.dark ? " dark" : ""));
      s.innerHTML = comp.render(comp.make(), 1);
      scaler.appendChild(s);
      frame.appendChild(scaler);
      b.appendChild(frame);
      b.appendChild(el("span", "nm", comp.label));
      b.addEventListener("click", () => { addSlide(t); menu.classList.remove("open"); });
      menu.appendChild(b);
    });
  }
  $("#addbtn").addEventListener("click", (e) => {
    e.stopPropagation();
    $("#addmenu").classList.toggle("open");
  });
  document.addEventListener("click", () => $("#addmenu").classList.remove("open"));

  // projeto / meta
  const projInput = $("#proj");
  projInput.value = deck.meta.project || "";
  projInput.addEventListener("input", () => { deck.meta.project = projInput.value; persist(); });

  // exportar deck.json
  $("#btn-export").addEventListener("click", () => {
    const clean = JSON.parse(JSON.stringify(deck));
    clean.slides.forEach((s) => delete s.id); // id é só interno do studio
    download(JSON.stringify(clean, null, 2), "deck.json", "application/json");
  });

  // importar deck.json
  $("#file-import").addEventListener("change", (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const obj = JSON.parse(r.result);
        if (!obj.slides) throw new Error("sem 'slides'");
        deck = obj;
        deck.meta = deck.meta || { project: "Deck", date: "17/07/2026", output_file: "deck.pptx" };
        deck.slides.forEach((s) => (s.id = s.id || uid()));
        window.STUDIO_META = deck.meta;
        projInput.value = deck.meta.project || "";
        cur = deck.slides.length ? 0 : -1;
        renderAll();
      } catch (e) { alert("JSON inválido: " + e.message); }
    };
    r.readAsText(file);
    ev.target.value = "";
  });
  $("#btn-import").addEventListener("click", () => $("#file-import").click());

  // carregar exemplo (fetch do deck.json ao lado do studio)
  $("#btn-example").addEventListener("click", () => {
    fetch("../deck.json")
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((obj) => {
        deck = obj;
        window.STUDIO_META = deck.meta;
        deck.slides.forEach((s) => (s.id = s.id || uid()));
        projInput.value = deck.meta.project || "";
        cur = 0; renderAll();
      })
      .catch(() =>
        alert("Não consegui carregar ../deck.json automaticamente (comum ao abrir via file://).\n" +
              "Use o botão Importar e selecione o deck.json, ou rode um servidor local:\n" +
              "  python3 -m http.server  (dentro da pasta studio)"));
  });

  // imprimir / PDF — monta todos os slides em #printRoot (1 por página)
  $("#btn-print").addEventListener("click", () => {
    const root = $("#printRoot");
    root.innerHTML = "";
    const scale = ((297 / 25.4) * 96) / 1920; // 297mm de largura / 1920px
    deck.slides.forEach((slide, i) => {
      const comp = COMPONENTS[slide.component];
      const page = el("div", "page");
      const scaler = el("div", "stage-scaler");
      scaler.style.transform = "scale(" + scale + ")";
      const s = el("div", "slide c-" + slide.component + (comp.dark ? " dark" : ""));
      s.innerHTML = comp.render(slide, i + 1);
      scaler.appendChild(s);
      page.appendChild(scaler);
      root.appendChild(page);
    });
    window.print();
  });

  function download(text, name, type) {
    const blob = new Blob([text], { type: type });
    const a = el("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // atalhos
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input,textarea,select")) return;
    if (e.key === "ArrowDown" && cur < deck.slides.length - 1) select(cur + 1);
    if (e.key === "ArrowUp" && cur > 0) select(cur - 1);
  });

  window.addEventListener("resize", () => renderStage());

  // ---------------- boot ----------------
  buildAddMenu();
  renderAll();
})();
