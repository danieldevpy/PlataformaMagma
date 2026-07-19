import { describe, expect, it } from "vitest";

import { origemUtm, waUrl } from "./whatsapp";

describe("origemUtm", () => {
  it("sem query string cai no fallback 'site'", () => {
    expect(origemUtm("")).toBe(" [origem: site]");
  });

  it("source + campaign juntos, separados por /", () => {
    expect(origemUtm("?utm_source=instagram&utm_campaign=bio")).toBe(
      " [origem: instagram/bio]"
    );
  });

  it("só source presente", () => {
    expect(origemUtm("?utm_source=google")).toBe(" [origem: google]");
  });

  it("só campaign presente", () => {
    expect(origemUtm("?utm_campaign=promo-marco")).toBe(" [origem: promo-marco]");
  });
});

describe("waUrl", () => {
  it("monta a URL do wa.me com a mensagem + origem codificadas", () => {
    const url = waUrl("5521999999999", "Olá! Teste", "");
    expect(url).toBe(
      "https://wa.me/5521999999999?text=" +
        encodeURIComponent("Olá! Teste [origem: site]")
    );
  });

  it("propaga utm da query string recebida", () => {
    const url = waUrl("5521999999999", "Oi", "?utm_source=facebook");
    expect(url).toContain(encodeURIComponent("[origem: facebook]"));
  });
});
