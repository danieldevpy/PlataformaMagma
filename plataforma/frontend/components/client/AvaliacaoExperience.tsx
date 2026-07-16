"use client";

import { useEffect, useRef } from "react";
import { useReveal } from "@/hooks/useReveal";
import { API_URL } from "@/lib/api";
import type { AvaliacaoConvitePayload, ConviteAvaliacao } from "@/lib/types";
import "@/styles/avaliacao.css";

type ConviteValido = Extract<ConviteAvaliacao, { valido: true }>;

// Convites de turma (compartilhados) não fecham sozinhos no backend depois
// de 1 uso — então "lembramos" localmente que este device já avaliou, pra
// não empurrar o convite de novo numa revisita.
function chaveJaAvaliado(token: string): string {
  return `magma:avaliacao:${token}`;
}

/**
 * Experiência completa de avaliação pós-curso — porta fiel de
 * avaliacao/{index.html,styles.css,script.js} (ver esse diretório para o
 * protótipo original). Mantém a mesma abordagem imperativa (DOM direto,
 * não estado do React) do protótipo — como já faz CarteirinhaExperience e
 * o hook useReveal() do resto do site — trocando apenas: fotos e nome vêm
 * do convite real (não de query string), e o envio vai pra API de verdade.
 */
export default function AvaliacaoExperience({
  token,
  convite,
}: {
  token: string;
  convite: ConviteValido;
}) {
  useReveal();
  const jaRodou = useRef(false);

  useEffect(() => {
    // guarda contra o double-invoke do StrictMode em dev: sem isso os
    // listeners abaixo seriam anexados duas vezes (cliques duplicados).
    if (jaRodou.current) return;
    jaRodou.current = true;

    const $ = <T extends Element = HTMLElement>(sel: string, ctx: ParentNode = document) =>
      ctx.querySelector<T>(sel);
    const $$ = <T extends Element = HTMLElement>(sel: string, ctx: ParentNode = document) =>
      Array.from(ctx.querySelectorAll<T>(sel));

    // como requestAnimationFrame pode ser adiado indefinidamente (aba em
    // segundo plano, guia sem foco), garante que a troca de classe que
    // dispara a transição CSS sempre aconteça — com o timeout como reforço.
    function nextPaint(cb: () => void) {
      let done = false;
      const run = () => {
        if (done) return;
        done = true;
        cb();
      };
      requestAnimationFrame(run);
      setTimeout(run, 50);
    }

    // computador: o convite de avaliação complementa o layout, abaixo do
    // carrossel. Celular: aparece como um "modal" flutuante com backdrop.
    const DESKTOP_QUERY = window.matchMedia("(min-width: 768px)");
    const cleanups: Array<() => void> = [];

    // ---------------------------------------------------------------
    // carrossel — sempre visível, parte do layout. Autoplay de ~3
    // fotos, depois convida a continuar sem travar a navegação manual
    // (swipe/setas). Só monta se o curso tiver fotos cadastradas.
    // ---------------------------------------------------------------
    const track = $<HTMLUListElement>("#track");
    const total = track ? $$(".slide", track).length : 0;

    if (track && total > 0) {
      const dots = $$<HTMLButtonElement>("#dots button");
      const prevBtn = $<HTMLButtonElement>("#prevBtn")!;
      const nextBtn = $<HTMLButtonElement>("#nextBtn")!;
      const caption = $("#caption")!;
      const viewport = $(".carousel-viewport")!;
      const captions = convite.fotos.map((f) => f.legenda);

      const AUTOPLAY_INTERVAL = 2600;
      const AUTOPLAY_STEPS = 3; // ~3 fotos mostradas automaticamente
      let index = 0;
      let autoplayTimer: ReturnType<typeof setInterval> | null = null;
      let autoplayTicks = 0;

      function renderSlide() {
        track!.style.transform = `translateX(-${index * 100}%)`;
        dots.forEach((d, i) => d.setAttribute("aria-selected", String(i === index)));
        caption.textContent = captions[index] || "";
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === total - 1;
        if (index === total - 1) nextBtn.classList.remove("attn"); // não há mais para onde chamar atenção
      }

      function goTo(i: number) {
        index = Math.max(0, Math.min(total - 1, i));
        renderSlide();
      }

      function stopAutoplay() {
        if (autoplayTimer) {
          clearInterval(autoplayTimer);
          autoplayTimer = null;
        }
      }

      function startAutoplay() {
        autoplayTimer = setInterval(() => {
          autoplayTicks++;
          goTo(index + 1 >= total ? total - 1 : index + 1);
          if (autoplayTicks >= AUTOPLAY_STEPS - 1 || index === total - 1) {
            stopAutoplay();
            if (index < total - 1) nextBtn.classList.add("attn"); // "tem mais fotos" — chama atenção sem bloquear
          }
        }, AUTOPLAY_INTERVAL);
      }

      const onPrevClick = () => {
        stopAutoplay();
        goTo(index - 1);
      };
      const onNextClick = () => {
        stopAutoplay();
        nextBtn.classList.remove("attn");
        goTo(index + 1);
      };
      prevBtn.addEventListener("click", onPrevClick);
      nextBtn.addEventListener("click", onNextClick);

      const dotHandlers = dots.map((d, i) => {
        const handler = () => {
          stopAutoplay();
          goTo(i);
        };
        d.addEventListener("click", handler);
        return handler;
      });

      /* swipe no mobile */
      let touchStartX = 0;
      let touchStartY = 0;
      let dragging = false;
      const onTouchStart = (e: TouchEvent) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        dragging = true;
      };
      const onTouchMove = (e: TouchEvent) => {
        if (!dragging) return;
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        if (Math.abs(dx) > Math.abs(dy)) e.preventDefault(); // gesto horizontal: não deixa a página rolar
      };
      const onTouchEnd = (e: TouchEvent) => {
        if (!dragging) return;
        dragging = false;
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) < 40) return;
        stopAutoplay();
        goTo(dx < 0 ? index + 1 : index - 1);
      };
      viewport.addEventListener("touchstart", onTouchStart, { passive: true });
      viewport.addEventListener("touchmove", onTouchMove, { passive: false });
      viewport.addEventListener("touchend", onTouchEnd);

      startAutoplay();
      renderSlide();

      cleanups.push(() => {
        stopAutoplay();
        prevBtn.removeEventListener("click", onPrevClick);
        nextBtn.removeEventListener("click", onNextClick);
        dots.forEach((d, i) => d.removeEventListener("click", dotHandlers[i]));
        viewport.removeEventListener("touchstart", onTouchStart);
        viewport.removeEventListener("touchmove", onTouchMove as EventListener);
        viewport.removeEventListener("touchend", onTouchEnd);
      });
    }

    // ---------------------------------------------------------------
    // convite de avaliação — dois estágios:
    // "peek": depois de ~3s, só as estrelas aparecem (barra no rodapé
    // no celular, bloco compacto abaixo do carrossel no computador) —
    // discreto, sem backdrop, não atrapalha quem ainda quer ver fotos.
    // "aberto": ao tocar numa estrela, revela o resto (agradecimento +
    // comentário + botão) — no celular a barra vira modal de verdade;
    // no computador o bloco expande e a página rola até ele.
    // ---------------------------------------------------------------
    const backdrop = $("#backdrop")!;
    const rateCard = $("#rateCard")!;
    const closeBtn = $<HTMLButtonElement>("#closeBtn")!;
    const ratePanel = $("#ratePanel")!;
    const starsField = $("#stars")!;
    const rateExpand = $("#rateExpand")!;
    const thanksMsg = $("#thanksMsg")!;
    // só existe no DOM em convite de turma (nome_aluno vazio — ver JSX)
    const nomeInput = $<HTMLInputElement>("#nomeAluno");
    const commentInput = $<HTMLTextAreaElement>("#comment")!;
    const cargoInput = $<HTMLInputElement>("#cargoAtual")!;
    const submitBtn = $<HTMLButtonElement>("#submitBtn")!;
    const btnLabel = $(".btn-label", submitBtn)!;
    const btnSpinner = $(".btn-spinner", submitBtn)!;
    const submitError = $("#submitError")!;
    const successView = $("#successView")!;

    let lastFocused: HTMLElement | null = null;
    let opened = false;
    let notaSelecionada = 0;

    // estágio 1: só mostra a barra/bloco com as estrelas — sem backdrop,
    // sem travar scroll, sem role de dialog (não é modal ainda).
    function revealAvaliacaoPeek() {
      rateCard.hidden = false;
      nextPaint(() => rateCard.classList.add("show"));
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeAvaliacao();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = $$<HTMLElement>(
        'button:not([disabled]), [href], input, textarea, select',
        rateCard,
      ).filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    // estágio 2: disparado ao tocar numa estrela. No celular a barra vira
    // modal de verdade (backdrop, scroll travado, foco preso). No
    // computador só rola a página até o bloco expandido ficar visível.
    function openFullReview() {
      if (opened) return;
      opened = true;
      const mobile = !DESKTOP_QUERY.matches;

      if (mobile) {
        lastFocused = document.activeElement as HTMLElement | null;
        rateCard.classList.add("opened");
        rateCard.setAttribute("role", "dialog");
        rateCard.setAttribute("aria-modal", "true");
        document.body.classList.add("modal-open");
        document.addEventListener("keydown", onKeydown);
        nextPaint(() => backdrop.classList.add("show"));
        setTimeout(() => closeBtn.focus(), 500);
      } else {
        // espera a expansão (grid-template-rows) começar antes de calcular
        // a posição final, senão o scroll para antes do card crescer todo.
        setTimeout(() => {
          rateCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      }
    }

    function closeAvaliacao() {
      backdrop.classList.remove("show");
      rateCard.classList.remove("show", "opened");
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", onKeydown);
      setTimeout(() => {
        rateCard.hidden = true;
      }, 650);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    const onStarsChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.name !== "nota") return;
      const nota = Number(target.value);
      notaSelecionada = nota;

      starsField.classList.remove("pop");
      void starsField.offsetWidth; // reinicia a animação mesmo se o aluno trocar de nota
      starsField.classList.add("pop");

      thanksMsg.textContent =
        nota >= 4
          ? "Ficamos muito felizes que você tenha participado deste curso ❤️"
          : "Sua opinião é muito importante para continuarmos melhorando.";

      rateExpand.classList.add("open");
      openFullReview();
    };
    starsField.addEventListener("change", onStarsChange);

    async function enviarAvaliacao(payload: AvaliacaoConvitePayload) {
      const res = await fetch(`${API_URL}/avaliacoes/convite/${token}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          detail = ((await res.json()) as { detail?: string }).detail ?? detail;
        } catch {
          /* corpo não-JSON — mantém o HTTP status */
        }
        throw new Error(detail);
      }
    }

    const onSubmitClick = async () => {
      if (!notaSelecionada) return;

      const nome = convite.nome_aluno || nomeInput?.value.trim() || "";
      if (!nome) {
        submitError.textContent = "Conte seu nome antes de enviar.";
        submitError.hidden = false;
        nomeInput?.focus();
        return;
      }

      const comentario = commentInput.value.trim();
      if (!comentario) {
        submitError.textContent = "Conte um pouco sobre sua experiência antes de enviar.";
        submitError.hidden = false;
        commentInput.focus();
        return;
      }

      submitError.hidden = true;
      submitBtn.disabled = true;
      btnLabel.hidden = true;
      btnSpinner.hidden = false;

      try {
        await enviarAvaliacao({
          nome,
          estrelas: notaSelecionada,
          comentario,
          cargo_atual: cargoInput.value.trim(),
        });
        localStorage.setItem(chaveJaAvaliado(token), "1");
        ratePanel.hidden = true;
        successView.hidden = false;
        successView.classList.add("in");
        setTimeout(closeAvaliacao, 2000);
      } catch (err) {
        submitBtn.disabled = false;
        btnLabel.hidden = false;
        btnSpinner.hidden = true;
        submitError.textContent = `Não foi possível enviar (${
          err instanceof Error ? err.message : "erro inesperado"
        }). Tente novamente.`;
        submitError.hidden = false;
      }
    };
    submitBtn.addEventListener("click", onSubmitClick);
    closeBtn.addEventListener("click", closeAvaliacao);

    // convite de turma reutilizável: se este device já avaliou por aqui,
    // não insiste — só deixa o carrossel de fotos disponível.
    const jaAvaliou = localStorage.getItem(chaveJaAvaliado(token)) === "1";
    const rateRevealTimer = jaAvaliou ? undefined : setTimeout(revealAvaliacaoPeek, 3000);

    cleanups.push(() => {
      clearTimeout(rateRevealTimer);
      starsField.removeEventListener("change", onStarsChange);
      submitBtn.removeEventListener("click", onSubmitClick);
      closeBtn.removeEventListener("click", closeAvaliacao);
      document.removeEventListener("keydown", onKeydown);
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [token, convite]);

  const primeiroNome = (convite.nome_aluno.split(" ")[0] || "").trim();

  return (
    <>
      {/* sprite de ícones locais — magma-sym já vem global via
          components/MagmaSymbol.tsx no layout, não duplicar aqui. */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="ico-chevron" viewBox="0 0 24 24">
            <path
              d="M9 5l7 7-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </symbol>
          <symbol id="ico-close" viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </symbol>
          <symbol id="ico-star" viewBox="0 0 24 24">
            <path
              d="M12 2.9l2.66 5.6 6.05.72-4.5 4.24 1.18 6.04L12 16.62l-5.39 2.88 1.18-6.04-4.5-4.24 6.05-.72L12 2.9z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </symbol>
          <symbol id="ico-check" viewBox="0 0 24 24">
            <path
              d="m5 12 5 5L20 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </symbol>
        </defs>
      </svg>

      <div className="page-bg magma-hex-texture" id="pageBg">
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
          <div className="hero-copy">
            <p className="eyebrow reveal" id="eyebrow">
              Turma formada
            </p>
            <h1 className="reveal" data-delay="1" id="heroTitle">
              {primeiroNome ? `Parabéns pela formatura, ${primeiroNome}! 🎓` : "Parabéns pela formatura! 🎓"}
            </h1>
            <p className="sub reveal" data-delay="2" id="heroSub">
              Você concluiu <b id="subCurso">{convite.curso}</b>. Foi um orgulho ter você com a
              gente — relembre alguns momentos da turma.
            </p>
          </div>

          {convite.fotos.length > 0 && (
            <section className="carousel-card reveal" data-delay="3">
              <section className="carousel" id="carousel" aria-roledescription="carrossel" aria-label="Fotos da turma">
                <div className="carousel-viewport">
                  <ul className="carousel-track" id="track">
                    {convite.fotos.map((foto, i) => (
                      <li className="slide" key={foto.imagem}>
                        <img src={foto.imagem} alt={foto.legenda || `Foto ${i + 1} da turma`} />
                      </li>
                    ))}
                  </ul>
                  <div className="carousel-fade" />
                  <p className="carousel-caption" id="caption" />
                </div>

                <button className="nav-btn prev" id="prevBtn" type="button" aria-label="Foto anterior" disabled>
                  <svg width="20" height="20" style={{ transform: "scaleX(-1)" }}>
                    <use href="#ico-chevron" />
                  </svg>
                </button>
                <button className="nav-btn next" id="nextBtn" type="button" aria-label="Próxima foto">
                  <svg width="20" height="20">
                    <use href="#ico-chevron" />
                  </svg>
                </button>

                <div className="dots" id="dots" role="tablist" aria-label="Selecionar foto">
                  {convite.fotos.map((foto, i) => (
                    <button key={foto.imagem} type="button" role="tab" aria-label={`Foto ${i + 1}`} />
                  ))}
                </div>
              </section>
            </section>
          )}

          {/* convite para avaliação: some depois de ~3s. No celular vira um
              "modal" flutuante (backdrop escurece o resto). No computador surge
              aqui embaixo, como parte natural do layout — sem sobrepor nada. */}
          <div className="rate-backdrop" id="backdrop" />
          <section className="rate-card" id="rateCard" aria-label="Avalie sua experiência" hidden>
            <button className="modal-close" id="closeBtn" type="button" aria-label="Fechar">
              <svg width="15" height="15">
                <use href="#ico-close" />
              </svg>
            </button>

            <div className="rate-panel" id="ratePanel">
              <p className="rate-title" id="rateTitle">
                O que você achou da experiência?
              </p>

              <fieldset className="stars" id="stars">
                <legend className="sr-only">Dê sua nota de 1 a 5 estrelas</legend>
                <input type="radio" name="nota" id="nota5" value="5" aria-label="5 estrelas — Excelente" />
                <label htmlFor="nota5">
                  <svg width="34" height="34">
                    <use href="#ico-star" />
                  </svg>
                </label>
                <input type="radio" name="nota" id="nota4" value="4" aria-label="4 estrelas" />
                <label htmlFor="nota4">
                  <svg width="34" height="34">
                    <use href="#ico-star" />
                  </svg>
                </label>
                <input type="radio" name="nota" id="nota3" value="3" aria-label="3 estrelas" />
                <label htmlFor="nota3">
                  <svg width="34" height="34">
                    <use href="#ico-star" />
                  </svg>
                </label>
                <input type="radio" name="nota" id="nota2" value="2" aria-label="2 estrelas" />
                <label htmlFor="nota2">
                  <svg width="34" height="34">
                    <use href="#ico-star" />
                  </svg>
                </label>
                <input type="radio" name="nota" id="nota1" value="1" aria-label="1 estrela" />
                <label htmlFor="nota1">
                  <svg width="34" height="34">
                    <use href="#ico-star" />
                  </svg>
                </label>
              </fieldset>

              <div className="rate-expand" id="rateExpand">
                <div className="rate-expand-inner">
                  <p className="thanks" id="thanksMsg">
                    Ficamos muito felizes que você tenha participado deste curso ❤️
                  </p>

                  {/* convite de turma (compartilhado): não há nome pré-vinculado,
                      o próprio aluno se identifica antes de enviar */}
                  {!convite.nome_aluno && (
                    <>
                      <label htmlFor="nomeAluno" className="comment-label">
                        Seu nome
                      </label>
                      <input
                        type="text"
                        id="nomeAluno"
                        maxLength={120}
                        placeholder="Como você se chama?"
                        autoComplete="name"
                      />
                    </>
                  )}

                  <label htmlFor="comment" className="comment-label">
                    Conte um pouco sobre sua experiência
                  </label>
                  <textarea
                    id="comment"
                    maxLength={600}
                    rows={3}
                    placeholder="Conte um pouco sobre sua experiência..."
                  ></textarea>

                  <label htmlFor="cargoAtual" className="comment-label">
                    Onde você trabalha hoje? (opcional)
                  </label>
                  <input
                    type="text"
                    id="cargoAtual"
                    maxLength={120}
                    placeholder="Ex.: Socorrista em eventos"
                  />

                  <p className="submit-error" id="submitError" hidden></p>

                  <button className="btn btn-gold btn-block" id="submitBtn" type="button">
                    <span className="btn-label">Avaliar</span>
                    <span className="btn-spinner" hidden aria-hidden="true"></span>
                  </button>
                </div>
              </div>
            </div>

            <div className="success-view" id="successView" hidden aria-live="polite">
              <span className="success-badge">
                <svg width="22" height="22">
                  <use href="#ico-check" />
                </svg>
              </span>
              <h2>Obrigado pela sua avaliação!</h2>
              <p>Sua opinião é muito importante para continuarmos melhorando.</p>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
