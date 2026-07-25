"use client";

import { useEffect } from "react";
import { waUrl } from "@/lib/whatsapp";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Preenche todos os `[data-wa]` da página com o link wa.me + UTM —
 * porta fiel do lp.js/script.js (href, target=_blank, rel=noopener).
 */
export default function WaLinks({ whats }: { whats: string }) {
  useEffect(() => {
    function onClick() {
      if (typeof window.fbq === "function") {
        window.fbq("track", "Contact");
      }
    }

    const links = document.querySelectorAll<HTMLAnchorElement>("[data-wa]");
    links.forEach((a) => {
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
      a.addEventListener("click", onClick);
    });

    return () => {
      links.forEach((a) => a.removeEventListener("click", onClick));
    };
  }, [whats]);

  return null;
}
