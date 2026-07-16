"use client";

import { useEffect, useRef } from "react";
import type { CursoCompleto } from "@/lib/types";

/**
 * CTA fixo mobile — porta fiel do lp.js: observa o `.hero` e alterna
 * a classe `show` quando ele sai da tela.
 */
export default function StickyCtaBar({ curso }: { curso: CursoCompleto }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const turma = curso.turma_destaque;

  useEffect(() => {
    const el = ref.current;
    const hero = document.querySelector(".hero");
    if (!el || !hero) return;
    const io = new IntersectionObserver(
      (entries) => {
        el.classList.toggle("show", !entries[0].isIntersecting);
      },
      { threshold: 0 },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <div className="sticky-cta" ref={ref}>
      <b>
        {curso.nome} · {curso.carga_horaria}h
        <span>
          {turma ? (
            <>
              Turma <span>{turma.codigo}</span> — vagas limitadas
            </>
          ) : (
            <>Próxima turma — vagas limitadas</>
          )}
        </span>
      </b>
      <a
        className="btn btn-gold"
        data-wa=""
        data-msg={`Olá! Quero garantir minha vaga na próxima turma de ${curso.nome} (${curso.carga_horaria}h).`}
        href="#"
      >
        Garantir vaga
      </a>
    </div>
  );
}
