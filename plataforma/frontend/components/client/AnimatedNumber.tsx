"use client";

import { useEffect, useRef } from "react";
import { isNoAnim } from "@/lib/noanim";

/**
 * Contador animado — porta fiel do lp.js: começa em "0" (como no HTML
 * original), anima em 1400ms com ease-out cúbico quando 60% visível.
 * Mantém data-count/data-suffix no DOM.
 */
export default function AnimatedNumber({
  value,
  suffix = "",
}: {
  value: number | string;
  suffix?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const alvo = parseFloat(String(value));
    const dec = (String(value).split(".")[1] || "").length;
    const final = alvo.toFixed(dec) + suffix;

    if (isNoAnim()) {
      el.textContent = final;
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          let t0: number | null = null;
          const step = (t: number) => {
            if (t0 === null) t0 = t;
            const p = Math.min((t - t0) / 1400, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = (alvo * eased).toFixed(dec) + suffix;
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, suffix]);

  return (
    <b ref={ref} data-count={value} data-suffix={suffix || undefined}>
      0
    </b>
  );
}
