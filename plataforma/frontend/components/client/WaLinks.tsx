"use client";

import { useEffect } from "react";
import { waUrl } from "@/lib/whatsapp";

/**
 * Preenche todos os `[data-wa]` da página com o link wa.me + UTM —
 * porta fiel do lp.js/script.js (href, target=_blank, rel=noopener).
 */
export default function WaLinks({ whats }: { whats: string }) {
  useEffect(() => {
    document.querySelectorAll<HTMLAnchorElement>("[data-wa]").forEach((a) => {
      a.setAttribute(
        "href",
        waUrl(
          whats,
          a.getAttribute("data-msg") || "Olá! Vim pelo site da Magma.",
          window.location.search,
        ),
      );
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    });
  }, [whats]);

  return null;
}
