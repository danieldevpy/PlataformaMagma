"use client";

import { useEffect, useState } from "react";

interface Restante {
  d: string;
  h: string;
  m: string;
  s: string;
}

const ZERADO: Restante = { d: "00", h: "00", m: "00", s: "00" };

function pad(n: number): string {
  return String(Math.floor(n)).padStart(2, "0");
}

/**
 * Countdown do card da turma — porta fiel do lp.js (tick por segundo,
 * trava em 00 ao expirar). SSR renderiza "00" (igual ao HTML original)
 * e o tick começa na hidratação — sem mismatch. Não renderiza nada
 * quando `ate` é null.
 */
export default function Countdown({
  ate,
  rotulo,
}: {
  ate: string | null;
  rotulo: string;
}) {
  const [t, setT] = useState<Restante>(ZERADO);

  useEffect(() => {
    if (!ate) return;
    const fim = new Date(ate).getTime();
    const tick = () => {
      const dif = Math.max(0, fim - Date.now());
      setT({
        d: pad(dif / 864e5),
        h: pad((dif % 864e5) / 36e5),
        m: pad((dif % 36e5) / 6e4),
        s: pad((dif % 6e4) / 1e3),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [ate]);

  if (!ate) return null;

  return (
    <>
      <p className="count-label">{rotulo}</p>
      <div className="count" data-deadline={ate}>
        <div>
          <b data-t="d">{t.d}</b>
          <span>dias</span>
        </div>
        <div>
          <b data-t="h">{t.h}</b>
          <span>horas</span>
        </div>
        <div>
          <b data-t="m">{t.m}</b>
          <span>min</span>
        </div>
        <div>
          <b data-t="s">{t.s}</b>
          <span>seg</span>
        </div>
      </div>
    </>
  );
}
