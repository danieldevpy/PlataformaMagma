/**
 * Suporte a `?noanim` (querystring) e NEXT_PUBLIC_NOANIM (env) —
 * desliga animações para testes visuais/screenshots, como no lp.js.
 * Uso apenas em client components (lê window.location).
 */

export function isNoAnim(): boolean {
  const env = process.env.NEXT_PUBLIC_NOANIM;
  if (env === "1" || env === "true") return true;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("noanim");
}

/** Injeta o mesmo <style> que o lp.js injeta com ?noanim (uma vez). */
export function aplicarEstiloNoAnim(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("noanim-style")) return;
  const st = document.createElement("style");
  st.id = "noanim-style";
  st.textContent =
    "*,*::before,*::after{animation:none!important;transition:none!important}.reveal{opacity:1!important;transform:none!important}";
  document.head.appendChild(st);
}
