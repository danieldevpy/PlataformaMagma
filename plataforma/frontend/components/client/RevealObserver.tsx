"use client";

import { useReveal } from "@/hooks/useReveal";

/** Monta o comportamento de reveal na página (não renderiza nada). */
export default function RevealObserver() {
  useReveal();
  return null;
}
