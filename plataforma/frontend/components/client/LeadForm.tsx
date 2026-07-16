"use client";

import { useState, type FormEvent } from "react";
import { API_URL } from "@/lib/api";
import { waUrl } from "@/lib/whatsapp";
import type { LeadPayload, LeadResposta } from "@/lib/types";

export interface OpcaoCurso {
  slug: string;
  label: string;
}

type Status = "idle" | "enviando" | "erro";

/**
 * Formulário de lead (client). Submit → POST /api/leads/ → abre a
 * `whatsapp_url` montada pelo backend (fonte única da mensagem).
 * Se a API falhar, abre o wa.me montado localmente (comportamento
 * do lp.js) — o lead do usuário nunca se perde.
 *
 * - LP de curso: sem `opcoesCurso` (slug fixo em `cursoSlug`).
 * - Home: com `opcoesCurso` (select "Curso de interesse").
 */
export default function LeadForm({
  cursoSlug,
  dataCurso,
  whats,
  opcoesCurso,
  opcoesQuando,
  ctaLabel,
  ctaBlock = true,
  revealDelay,
}: {
  /** slug fixo (LP de curso); ignorado quando há opcoesCurso */
  cursoSlug?: string;
  /** valor do atributo data-curso (fidelidade ao HTML da LP de curso) */
  dataCurso?: string;
  whats: string;
  opcoesCurso?: OpcaoCurso[];
  opcoesQuando: string[];
  ctaLabel: string;
  /** botão com .btn-block (LP) ou sem (home) */
  ctaBlock?: boolean;
  /** aplica .reveal/data-delay como no HTML da LP de curso */
  revealDelay?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    const nome = String(dados.get("nome") ?? "").trim();
    const quando = String(dados.get("quando") ?? "");
    const cursoSel = String(dados.get("curso") ?? "");

    const slug = opcoesCurso
      ? (opcoesCurso.find((o) => o.label === cursoSel)?.slug ?? "")
      : (cursoSlug ?? "");
    const rotuloCurso = opcoesCurso ? cursoSel : (dataCurso ?? "curso da Magma");

    // Mensagem local de fallback — mesma composição do lp.js/script.js
    const msgLocal = opcoesCurso
      ? `Olá! Me chamo ${nome} e quero receber o calendário e valores do curso: ${rotuloCurso}. Pretendo começar: ${quando}.`
      : `Olá! Me chamo ${nome} e quero garantir minha vaga no curso: ${rotuloCurso}. Pretendo começar: ${quando}.`;

    // Opção sem curso na API (ex.: in-company/Lei Lucas) → WhatsApp direto
    if (!slug) {
      window.open(waUrl(whats, msgLocal, window.location.search), "_blank", "noopener");
      return;
    }

    setStatus("enviando");
    const params = new URLSearchParams(window.location.search);
    const payload: LeadPayload = {
      nome,
      curso_slug: slug,
      quando_pretende: quando,
      utm_source: params.get("utm_source") ?? undefined,
      utm_campaign: params.get("utm_campaign") ?? undefined,
      pagina_origem: window.location.pathname,
    };

    try {
      const res = await fetch(`${API_URL}/leads/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as LeadResposta;
      window.open(data.whatsapp_url, "_blank", "noopener");
      setStatus("idle");
      form.reset();
    } catch {
      // API fora/erro: não perder o lead — abre o WhatsApp direto
      window.open(waUrl(whats, msgLocal, window.location.search), "_blank", "noopener");
      setStatus("erro");
    }
  }

  return (
    <form
      className={revealDelay ? "form-card reveal" : "form-card"}
      data-delay={revealDelay}
      id="leadForm"
      data-curso={dataCurso}
      onSubmit={onSubmit}
    >
      <label htmlFor="nome">Seu nome</label>
      <input
        type="text"
        id="nome"
        name="nome"
        placeholder="Como podemos te chamar?"
        required
      />
      {opcoesCurso && (
        <>
          <label htmlFor="curso">Curso de interesse</label>
          <select id="curso" name="curso" required defaultValue="">
            <option value="" disabled>
              Selecione o curso
            </option>
            {opcoesCurso.map((o) => (
              <option key={o.slug} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        </>
      )}
      <label htmlFor="quando">Quando pretende começar</label>
      <select id="quando" name="quando">
        {opcoesQuando.map((q) => (
          <option key={q}>{q}</option>
        ))}
      </select>
      <button
        type="submit"
        className={ctaBlock ? "btn btn-gold btn-block" : "btn btn-gold"}
        disabled={status === "enviando"}
      >
        {status === "enviando" ? "Enviando..." : ctaLabel}
      </button>
      {status === "erro" && (
        <small style={{ color: "var(--red)" }}>
          Nosso sistema está instável, mas abrimos seu WhatsApp com a mensagem
          pronta — é só enviar.
        </small>
      )}
      <small>
        Ao enviar, você abrirá uma conversa no WhatsApp da Magma com sua
        solicitação preenchida.
      </small>
    </form>
  );
}
