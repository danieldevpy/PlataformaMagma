/**
 * Links de WhatsApp com origem (UTM) — porta fiel do lp.js/script.js.
 * Usado pelos client components (WaLinks, LeadForm) como fallback local;
 * quando o lead passa pela API, a URL vem pronta do backend (fonte única).
 */

/** `?utm_source=instagram&utm_campaign=bio` → " [origem: instagram/bio]". */
export function origemUtm(search: string): string {
  const p = new URLSearchParams(search);
  const src = p.get("utm_source") || "";
  const camp = p.get("utm_campaign") || "";
  if (src || camp) return ` [origem: ${[src, camp].filter(Boolean).join("/")}]`;
  return " [origem: site]";
}

export function waUrl(whats: string, msg: string, search = ""): string {
  return `https://wa.me/${whats}?text=${encodeURIComponent(msg + origemUtm(search))}`;
}
