"use client";

import { useEffect, useRef } from "react";
import { useReveal } from "@/hooks/useReveal";
import type { CarteirinhaAluno } from "@/lib/types";
import "@/styles/carteirinha.css";

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

const STATUS_LABEL: Record<string, string> = {
  convidado: "Convidado",
  ativa: "Ativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

/**
 * Card digital do aluno (spec 014) — `Aluno.token`, sempre "preenchido"
 * (a experiência de preencher é só em `/carteirinha/nova/{token_cadastro}`,
 * ver CarteirinhaCadastro). Porta o visual da carteirinha do protótipo
 * original, sem o formulário/sheet — aqui só se revela o cartão pronto.
 */
export default function CarteirinhaCard({ aluno }: { aluno: CarteirinhaAluno }) {
  useReveal();
  const jaRodou = useRef(false);

  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;

    const $ = <T extends Element = HTMLElement>(sel: string) =>
      document.querySelector<T>(sel);

    const idCard = $("#idCard")!;
    const cardStage = $("#cardStage")!;
    idCard.classList.add("settling");

    function typeInto(el: Element, text: string, speed = 45) {
      el.textContent = "";
      let i = 0;
      const t = setInterval(() => {
        el.textContent += text[i];
        i++;
        if (i >= text.length) clearInterval(t);
      }, speed);
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

    setTimeout(() => {
      typeInto($("#cardMatricula")!, aluno.codigo_carteirinha, 30);
      typeInto($("#cardValidade")!, formatDateBr(aluno.validade_carteirinha), 35);
      drawQrMock(aluno.codigo_carteirinha);
    }, 300);

    setTimeout(() => {
      $("#successCardSlot")!.appendChild(cardStage);
      idCard.classList.add("sweep");
      $("#successName")!.textContent = aluno.nome.split(" ")[0] || "Aluno";
      $("#successPanel")!.classList.add("show");
    }, 420);

    return () => {
      cardStage.removeEventListener("mousemove", onMouseMove);
      cardStage.removeEventListener("mouseleave", onMouseLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aluno.token]);

  const cursoPrincipal = aluno.matriculas[0];

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

      <div className="scene" id="scene" style={{ display: "none" }}>
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
              {aluno.foto ? (
                <div
                  className="photo-slot filled"
                  style={{ backgroundImage: `url(${aluno.foto})` }}
                />
              ) : (
                <div className="photo-slot filled">
                  <span className="initials">{iniciaisDe(aluno.nome)}</span>
                </div>
              )}

              <div className="card-fields">
                <div className="f-row main">
                  <span className="f-label">ALUNO(A)</span>
                  <span className="f-value">{aluno.nome}</span>
                </div>
                <div className="f-row">
                  <span className="f-label">CURSO</span>
                  <span className="f-value">
                    {cursoPrincipal ? cursoPrincipal.curso : "—"}
                  </span>
                </div>
                <div className="f-grid">
                  <div className="f-cell">
                    <span className="f-label">CPF</span>
                    <span className="f-value small">{aluno.cpf}</span>
                  </div>
                  <div className="f-cell">
                    <span className="f-label">NASCIMENTO</span>
                    <span className="f-value small">
                      {formatDateBr(aluno.data_nascimento)}
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
      </div>

      <div className="success-panel" id="successPanel">
        <div className="success-inner">
          <span className="success-badge">
            <svg width="20" height="20">
              <use href="#ico-check" />
            </svg>
          </span>
          <h2>
            Sua carteirinha, <span id="successName">—</span>
          </h2>
          <p>Ela já está pronta e vinculada à sua matrícula.</p>

          <div className="success-card-slot" id="successCardSlot"></div>

          {aluno.matriculas.length > 1 && (
            <ul
              style={{
                listStyle: "none",
                textAlign: "left",
                margin: "0 0 20px",
                padding: 0,
                display: "grid",
                gap: 8,
              }}
            >
              {aluno.matriculas.map((m, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    fontSize: ".86rem",
                    color: "var(--muted)",
                    borderTop: "1px solid var(--sand)",
                    paddingTop: 8,
                  }}
                >
                  <span>
                    {m.curso} <b style={{ color: "var(--ink)" }}>· {m.turma_codigo}</b>
                  </span>
                  <span>{STATUS_LABEL[m.status] ?? m.status}</span>
                </li>
              ))}
            </ul>
          )}

          <button className="btn btn-gold btn-block" id="btnDownload" onClick={() => window.print()}>
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
