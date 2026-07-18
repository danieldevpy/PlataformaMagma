/* ============================================================
   MESA DE LUZ — Acervo de Mídia da Turma (JS puro, sem libs)
   Consome a API /api/midia/ conforme contrato do doc 09.
   Globais usados (definidos pelo template): MAGMA_CSRF,
   MAGMA_API_BASE, MAGMA_TURMA. Nenhum outro global é criado.
   ============================================================ */
(function () {
  "use strict";

  var TURMA = window.MAGMA_TURMA || {};
  var API_BASE = (window.MAGMA_API_BASE || "/api/midia").replace(/\/$/, "");
  var CSRF = window.MAGMA_CSRF || "";

  var TAGS = ["destaque", "capa", "avaliacao"];
  var TAG_ICON = { destaque: "⭐", capa: "🖼️", avaliacao: "💬" };
  var TAG_LABEL = {
    destaque: "destaque",
    capa: "capa",
    avaliacao: "avaliação",
  };
  var TECLA_TAG = { d: "destaque", c: "capa", a: "avaliacao" };

  // ---------------------------------------------------------
  // Estado
  // ---------------------------------------------------------
  var estado = {
    itens: [],
    consentimento: !!TURMA.consentimento,
    selecionados: new Set(),
    hoverId: null,
    focusId: null,
    filaAtiva: false,
  };

  // ---------------------------------------------------------
  // Referências DOM
  // ---------------------------------------------------------
  var el = {
    contadores: byId("contadores"),
    consentBtn: byId("btnConsentimento"),
    uploader: byId("uploader"),
    fileInput: byId("fileInput"),
    queue: byId("queue"),
    grid: byId("grid"),
    emptyState: byId("emptyState"),
    bulkBar: byId("bulkBar"),
    bulkCount: byId("bulkCount"),
    bulkRemove: byId("bulkRemove"),
    bulkClear: byId("bulkClear"),
    lightbox: byId("lightbox"),
    lightboxStage: byId("lightboxStage"),
    lightboxClose: byId("lightboxClose"),
    confirmDialog: byId("confirmDialog"),
    confirmMsg: byId("confirmMsg"),
    confirmOk: byId("confirmOk"),
    confirmCancel: byId("confirmCancel"),
    toasts: byId("toasts"),
    brandMark: byId("brandMark"),
  };

  function byId(id) {
    return document.getElementById(id);
  }

  // ---------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------
  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
          c
        ] || c
      );
    });
  }

  function nomeArquivo(url) {
    if (!url) return "arquivo";
    try {
      var limpo = url.split("?")[0];
      var partes = limpo.split("/");
      return decodeURIComponent(partes[partes.length - 1] || "arquivo");
    } catch (e) {
      return "arquivo";
    }
  }

  function toast(msg, tipo) {
    var div = document.createElement("div");
    div.className = "toast" + (tipo ? " toast--" + tipo : "");
    div.textContent = msg;
    el.toasts.appendChild(div);
    setTimeout(function () {
      div.style.transition = "opacity .25s ease";
      div.style.opacity = "0";
      setTimeout(function () {
        div.remove();
      }, 260);
    }, 4200);
  }

  function confirmar(msg) {
    return new Promise(function (resolve) {
      el.confirmMsg.textContent = msg;
      el.confirmDialog.hidden = false;
      function limpar(valor) {
        el.confirmDialog.hidden = true;
        el.confirmOk.removeEventListener("click", onOk);
        el.confirmCancel.removeEventListener("click", onCancel);
        resolve(valor);
      }
      function onOk() {
        limpar(true);
      }
      function onCancel() {
        limpar(false);
      }
      el.confirmOk.addEventListener("click", onOk);
      el.confirmCancel.addEventListener("click", onCancel);
    });
  }

  // ---------------------------------------------------------
  // Chamadas à API
  // ---------------------------------------------------------
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    var metodo = (opts.method || "GET").toUpperCase();
    if (metodo !== "GET") {
      headers["X-CSRFToken"] = CSRF;
    }
    var body = opts.body;
    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    return fetch(API_BASE + path, {
      method: metodo,
      credentials: "same-origin",
      headers: headers,
      body: body,
    }).then(function (resp) {
      if (!resp.ok) {
        return resp
          .text()
          .catch(function () {
            return "";
          })
          .then(function (txt) {
            var msg = "Não foi possível completar a ação (" + resp.status + ").";
            try {
              var json = JSON.parse(txt);
              if (json && (json.detail || json.erro || json.mensagem)) {
                msg = json.detail || json.erro || json.mensagem;
              }
            } catch (e) {
              /* corpo não é JSON, mantém mensagem genérica */
            }
            var erro = new Error(msg);
            erro.status = resp.status;
            throw erro;
          });
      }
      if (resp.status === 204) return null;
      return resp.json().catch(function () {
        return null;
      });
    });
  }

  // ---------------------------------------------------------
  // Contadores
  // ---------------------------------------------------------
  function computarContagens() {
    var c = { foto: 0, video: 0, arte: 0, destaque: 0, capa: 0, avaliacao: 0 };
    estado.itens.forEach(function (item) {
      if (item.tipo === "foto") c.foto++;
      else if (item.tipo === "video") c.video++;
      else if (item.tipo === "arte") c.arte++;
      (item.tags || []).forEach(function (t) {
        if (c[t] !== undefined) c[t]++;
      });
    });
    return c;
  }

  function renderContadores() {
    var c = computarContagens();
    el.contadores.innerHTML = [
      "<b>" + c.foto + "</b> fotos",
      "<b>" + c.video + "</b> vídeos",
      "<b>" + c.arte + "</b> artes",
      "<b>" + c.destaque + "</b> ⭐",
      "<b>" + c.capa + "</b> 🖼️",
      "<b>" + c.avaliacao + "</b> 💬",
    ]
      .map(function (txt) {
        return "<span>" + txt + "</span>";
      })
      .join("<span aria-hidden=\"true\">·</span>");
  }

  function renderConsentimento() {
    var ativo = !!estado.consentimento;
    el.consentBtn.setAttribute("aria-pressed", ativo ? "true" : "false");
    el.consentBtn.querySelector(".consent-toggle__txt").textContent = ativo
      ? "Consentimento de imagem: concedido pela turma"
      : "Consentimento de imagem: não concedido";
  }

  // ---------------------------------------------------------
  // Grid / cards
  // ---------------------------------------------------------
  function ordenarItens() {
    estado.itens.sort(function (a, b) {
      var oa = a.ordem || 0,
        ob = b.ordem || 0;
      if (oa !== ob) return oa - ob;
      return a.id - b.id;
    });
  }

  function cardHtml(item) {
    var tags = item.tags || [];
    var stamps = TAGS.map(function (tag) {
      var ativo = tags.indexOf(tag) !== -1;
      return (
        '<button type="button" class="stamp" data-tag="' +
        tag +
        '" data-id="' +
        item.id +
        '" aria-pressed="' +
        (ativo ? "true" : "false") +
        '" aria-label="' +
        TAG_LABEL[tag] +
        " (" +
        (tag === "destaque" ? "D" : tag === "capa" ? "C" : "A") +
        ')">' +
        TAG_ICON[tag] +
        "</button>"
      );
    }).join("");

    var midia;
    if (item.tipo === "video") {
      midia =
        '<div class="card__media card__media--video">' +
        '<span class="card__videoic" aria-hidden="true">▶</span>' +
        '<span class="card__videoname">' +
        escapeHtml(item.legenda || nomeArquivo(item.arquivo_url)) +
        "</span>" +
        "</div>";
    } else {
      midia =
        '<div class="card__media"><img src="' +
        escapeHtml(item.thumb_url || item.arquivo_url) +
        '" alt="' +
        escapeHtml(item.legenda || item.tipo) +
        '" loading="lazy" /></div>';
    }

    return (
      '<article class="card" data-id="' +
      item.id +
      '" data-tipo="' +
      item.tipo +
      '" tabindex="0" role="listitem" aria-label="Item ' +
      item.tipo +
      (item.legenda ? " — " + escapeHtml(item.legenda) : "") +
      '">' +
      '<span class="card__tipo-badge">' +
      item.tipo +
      "</span>" +
      midia +
      '<div class="card__grad" aria-hidden="true"></div>' +
      '<label class="card__select">' +
      '<input type="checkbox" class="card__checkbox" data-id="' +
      item.id +
      '" aria-label="Selecionar item" />' +
      "</label>" +
      '<div class="card__stamps">' +
      stamps +
      "</div>" +
      "</article>"
    );
  }

  function renderGrid(opts) {
    opts = opts || {};
    ordenarItens();
    var idsRevelar = opts.revelarIds || [];
    el.grid.innerHTML = estado.itens.map(cardHtml).join("");
    el.emptyState.hidden = estado.itens.length > 0;
    el.grid.hidden = estado.itens.length === 0;

    // reaplica classe de seleção
    estado.selecionados.forEach(function (id) {
      var card = el.grid.querySelector('.card[data-id="' + id + '"]');
      if (card) {
        card.classList.add("is-selected");
        var cb = card.querySelector(".card__checkbox");
        if (cb) cb.checked = true;
      }
    });

    if (idsRevelar.length) {
      idsRevelar.forEach(function (id) {
        var card = el.grid.querySelector('.card[data-id="' + id + '"]');
        if (card) card.classList.add("revealing");
      });
    }

    renderContadores();
    atualizarBarraSelecao();
  }

  function localizarItem(id) {
    id = Number(id);
    for (var i = 0; i < estado.itens.length; i++) {
      if (estado.itens[i].id === id) return estado.itens[i];
    }
    return null;
  }

  // ---------------------------------------------------------
  // Curadoria (tags)
  // ---------------------------------------------------------
  function aplicarTagLocal(item, tag, ligar) {
    var tags = item.tags ? item.tags.slice() : [];
    var idx = tags.indexOf(tag);
    if (ligar && idx === -1) tags.push(tag);
    if (!ligar && idx !== -1) tags.splice(idx, 1);
    item.tags = tags;
  }

  function toggleTag(id, tag) {
    var item = localizarItem(id);
    if (!item) return Promise.resolve();
    var tags = item.tags || [];
    var ligar = tags.indexOf(tag) === -1;

    var anterior = tags.slice();
    aplicarTagLocal(item, tag, ligar);
    renderGrid();
    animarPop(id, tag);

    var promessas = [
      api("/itens/" + id + "/", { method: "PATCH", body: { tags: item.tags } }).then(
        function (resp) {
          if (resp && resp.tags) item.tags = resp.tags;
        }
      ),
    ];

    if (tag === "capa" && ligar) {
      // regra: capa é única — remove dos outros itens que a tinham
      estado.itens.forEach(function (outro) {
        if (outro.id !== item.id && (outro.tags || []).indexOf("capa") !== -1) {
          aplicarTagLocal(outro, "capa", false);
          promessas.push(
            api("/itens/" + outro.id + "/", {
              method: "PATCH",
              body: { tags: outro.tags },
            }).catch(function () {
              /* silencioso — próxima carga corrige */
            })
          );
        }
      });
    }

    return Promise.all(promessas)
      .then(function () {
        renderGrid();
      })
      .catch(function (e) {
        item.tags = anterior;
        renderGrid();
        toast("Não foi possível atualizar a curadoria: " + e.message, "erro");
      });
  }

  function animarPop(id, tag) {
    var card = el.grid.querySelector('.card[data-id="' + id + '"]');
    if (!card) return;
    var btn = card.querySelector('.stamp[data-tag="' + tag + '"]');
    if (!btn) return;
    btn.classList.remove("pop");
    // força reflow para reiniciar a animação
    void btn.offsetWidth;
    btn.classList.add("pop");
  }

  // ---------------------------------------------------------
  // Seleção múltipla
  // ---------------------------------------------------------
  function alternarSelecao(id, forcar) {
    id = Number(id);
    var selecionado =
      forcar === undefined ? !estado.selecionados.has(id) : forcar;
    if (selecionado) estado.selecionados.add(id);
    else estado.selecionados.delete(id);

    var card = el.grid.querySelector('.card[data-id="' + id + '"]');
    if (card) {
      card.classList.toggle("is-selected", selecionado);
      var cb = card.querySelector(".card__checkbox");
      if (cb) cb.checked = selecionado;
    }
    atualizarBarraSelecao();
  }

  function limparSelecao() {
    estado.selecionados.clear();
    el.grid.querySelectorAll(".card.is-selected").forEach(function (card) {
      card.classList.remove("is-selected");
      var cb = card.querySelector(".card__checkbox");
      if (cb) cb.checked = false;
    });
    atualizarBarraSelecao();
  }

  function atualizarBarraSelecao() {
    var n = estado.selecionados.size;
    el.bulkBar.hidden = n === 0;
    el.bulkCount.textContent =
      n === 0
        ? "0 selecionados"
        : n === 1
        ? "1 selecionado"
        : n + " selecionados";
  }

  function bulkTaguear(tag) {
    var ids = Array.from(estado.selecionados);
    if (!ids.length) return;
    if (tag === "capa" && ids.length > 1) {
      toast("Capa é única por turma — aplicando apenas ao primeiro item selecionado.");
      ids = ids.slice(0, 1);
    }
    Promise.all(
      ids.map(function (id) {
        var item = localizarItem(id);
        if (!item || (item.tags || []).indexOf(tag) !== -1) return Promise.resolve();
        return toggleTag(id, tag);
      })
    ).then(function () {
      toast("Itens marcados com " + TAG_ICON[tag] + " " + TAG_LABEL[tag] + ".", "sucesso");
    });
  }

  function bulkRemover() {
    var ids = Array.from(estado.selecionados);
    if (!ids.length) return;
    var msg =
      ids.length === 1
        ? "Remover este item do acervo? Essa ação não pode ser desfeita."
        : "Remover " + ids.length + " itens do acervo? Essa ação não pode ser desfeita.";
    confirmar(msg).then(function (ok) {
      if (!ok) return;
      Promise.all(
        ids.map(function (id) {
          return api("/itens/" + id + "/", { method: "DELETE" })
            .then(function () {
              estado.itens = estado.itens.filter(function (it) {
                return it.id !== id;
              });
              estado.selecionados.delete(id);
            })
            .catch(function (e) {
              toast("Erro ao remover um item: " + e.message, "erro");
            });
        })
      ).then(function () {
        renderGrid();
        toast("Itens removidos.", "sucesso");
      });
    });
  }

  // ---------------------------------------------------------
  // Lightbox
  // ---------------------------------------------------------
  function abrirLightbox(item) {
    var html;
    if (item.tipo === "video") {
      html =
        '<video src="' +
        escapeHtml(item.arquivo_url) +
        '" controls autoplay></video>';
    } else {
      html =
        '<img src="' +
        escapeHtml(item.arquivo_url) +
        '" alt="' +
        escapeHtml(item.legenda || item.tipo) +
        '" />';
    }
    el.lightboxStage.innerHTML = html;
    el.lightbox.hidden = false;
    el.lightboxClose.focus();
  }

  function fecharLightbox() {
    el.lightbox.hidden = true;
    var video = el.lightboxStage.querySelector("video");
    if (video) video.pause();
    el.lightboxStage.innerHTML = "";
  }

  // ---------------------------------------------------------
  // Upload — fila sequencial via XHR
  // ---------------------------------------------------------
  var filaUpload = [];

  // Assinatura de arquivo pra detecção de duplicado — nome (case-insensitive,
  // sem espaços nas pontas) + tamanho em bytes. Simples e sem custo (não lê
  // conteúdo), suficiente pro caso comum: instrutor seleciona a mesma pasta
  // duas vezes, ou arrasta um lote que já subiu antes.
  function assinatura(nome, tamanho) {
    return (nome || "").trim().toLowerCase() + "|" + tamanho;
  }

  function assinaturasDoAcervo() {
    var set = {};
    estado.itens.forEach(function (item) {
      if (item.tipo !== "foto" && item.tipo !== "video") return;
      var nome = item.meta && item.meta.nome_original;
      var tamanho = item.meta && item.meta.size;
      if (!nome || tamanho == null) return;
      set[assinatura(nome, tamanho)] = true;
    });
    return set;
  }

  function enfileirar(arquivos) {
    var jaNoAcervo = assinaturasDoAcervo();
    var jaNaFila = {};
    filaUpload.forEach(function (f) {
      jaNaFila[assinatura(f.file.name, f.file.size)] = true;
    });

    var semDuplicata = [];
    var duplicados = [];
    Array.from(arquivos).forEach(function (file) {
      var assin = assinatura(file.name, file.size);
      if (jaNoAcervo[assin] || jaNaFila[assin]) {
        duplicados.push(file);
      } else {
        semDuplicata.push(file);
        jaNaFila[assin] = true; // evita duplicar dentro do próprio lote solto
      }
    });

    enfileirarArquivos(semDuplicata, false);

    if (!duplicados.length) return;
    var lista = duplicados
      .map(function (f) {
        return f.name;
      })
      .join(", ");
    var msg =
      (duplicados.length === 1
        ? "1 arquivo já parece estar no acervo (mesmo nome e tamanho): "
        : duplicados.length + " arquivos já parecem estar no acervo (mesmo nome e tamanho): ") +
      lista +
      ". Enviar mesmo assim?";
    confirmar(msg).then(function (ok) {
      if (ok) {
        enfileirarArquivos(duplicados, true);
      } else {
        toast(
          duplicados.length === 1
            ? "1 duplicado ignorado."
            : duplicados.length + " duplicados ignorados.",
          "aviso"
        );
      }
    });
  }

  function enfileirarArquivos(arquivos, forcar) {
    if (!arquivos.length) return;
    var novos = arquivos.map(function (file, i) {
      return {
        uid: "u" + Date.now() + "_" + i + "_" + Math.random().toString(36).slice(2, 6),
        file: file,
        status: "pendente", // pendente | enviando | ok | duplicado | erro
        pct: 0,
        erro: "",
        forcar: !!forcar,
      };
    });
    filaUpload = filaUpload.concat(novos);
    el.queue.hidden = false;
    renderFila();
    if (!estado.filaAtiva) processarFila();
  }

  var ICONE_STATUS = { ok: "✅", erro: "⚠️", duplicado: "⏭️" };
  var LABEL_STATUS = { erro: "erro", duplicado: "já existe" };

  function renderFila() {
    el.queue.innerHTML = filaUpload
      .map(function (f) {
        var classe = "qitem" + (f.status !== "pendente" && f.status !== "enviando" ? " qitem--" + (f.status === "ok" ? "done" : f.status) : "");
        var icone = ICONE_STATUS[f.status] || "⏳";
        return (
          '<div class="' +
          classe +
          '" data-uid="' +
          f.uid +
          '">' +
          '<span class="qitem__ic" aria-hidden="true">' +
          icone +
          "</span>" +
          '<div class="qitem__body">' +
          '<span class="qitem__name">' +
          escapeHtml(f.file.name) +
          "</span>" +
          '<div class="qitem__bar"><span style="width:' +
          f.pct +
          '%"></span></div>' +
          "</div>" +
          '<span class="qitem__pct">' +
          (LABEL_STATUS[f.status] || f.pct + "%") +
          "</span>" +
          "</div>"
        );
      })
      .join("");

    // some com itens concluídos/pulados há mais tempo, mantendo fila enxuta
    var concluidos = filaUpload.filter(function (f) {
      return f.status === "ok" || f.status === "duplicado";
    });
    if (concluidos.length) {
      setTimeout(function () {
        filaUpload = filaUpload.filter(function (f) {
          return f.status !== "ok" && f.status !== "duplicado";
        });
        renderFila();
        if (!filaUpload.length) el.queue.hidden = true;
      }, 1400);
    }
  }

  function processarFila() {
    var proximo = filaUpload.find(function (f) {
      return f.status === "pendente";
    });
    if (!proximo) {
      estado.filaAtiva = false;
      return;
    }
    estado.filaAtiva = true;
    proximo.status = "enviando";
    renderFila();

    enviarArquivo(proximo)
      .then(function (item) {
        proximo.status = "ok";
        proximo.pct = 100;
        estado.itens.push(item);
        renderGrid({ revelarIds: [item.id] });
      })
      .catch(function (e) {
        if (e.duplicado) {
          // Backstop server-side (outra aba, outro cliente da API) — o
          // arquivo já existe, então não há nada novo pra pendurar em
          // estado.itens; só avisa e segue a fila sem travar.
          proximo.status = "duplicado";
          proximo.erro = e.message || "já existe no acervo";
          toast(proximo.file.name + ": " + proximo.erro, "aviso");
        } else {
          proximo.status = "erro";
          proximo.erro = e.message || "falha no envio";
          toast(
            "Falha ao enviar " + proximo.file.name + ": " + proximo.erro,
            "erro"
          );
        }
      })
      .then(function () {
        renderFila();
        processarFila();
      });
  }

  function enviarArquivo(fila) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      var url = API_BASE + "/turmas/" + TURMA.id + "/enviar/";
      xhr.open("POST", url, true);
      xhr.withCredentials = true;
      xhr.setRequestHeader("X-CSRFToken", CSRF);

      xhr.upload.onprogress = function (ev) {
        if (ev.lengthComputable) {
          fila.pct = Math.round((ev.loaded / ev.total) * 100);
          renderFila();
        }
      };

      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error("resposta inválida do servidor"));
          }
        } else {
          var msg = "não foi possível enviar (" + xhr.status + ")";
          var duplicado = false;
          try {
            var json = JSON.parse(xhr.responseText);
            msg = json.detail || json.erro || json.mensagem || msg;
            duplicado = xhr.status === 409 && !!json.duplicado;
          } catch (e) {
            /* mantém mensagem genérica */
          }
          var erro = new Error(msg);
          erro.duplicado = duplicado;
          reject(erro);
        }
      };
      xhr.onerror = function () {
        reject(new Error("falha de rede"));
      };

      var form = new FormData();
      form.append("arquivo", fila.file);
      if (fila.forcar) form.append("forcar", "1");
      xhr.send(form);
    });
  }

  // ---------------------------------------------------------
  // Consentimento
  // ---------------------------------------------------------
  function alternarConsentimento() {
    var novoValor = !estado.consentimento;
    api("/turmas/" + TURMA.id + "/consentimento/", {
      method: "POST",
      body: { ativo: novoValor },
    })
      .then(function (resp) {
        estado.consentimento = resp
          ? !!resp.consentimento_midia
          : novoValor;
        renderConsentimento();
        toast(
          estado.consentimento
            ? "Consentimento de imagem concedido para esta turma."
            : "Consentimento de imagem removido para esta turma.",
          "sucesso"
        );
      })
      .catch(function (e) {
        toast("Não foi possível atualizar o consentimento: " + e.message, "erro");
      });
  }

  // ---------------------------------------------------------
  // Carregamento inicial
  // ---------------------------------------------------------
  function carregarAcervo() {
    renderConsentimento();
    return api("/turmas/" + TURMA.id + "/acervo/")
      .then(function (resp) {
        estado.itens = (resp && resp.itens) || [];
        if (resp && resp.turma && typeof resp.turma.consentimento_midia === "boolean") {
          estado.consentimento = resp.turma.consentimento_midia;
        }
        renderConsentimento();
        renderGrid();
      })
      .catch(function (e) {
        el.contadores.innerHTML =
          '<span class="stat-skel">não foi possível carregar o acervo</span>';
        toast("Erro ao carregar o acervo: " + e.message, "erro");
      });
  }

  // ---------------------------------------------------------
  // Marca (logo Estrela da Vida)
  // ---------------------------------------------------------
  function renderMarca() {
    el.brandMark.innerHTML =
      '<svg viewBox="0 0 100 110"><polygon points="50,8 90,31 90,79 50,102 10,79 10,31" fill="#232c3d" stroke="#232c3d" stroke-width="12" stroke-linejoin="round"/><polygon points="50,15 84.5,35 84.5,75 50,95 15.5,75 15.5,35" fill="#fff" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><polygon points="50,19 81,37 81,73 50,91 19,73 19,37" fill="#c8102e" stroke="#c8102e" stroke-width="7" stroke-linejoin="round"/><g transform="translate(50,55)"><g fill="#fff"><rect x="-9" y="-27" width="18" height="54" rx="3.5"/><rect x="-9" y="-27" width="18" height="54" rx="3.5" transform="rotate(60)"/><rect x="-9" y="-27" width="18" height="54" rx="3.5" transform="rotate(-60)"/></g><g fill="#1d4f91"><rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4"/><rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4" transform="rotate(60)"/><rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4" transform="rotate(-60)"/></g><circle cx="0" cy="-17.5" r="3.1" fill="#fff"/><rect x="-1.7" y="-15" width="3.4" height="33" rx="1.7" fill="#fff"/><path d="M-5 -10 C 6 -7.5, 6 -3.5, 0 -1.5 C -6 0.5, -6 4.5, 0 6.5 C 5 8.2, 5 11.5, -3 13.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></g></svg>';
  }

  // ---------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------
  function ligarEventos() {
    // uploader — clique e drag&drop
    el.uploader.addEventListener("click", function () {
      el.fileInput.click();
    });
    el.uploader.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        el.fileInput.click();
      }
    });
    el.uploader.setAttribute("tabindex", "0");
    el.uploader.setAttribute("role", "button");

    ["dragenter", "dragover"].forEach(function (evtName) {
      el.uploader.addEventListener(evtName, function (ev) {
        ev.preventDefault();
        el.uploader.classList.add("drag");
      });
    });
    ["dragleave", "drop"].forEach(function (evtName) {
      el.uploader.addEventListener(evtName, function (ev) {
        ev.preventDefault();
        el.uploader.classList.remove("drag");
      });
    });
    el.uploader.addEventListener("drop", function (ev) {
      var arquivos = ev.dataTransfer && ev.dataTransfer.files;
      if (arquivos && arquivos.length) enfileirar(arquivos);
    });
    el.fileInput.addEventListener("change", function () {
      if (el.fileInput.files && el.fileInput.files.length) {
        enfileirar(el.fileInput.files);
      }
      el.fileInput.value = "";
    });

    // grid — delegação de eventos
    el.grid.addEventListener("click", function (ev) {
      var stampBtn = ev.target.closest(".stamp");
      if (stampBtn) {
        toggleTag(stampBtn.dataset.id, stampBtn.dataset.tag);
        return;
      }
      if (ev.target.closest(".card__select")) return; // deixa o checkbox agir
      var card = ev.target.closest(".card");
      if (!card) return;
      var item = localizarItem(card.dataset.id);
      if (item) abrirLightbox(item);
    });

    el.grid.addEventListener("change", function (ev) {
      if (ev.target.classList.contains("card__checkbox")) {
        alternarSelecao(ev.target.dataset.id, ev.target.checked);
      }
    });

    el.grid.addEventListener(
      "mouseover",
      function (ev) {
        var card = ev.target.closest(".card");
        if (card) estado.hoverId = Number(card.dataset.id);
      },
      true
    );
    el.grid.addEventListener(
      "mouseout",
      function (ev) {
        var card = ev.target.closest(".card");
        if (card && Number(card.dataset.id) === estado.hoverId) {
          estado.hoverId = null;
        }
      },
      true
    );
    el.grid.addEventListener(
      "focusin",
      function (ev) {
        var card = ev.target.closest(".card");
        if (card) estado.focusId = Number(card.dataset.id);
      }
    );
    el.grid.addEventListener(
      "focusout",
      function (ev) {
        var card = ev.target.closest(".card");
        if (card && Number(card.dataset.id) === estado.focusId) {
          estado.focusId = null;
        }
      }
    );

    // long-press mobile para entrar em modo de seleção
    var pressTimer = null;
    el.grid.addEventListener("touchstart", function (ev) {
      var card = ev.target.closest(".card");
      if (!card) return;
      pressTimer = setTimeout(function () {
        card.classList.add("select-mode");
        alternarSelecao(card.dataset.id, true);
      }, 480);
    });
    ["touchend", "touchmove", "touchcancel"].forEach(function (evtName) {
      el.grid.addEventListener(evtName, function () {
        clearTimeout(pressTimer);
      });
    });

    // atalhos de teclado D/C/A
    document.addEventListener("keydown", function (ev) {
      var alvo = ev.target;
      var digitando =
        alvo &&
        (alvo.tagName === "INPUT" ||
          alvo.tagName === "TEXTAREA" ||
          alvo.isContentEditable);
      if (digitando) return;

      if (ev.key === "Escape") {
        if (!el.lightbox.hidden) fecharLightbox();
        return;
      }

      var tag = TECLA_TAG[ev.key.toLowerCase()];
      if (!tag) return;
      var alvoId = estado.focusId || estado.hoverId;
      if (!alvoId) return;
      ev.preventDefault();
      toggleTag(alvoId, tag);
    });

    // lightbox
    el.lightboxClose.addEventListener("click", fecharLightbox);
    el.lightbox.addEventListener("click", function (ev) {
      if (ev.target === el.lightbox) fecharLightbox();
    });

    // barra de seleção
    el.bulkBar.addEventListener("click", function (ev) {
      var tagBtn = ev.target.closest("[data-bulk-tag]");
      if (tagBtn) {
        bulkTaguear(tagBtn.dataset.bulkTag);
        return;
      }
      if (ev.target === el.bulkRemove) bulkRemover();
      if (ev.target === el.bulkClear) limparSelecao();
    });

    // consentimento
    el.consentBtn.addEventListener("click", alternarConsentimento);
  }

  // ---------------------------------------------------------
  // Inicialização
  // ---------------------------------------------------------
  function init() {
    if (!TURMA || !TURMA.id) {
      toast("Turma não identificada — recarregue a página.", "erro");
      return;
    }
    renderMarca();
    ligarEventos();
    carregarAcervo();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
