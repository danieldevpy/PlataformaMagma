import { describe, expect, it } from "vitest";

import { FALLBACK_CONFIG, FALLBACK_CURSO } from "./fallback";
import { cursoJsonLd, faqJsonLd, localBusinessJsonLd } from "./jsonld";
import type { SiteConfig } from "./types";

describe("cursoJsonLd", () => {
  const jsonld = cursoJsonLd(FALLBACK_CURSO, FALLBACK_CONFIG);

  it("nome inclui a carga horária", () => {
    expect(jsonld.name).toBe("Socorrista APH (120h)");
  });

  it("teaches lista os títulos das habilidades", () => {
    expect(jsonld.teaches).toEqual(
      FALLBACK_CURSO.habilidades.map((h) => h.titulo)
    );
  });

  it("courseWorkload usa duração ISO 8601 (PT<n>H)", () => {
    expect(jsonld.hasCourseInstance.courseWorkload).toBe("PT120H");
  });

  it("provider referencia o Instagram sem o @ (URL válida)", () => {
    expect(jsonld.provider.sameAs).toEqual(["https://www.instagram.com/magma_curso/"]);
  });
});

describe("faqJsonLd", () => {
  it("uma entrada Question/Answer por FAQ", () => {
    const jsonld = faqJsonLd(FALLBACK_CURSO);
    expect(jsonld.mainEntity).toHaveLength(FALLBACK_CURSO.faqs.length);
    expect(jsonld.mainEntity[0]).toEqual({
      "@type": "Question",
      name: FALLBACK_CURSO.faqs[0].pergunta,
      acceptedAnswer: { "@type": "Answer", text: FALLBACK_CURSO.faqs[0].resposta },
    });
  });
});

describe("localBusinessJsonLd", () => {
  it("telefone vem com + na frente do E.164", () => {
    const jsonld = localBusinessJsonLd(FALLBACK_CONFIG);
    expect(jsonld.telephone).toBe("+5521964946079");
  });

  it("endereço com travessão separa rua do resto (padrão 'Rua X — Bairro, Cidade/UF')", () => {
    const jsonld = localBusinessJsonLd(FALLBACK_CONFIG);
    expect(jsonld.address.streetAddress).toBe(
      "Rua Nossa Senhora de Fátima, 495"
    );
    expect(jsonld.address.addressLocality).toBe("Nilópolis");
  });

  it("endereço SEM travessão usa a string inteira (parse não quebra)", () => {
    const config: SiteConfig = { ...FALLBACK_CONFIG, endereco: "Rua Única, 10" };
    const jsonld = localBusinessJsonLd(config);
    expect(jsonld.address.streetAddress).toBe("Rua Única, 10");
  });
});
