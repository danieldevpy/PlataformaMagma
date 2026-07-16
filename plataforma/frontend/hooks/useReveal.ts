"use client";

import { useEffect } from "react";
import { aplicarEstiloNoAnim, isNoAnim } from "@/lib/noanim";

/**
 * Reveal on scroll — porta fiel do lp.js: IntersectionObserver
 * (threshold .14) adicionando `.in` a cada `.reveal` uma única vez.
 * `data-delay` continua tratado pelo CSS (transition-delay do lp.css).
 * Com ?noanim / NEXT_PUBLIC_NOANIM tudo aparece imediatamente.
 */
export function useReveal(): void {
  useEffect(() => {
    const reveals = Array.from(
      document.querySelectorAll<HTMLElement>(".reveal"),
    );

    if (isNoAnim()) {
      aplicarEstiloNoAnim();
      reveals.forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.14 },
    );
    reveals.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
