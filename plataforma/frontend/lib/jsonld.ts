import type { CursoCompleto, SiteConfig } from "./types";

/**
 * JSON-LD (Course, FAQPage, LocalBusiness) montado a partir do payload —
 * mesma estrutura do JSON-LD que já existe no HTML da LP atual.
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://magmacursosltda.com.br"
).replace(/\/$/, "");

function instagramUrl(config: SiteConfig): string {
  return `https://www.instagram.com/${config.instagram.replace(/^@/, "")}/`;
}

function postalAddress(config: SiteConfig) {
  // config.endereco: "Rua Nossa Senhora de Fátima, 495 — Olinda, Nilópolis/RJ"
  const [rua] = config.endereco.split(/\s+—\s+/);
  return {
    "@type": "PostalAddress",
    streetAddress: rua ?? config.endereco,
    addressLocality: "Nilópolis",
    addressRegion: "RJ",
    postalCode: "26545-080",
    addressCountry: "BR",
  };
}

function place(config: SiteConfig) {
  return {
    "@type": "Place",
    name: "Magma Cursos — Unidade Nilópolis",
    address: postalAddress(config),
  };
}

export function cursoJsonLd(curso: CursoCompleto, config: SiteConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `${curso.nome} (${curso.carga_horaria}h)`,
    description: curso.seo.descricao || curso.subtitulo,
    url: `${SITE_URL}/cursos/${curso.slug}/`,
    inLanguage: "pt-BR",
    educationalCredentialAwarded: `Certificado de conclusão de ${curso.carga_horaria} horas com código de verificação`,
    teaches: curso.habilidades.map((h) => h.titulo),
    provider: {
      "@type": "EducationalOrganization",
      name: "Magma Cursos",
      url: `${SITE_URL}/`,
      sameAs: [instagramUrl(config)],
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "onsite",
      courseWorkload: `PT${curso.carga_horaria}H`,
      location: place(config),
    },
  };
}

export function faqJsonLd(curso: CursoCompleto) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: curso.faqs.map((f) => ({
      "@type": "Question",
      name: f.pergunta,
      acceptedAnswer: { "@type": "Answer", text: f.resposta },
    })),
  };
}

export function localBusinessJsonLd(config: SiteConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Magma Cursos",
    url: `${SITE_URL}/`,
    telephone: `+${config.whatsapp_principal}`,
    email: config.email,
    address: postalAddress(config),
    sameAs: [instagramUrl(config)],
  };
}
