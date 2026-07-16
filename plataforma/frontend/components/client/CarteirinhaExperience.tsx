"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useReveal } from "@/hooks/useReveal";
import { API_URL } from "@/lib/api";
import type { ConviteCarteirinha } from "@/lib/types";
import "@/styles/carteirinha.css";

// Chave de localStorage pra "lembrar" a Matrícula individual que este
// device já gerou a partir de um link de turma (compartilhado) — assim
// reabrir o mesmo link não pede os dados de novo nem cria uma segunda
// carteirinha pra mesma pessoa.
function chaveLembranca(tokenDoLink: string): string {
  return `magma:carteirinha:${tokenDoLink}`;
}

type ConviteValido = Extract<ConviteCarteirinha, { valido: true }>;

function formatDateBr(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function iniciaisDe(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/**
 * Experiência completa da carteirinha digital — porta fiel de
 * carteirinha-digital/{index.html,carteirinha.css,carteirinha.js}
 * (ver esse diretório para o protótipo original). Mantém a mesma
 * abordagem imperativa (DOM direto, não estado do React) do
 * protótipo — como já faz o hook useReveal() do resto do site —
 * trocando apenas: matrícula/validade/curso vêm do convite real
 * (não de query string) e o passo final envia a foto pra API de
 * verdade em vez de só mover o nó na tela.
 */
export default function CarteirinhaExperience({
  token,
  convite,
}: {
  token: string;
  convite: ConviteValido;
}) {
  useReveal();
  const router = useRouter();
  const jaRodou = useRef(false);

  const aluno = convite.aluno;
  const jaPreenchida = convite.preenchida && convite.aluno;
  // admin pode já ter vinculado um aluno com só o nome (ver Django Admin →
  // Matrícula → campo "aluno") — nesse caso o nome já entra pronto no
  // cartão e a etapa "como você se chama?" nem aparece no formulário.
  const nomeConhecido = aluno?.nome?.trim() || null;
  const totalSteps = nomeConhecido ? 3 : 4;

  useEffect(() => {
    // guarda contra o double-invoke do StrictMode em dev: sem isso os
    // listeners abaixo seriam anexados duas vezes (cliques duplicados).
    if (jaRodou.current) return;
    jaRodou.current = true;

    // Link de turma (compartilhado) já preenchido por este device antes?
    // Manda pro token da carteirinha individual do aluno em vez de
    // mostrar o formulário em branco de novo.
    if (!convite.preenchida) {
      const meuToken = localStorage.getItem(chaveLembranca(token));
      if (meuToken && meuToken !== token) {
        router.replace(`/carteirinha/${meuToken}`);
        return;
      }
    }

    const $ = <T extends Element = HTMLElement>(sel: string) =>
      document.querySelector<T>(sel);
    const $$ = <T extends Element = HTMLElement>(sel: string) =>
      Array.from(document.querySelectorAll<T>(sel));

    const idCard = $("#idCard")!;
    const cardStage = $("#cardStage")!;
    idCard.classList.add("settling");

    const validadeFormatada = formatDateBr(convite.validade_carteirinha);

    function typeInto(el: Element, text: string, speed = 55) {
      el.textContent = "";
      let i = 0;
      return new Promise<void>((resolve) => {
        const t = setInterval(() => {
          el.textContent += text[i];
          i++;
          if (i >= text.length) {
            clearInterval(t);
            resolve();
          }
        }, speed);
      });
    }

    function drawQrMock(seedStr: string) {
      const canvas = $<HTMLCanvasElement>("#qrMock")!;
      const ctx = canvas.getContext("2d")!;
      const size = canvas.width,
        cells = 9,
        cell = size / cells;
      let seed = 0;
      for (let i = 0; i < seedStr.length; i++)
        seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
      function rand() {
        seed = (seed * 1103515245 + 12345) >>> 0;
        return (seed >>> 16) / 65535;
      }

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#101c38";

      const isFinder = (x: number, y: number) =>
        (x < 3 && y < 3) || (x >= cells - 3 && y < 3) || (x < 3 && y >= cells - 3);

      for (let x = 0; x < cells; x++) {
        for (let y = 0; y < cells; y++) {
          if (isFinder(x, y)) continue;
          if (rand() > 0.52) ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
      [
        [0, 0],
        [cells - 3, 0],
        [0, cells - 3],
      ].forEach(([fx, fy]) => {
        ctx.fillStyle = "#101c38";
        ctx.fillRect(fx * cell, fy * cell, cell * 3, cell * 3);
        ctx.fillStyle = "#fff";
        ctx.fillRect((fx + 0.6) * cell, (fy + 0.6) * cell, cell * 1.8, cell * 1.8);
        ctx.fillStyle = "#101c38";
        ctx.fillRect((fx + 1) * cell, (fy + 1) * cell, cell * 1, cell * 1);
      });
    }

    // tilt 3D do cartão (desktop) — parallax sutil ao mover o mouse
    let tiltRaf: number | null = null;
    function onMouseMove(e: MouseEvent) {
      const rect = idCard.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      if (tiltRaf) cancelAnimationFrame(tiltRaf);
      tiltRaf = requestAnimationFrame(() => {
        idCard.style.setProperty("--ry", `${px * 14}deg`);
        idCard.style.setProperty("--rx", `${-py * 14}deg`);
      });
    }
    function onMouseLeave() {
      idCard.style.setProperty("--ry", "0deg");
      idCard.style.setProperty("--rx", "0deg");
    }
    cardStage.addEventListener("mousemove", onMouseMove);
    cardStage.addEventListener("mouseleave", onMouseLeave);

    function launchConfetti() {
      const layer = $("#confettiLayer")!;
      const colors = ["#b8933f", "#dcb96a", "#c8102e", "#1d4f91", "#faf8f4"];
      for (let i = 0; i < 46; i++) {
        const piece = document.createElement("span");
        piece.className = "confetti-piece";
        const size = 5 + Math.random() * 6;
        piece.style.left = Math.random() * 100 + "vw";
        piece.style.width = size + "px";
        piece.style.height = size * (Math.random() > 0.5 ? 1 : 2.2) + "px";
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.setProperty(
          "--rot",
          `${(Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360)}deg`,
        );
        piece.style.animationDuration = 2.2 + Math.random() * 1.6 + "s";
        piece.style.animationDelay = Math.random() * 0.4 + "s";
        layer.appendChild(piece);
        setTimeout(() => piece.remove(), 4200);
      }
    }

    function finish(primeiroNome: string, isRevisita: boolean) {
      const atraso = isRevisita ? 0 : 420;
      setTimeout(() => {
        $("#successCardSlot")!.appendChild(cardStage);
        idCard.classList.add("sweep");
        if (!isRevisita) launchConfetti();
        $("#successName")!.textContent = primeiroNome;
        $("#successPanel")!.classList.add("show");
      }, atraso);
    }

    // ---------------------------------------------------------------
    // já preenchida (revisita): pula o formulário, só revela o cartão
    // pronto dentro do painel de sucesso — sem confete, sem sheet.
    // ---------------------------------------------------------------
    if (convite.preenchida && convite.aluno) {
      setTimeout(() => {
        typeInto($("#cardMatricula")!, convite.codigo_carteirinha, 30);
        typeInto($("#cardValidade")!, validadeFormatada, 35);
        drawQrMock(convite.codigo_carteirinha);
      }, 300);
      finish(convite.aluno.nome.split(" ")[0] || "Aluno", true);
      return () => {
        cardStage.removeEventListener("mousemove", onMouseMove);
        cardStage.removeEventListener("mouseleave", onMouseLeave);
      };
    }

    // ---------------------------------------------------------------
    // primeira visita: matrícula/validade "materializam" sozinhas ao
    // carregar (dado do sistema, não do aluno)
    // ---------------------------------------------------------------
    setTimeout(() => {
      typeInto($("#cardMatricula")!, convite.codigo_carteirinha, 45);
      typeInto($("#cardValidade")!, validadeFormatada, 55);
      drawQrMock(convite.codigo_carteirinha);
    }, 1000);

    const steps = $$(".step");
    const TOTAL = steps.length;
    let current = 0;
    const answers: {
      nome?: string;
      cpf?: string;
      nascimento?: string;
      photo?: { type: "image"; src: string; file: File } | { type: "initials"; value: string };
    } = { nome: nomeConhecido || undefined };

    const backdrop = $("#backdrop")!;
    const sheet = $("#sheet")!;
    const sheetBack = $("#sheetBack")!;
    const sheetNext = $("#sheetNext")!;
    const sheetCount = $("#sheetCount")!;
    const submitError = $("#submitError")!;
    const dots = $$(".sheet-progress .dot");
    const fillBtn = $("#fillBtn")!;

    function openSheet() {
      fillBtn.style.display = "none";
      document.body.classList.add("filling");
      backdrop.classList.add("show");
      sheet.classList.add("show");
      goToStep(0);
    }

    function closeSheet() {
      document.body.classList.remove("filling");
      backdrop.classList.remove("show");
      sheet.classList.remove("show");
    }

    function goToStep(i: number) {
      current = i;
      steps.forEach((s, idx) => s.classList.toggle("active", idx === i));
      dots.forEach((d, idx) => {
        d.classList.toggle("active", idx === i);
        d.classList.toggle("done", idx < i);
      });
      sheetCount.textContent = `${i + 1}/${TOTAL}`;
      sheetBack.classList.toggle("show", i > 0);
      submitError.setAttribute("hidden", "");
      focusCurrentInput();
    }

    function focusCurrentInput() {
      const active = steps[current];
      const input = active.querySelector<HTMLInputElement>('input[type="text"]');
      if (input) setTimeout(() => input.focus(), 380);
    }

    fillBtn.addEventListener("click", openSheet);
    sheetBack.addEventListener("click", () => {
      if (current > 0) goToStep(current - 1);
    });

    // ---- máscaras ----
    const inpCPF = $<HTMLInputElement>("#inpCPF")!;
    inpCPF.addEventListener("input", () => {
      let v = inpCPF.value.replace(/\D/g, "").slice(0, 11);
      v = v
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      inpCPF.value = v;
    });

    const inpBirth = $<HTMLInputElement>("#inpBirth")!;
    inpBirth.addEventListener("input", () => {
      let v = inpBirth.value.replace(/\D/g, "").slice(0, 8);
      v = v.replace(/(\d{2})(\d)/, "$1/$2").replace(/(\d{2})(\d)/, "$1/$2");
      inpBirth.value = v;
    });

    $$<HTMLInputElement>('.step input[type="text"]').forEach((inp) => {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleNext();
        }
      });
    });

    function shakeInput(inp: Element) {
      inp.classList.remove("shake");
      void (inp as HTMLElement).offsetWidth;
      inp.classList.add("shake");
    }

    function validateStep(targetId: string) {
      if (targetId === "cardName") {
        const v = $<HTMLInputElement>("#inpNome")!.value.trim();
        if (v.length < 3) {
          shakeInput($("#inpNome")!);
          return null;
        }
        return v.replace(/\s+/g, " ");
      }
      if (targetId === "cardCPF") {
        const v = inpCPF.value.replace(/\D/g, "");
        if (v.length !== 11) {
          shakeInput(inpCPF);
          return null;
        }
        return inpCPF.value;
      }
      if (targetId === "cardBirth") {
        const v = inpBirth.value;
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
          shakeInput(inpBirth);
          return null;
        }
        return v;
      }
      if (targetId === "photoSlot") return answers.photo || null;
      return null;
    }

    function flyText(sourceEl: Element, targetEl: Element, text: string) {
      return new Promise<void>((resolve) => {
        const sRect = sourceEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();
        const sStyle = getComputedStyle(sourceEl);
        const tStyle = getComputedStyle(targetEl);

        const ghost = document.createElement("span");
        ghost.className = "fly-ghost";
        ghost.textContent = text;
        ghost.style.left = sRect.left + "px";
        ghost.style.top = sRect.top + "px";
        ghost.style.fontSize = sStyle.fontSize;
        document.body.appendChild(ghost);

        const targetFont = parseFloat(tStyle.fontSize);
        const sourceFont = parseFloat(sStyle.fontSize);
        const scale = targetFont / sourceFont;
        const dx = tRect.left - sRect.left;
        const dy = tRect.top - sRect.top;

        const anim = ghost.animate(
          [
            { transform: "translate(0,0) scale(1)", opacity: 1 },
            {
              transform: `translate(${dx * 0.5}px, ${dy * 0.6}px) scale(${(1 + scale) / 2})`,
              opacity: 1,
              offset: 0.55,
            },
            { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0, offset: 1 },
          ],
          { duration: 620, easing: "cubic-bezier(.3,0,.2,1)" },
        );

        anim.onfinish = () => {
          ghost.remove();
          targetEl.textContent = text;
          targetEl.classList.remove("placeholder");
          targetEl.classList.add("filled-pop");
          setTimeout(() => targetEl.classList.remove("filled-pop"), 500);
          resolve();
        };
      });
    }

    function flyPhoto(sourceEl: HTMLImageElement, targetEl: HTMLElement) {
      return new Promise<void>((resolve) => {
        const sRect = sourceEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();

        const ghost = document.createElement("img");
        ghost.src = sourceEl.src || "";
        ghost.className = "fly-photo";
        ghost.style.left = sRect.left + "px";
        ghost.style.top = sRect.top + "px";
        ghost.style.width = sRect.width + "px";
        ghost.style.height = sRect.height + "px";
        document.body.appendChild(ghost);

        const dx = tRect.left - sRect.left;
        const dy = tRect.top - sRect.top;
        const scaleW = tRect.width / sRect.width;
        const scaleH = tRect.height / sRect.height;

        const anim = ghost.animate(
          [
            { transform: "translate(0,0) scale(1,1)", borderRadius: "10px", opacity: 1 },
            {
              transform: `translate(${dx}px, ${dy}px) scale(${scaleW}, ${scaleH})`,
              borderRadius: "50%",
              opacity: 1,
            },
          ],
          { duration: 650, easing: "cubic-bezier(.3,0,.2,1)" },
        );

        anim.onfinish = () => {
          ghost.remove();
          if (targetEl.dataset.imgSrc) {
            targetEl.style.backgroundImage = `url(${targetEl.dataset.imgSrc})`;
          }
          targetEl.classList.add("filled", "pop");
          targetEl.innerHTML = "";
          setTimeout(() => targetEl.classList.remove("pop"), 500);
          resolve();
        };
      });
    }

    // ---- foto: upload real ou fallback de iniciais ----
    const photoDrop = $("#photoDrop")!;
    const photoDropEmpty = $("#photoDropEmpty")!;
    const photoPreviewImg = $<HTMLImageElement>("#photoPreviewImg")!;
    const inpPhoto = $<HTMLInputElement>("#inpPhoto")!;

    photoDrop.addEventListener("click", () => inpPhoto.click());
    inpPhoto.addEventListener("change", () => {
      const file = inpPhoto.files && inpPhoto.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        photoPreviewImg.src = reader.result as string;
        photoPreviewImg.hidden = false;
        photoDropEmpty.setAttribute("hidden", "");
        answers.photo = { type: "image", src: reader.result as string, file };
      };
      reader.readAsDataURL(file);
    });

    $("#skipPhoto")!.addEventListener("click", () => {
      // #inpNome pode nem existir no DOM quando o nome já veio do convite
      const nome = answers.nome || $<HTMLInputElement>("#inpNome")?.value.trim() || "Aluno Magma";
      const initials = iniciaisDe(nome);
      answers.photo = { type: "initials", value: initials };
      photoDropEmpty.querySelector("span")!.textContent = `Usando as iniciais "${initials}"`;
      photoPreviewImg.hidden = true;
      handleNext();
    });

    // ---- envio real pra API (multipart) ----
    async function submitCarteirinha() {
      const fd = new FormData();
      fd.append("nome", answers.nome!);
      fd.append("cpf", answers.cpf!);
      const [dd, mm, yyyy] = answers.nascimento!.split("/");
      fd.append("data_nascimento", `${yyyy}-${mm}-${dd}`);
      if (answers.photo?.type === "image") {
        fd.append("foto", answers.photo.file);
      }
      const res = await fetch(`${API_URL}/carteirinha/convite/${token}/`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          detail = ((await res.json()) as { detail?: string }).detail ?? detail;
        } catch {
          /* corpo não-JSON */
        }
        throw new Error(detail);
      }
      return res.json() as Promise<ConviteValido>;
    }

    function showSubmitError(msg: string) {
      submitError.textContent = `Não foi possível enviar (${msg}). Tente novamente.`;
      submitError.removeAttribute("hidden");
    }

    async function handleNext() {
      const stepEl = steps[current];
      const targetId = stepEl.getAttribute("data-target")!;
      const value = validateStep(targetId);
      if (value === null) return;

      const targetEl = $("#" + targetId)!;

      sheetNext.style.pointerEvents = "none";

      if (targetId === "cardName") {
        answers.nome = value as string;
        await flyText($("#inpNome")!, targetEl, value as string);
      } else if (targetId === "cardCPF") {
        answers.cpf = value as string;
        await flyText(inpCPF, targetEl, value as string);
      } else if (targetId === "cardBirth") {
        answers.nascimento = value as string;
        await flyText(inpBirth, targetEl, value as string);
      } else if (targetId === "photoSlot") {
        if (answers.photo?.type === "image") {
          targetEl.dataset.imgSrc = answers.photo.src;
          await flyPhoto(photoPreviewImg, targetEl);
        } else {
          const initials = answers.photo?.type === "initials" ? answers.photo.value : iniciaisDe(answers.nome || "Aluno Magma");
          targetEl.classList.add("filled", "pop");
          targetEl.innerHTML = `<span class="initials">${initials}</span>`;
          await new Promise((r) => setTimeout(r, 400));
        }

        try {
          const dados = await submitCarteirinha();
          if (dados.valido && dados.token !== token) {
            // Veio de um link de turma: a carteirinha real nasceu num token
            // novo. Guarda a associação pra próxima visita a este mesmo
            // link já cair direto na carteirinha do aluno.
            localStorage.setItem(chaveLembranca(token), dados.token);
          }
          if (dados.valido && dados.aluno?.foto) {
            targetEl.dataset.imgSrc = dados.aluno.foto;
            targetEl.style.backgroundImage = `url(${dados.aluno.foto})`;
          }
          sheetNext.style.pointerEvents = "";
          closeSheet();
          finish((answers.nome || "").split(" ")[0] || "Aluno", false);
        } catch (err) {
          sheetNext.style.pointerEvents = "";
          showSubmitError(err instanceof Error ? err.message : "erro inesperado");
        }
        return;
      }

      sheetNext.style.pointerEvents = "";

      if (current < TOTAL - 1) {
        goToStep(current + 1);
      }
    }

    sheetNext.addEventListener("click", handleNext);
    $("#btnDownload")!.addEventListener("click", () => window.print());

    return () => {
      cardStage.removeEventListener("mousemove", onMouseMove);
      cardStage.removeEventListener("mouseleave", onMouseLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="ico-user" viewBox="0 0 24 24">
            <path
              d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M4 20.5c1.4-4 4.4-6 8-6s6.6 2 8 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </symbol>
          <symbol id="ico-arrow" viewBox="0 0 24 24">
            <path
              d="M5 12h13M13 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </symbol>
          <symbol id="ico-back" viewBox="0 0 24 24">
            <path
              d="M19 12H6M11 6l-6 6 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </symbol>
          <symbol id="ico-camera" viewBox="0 0 24 24">
            <path
              d="M4 8h3l1.6-2.4A2 2 0 0 1 10.3 4.6h3.4a2 2 0 0 1 1.7 1L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="13.5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
          </symbol>
          <symbol id="ico-check" viewBox="0 0 24 24">
            <path
              d="m5 12 5 5L20 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </symbol>
          <symbol id="ico-download" viewBox="0 0 24 24">
            <path
              d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </symbol>
        </defs>
      </svg>

      <div className="scene" id="scene">
        <div className="scene-glow"></div>

        <header className="topbar">
          <div className="brand">
            <svg width="24" height="27">
              <use href="#magma-sym" />
            </svg>
            <span>
              MAGMA <b>CURSOS</b>
            </span>
          </div>
        </header>

        <main className="stage">
          <div className="hero-copy" id="heroCopy">
            <p className="eyebrow reveal" id="eyebrow">
              Sua credencial Magma
            </p>
            <h1 className="reveal" data-delay="1" id="heroTitle">
              Essa carteirinha é sua.
            </h1>
            <p className="sub reveal" data-delay="2" id="heroSub">
              Reservamos sua vaga em <b id="subCurso">{convite.curso}</b>. Falta só
              confirmar quem você é.
            </p>
          </div>

          <div className="card-stage" id="cardStage">
            <div className="id-card" id="idCard">
              <div className="card-shine" id="cardShine"></div>
              <div className="card-hex-tex"></div>

              <div className="card-top">
                <div className="card-brand">
                  <svg width="20" height="22">
                    <use href="#magma-sym" />
                  </svg>
                  <span className="card-wordmark">MAGMA CURSOS</span>
                </div>
                <span className="card-tag">CARTEIRINHA&nbsp;DIGITAL</span>
              </div>

              <div className="card-body">
                {jaPreenchida && aluno?.foto ? (
                  <div
                    className="photo-slot filled"
                    id="photoSlot"
                    style={{ backgroundImage: `url(${aluno.foto})` }}
                  />
                ) : jaPreenchida ? (
                  <div className="photo-slot filled" id="photoSlot">
                    <span className="initials">{iniciaisDe(aluno!.nome)}</span>
                  </div>
                ) : (
                  <div className="photo-slot empty" id="photoSlot">
                    <svg width="30" height="30">
                      <use href="#ico-user" />
                    </svg>
                  </div>
                )}

                <div className="card-fields">
                  <div className="f-row main">
                    <span className="f-label">ALUNO(A)</span>
                    <span
                      className={`f-value${nomeConhecido ? "" : " placeholder"}`}
                      id="cardName"
                    >
                      {nomeConhecido || "preencha abaixo"}
                    </span>
                  </div>
                  <div className="f-row">
                    <span className="f-label">CURSO</span>
                    <span className="f-value" id="cardCourse">
                      {convite.curso}
                    </span>
                  </div>
                  <div className="f-grid">
                    <div className="f-cell">
                      <span className="f-label">CPF</span>
                      <span
                        className={`f-value small${jaPreenchida ? "" : " placeholder"}`}
                        id="cardCPF"
                      >
                        {jaPreenchida ? aluno!.cpf : "000.000.000-00"}
                      </span>
                    </div>
                    <div className="f-cell">
                      <span className="f-label">NASCIMENTO</span>
                      <span
                        className={`f-value small${jaPreenchida ? "" : " placeholder"}`}
                        id="cardBirth"
                      >
                        {jaPreenchida ? formatDateBr(aluno!.data_nascimento) : "00/00/0000"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-bottom">
                <div className="b-cell">
                  <span className="f-label">MATRÍCULA</span>
                  <span className="f-value mono" id="cardMatricula">
                    …
                  </span>
                </div>
                <div className="b-cell">
                  <span className="f-label">VÁLIDA ATÉ</span>
                  <span className="f-value mono" id="cardValidade">
                    …
                  </span>
                </div>
                <canvas className="qr-mock" id="qrMock" width={34} height={34} aria-hidden="true"></canvas>
              </div>
            </div>
          </div>

          {!jaPreenchida && (
            <button className="btn btn-gold btn-pulse reveal" data-delay="3" id="fillBtn">
              Preencher carteirinha
              <svg width="18" height="18">
                <use href="#ico-arrow" />
              </svg>
            </button>
          )}
        </main>
      </div>

      <div className="backdrop" id="backdrop"></div>
      <div className="sheet" id="sheet" role="dialog" aria-modal="true" aria-label="Preencher carteirinha">
        <div className="sheet-handle"></div>

        <div className="sheet-head">
          <button className="sheet-back" id="sheetBack" aria-label="Voltar">
            <svg width="18" height="18">
              <use href="#ico-back" />
            </svg>
          </button>
          <div className="sheet-progress" id="sheetProgress">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span className="dot" key={i}></span>
            ))}
          </div>
          <span className="sheet-count" id="sheetCount">
            1/{totalSteps}
          </span>
        </div>

        <div className="sheet-steps" id="sheetSteps">
          {!nomeConhecido && (
            <div className="step" data-target="cardName">
              <label htmlFor="inpNome">Como você se chama?</label>
              <input type="text" id="inpNome" placeholder="Nome completo" autoComplete="name" maxLength={60} />
            </div>
          )}

          <div className="step" data-target="cardCPF">
            <label htmlFor="inpCPF">Qual o seu CPF?</label>
            <input
              type="text"
              id="inpCPF"
              placeholder="000.000.000-00"
              inputMode="numeric"
              autoComplete="off"
              maxLength={14}
            />
          </div>

          <div className="step" data-target="cardBirth">
            <label htmlFor="inpBirth">Sua data de nascimento?</label>
            <input
              type="text"
              id="inpBirth"
              placeholder="DD/MM/AAAA"
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
            />
          </div>

          <div className="step step-photo" data-target="photoSlot">
            <label>Agora, sua foto para a carteirinha</label>
            <input type="file" accept="image/*" capture="user" id="inpPhoto" hidden />
            <div className="photo-drop" id="photoDrop">
              <img id="photoPreviewImg" hidden alt="" />
              <div className="photo-drop-empty" id="photoDropEmpty">
                <svg width="26" height="26">
                  <use href="#ico-camera" />
                </svg>
                <span>Toque para adicionar sua foto</span>
              </div>
            </div>
            <button className="skip-link" id="skipPhoto" type="button">
              Prefiro usar minhas iniciais por enquanto
            </button>
            <p className="submit-error" id="submitError" hidden></p>
          </div>
        </div>

        <div className="sheet-actions">
          <button className="sheet-next" id="sheetNext" aria-label="Confirmar e avançar">
            <svg width="22" height="22">
              <use href="#ico-arrow" />
            </svg>
          </button>
        </div>
      </div>

      <div className="success-panel" id="successPanel">
        <div className="success-inner">
          <span className="success-badge">
            <svg width="20" height="20">
              <use href="#ico-check" />
            </svg>
          </span>
          <h2>
            Carteirinha pronta, <span id="successName">—</span>!
          </h2>
          <p>Ela já está pronta e vinculada à sua matrícula.</p>

          <div className="success-card-slot" id="successCardSlot"></div>

          <button className="btn btn-gold btn-block" id="btnDownload">
            <svg width="18" height="18">
              <use href="#ico-download" />
            </svg>
            Baixar / Imprimir
          </button>
        </div>
      </div>

      <div className="confetti-layer" id="confettiLayer" aria-hidden="true"></div>
    </>
  );
}
