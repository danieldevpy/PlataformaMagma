import type { Metadata } from "next";
import HomeLP from "@/components/HomeLP";
import JsonLd from "@/components/JsonLd";
import { api, getConfig } from "@/lib/api";
import { FALLBACK_CONFIG } from "@/lib/fallback";
import { localBusinessJsonLd, SITE_URL } from "@/lib/jsonld";
import type { CursoResumo, SiteConfig } from "@/lib/types";

export const revalidate = 60;

// Metadados da home — mesmos do <head> de landing-page/index.html
export const metadata: Metadata = {
  title:
    "Magma Cursos — Formação de Socorrista APH e Cursos na Área da Saúde | Nilópolis, RJ",
  description:
    "Formação profissional em Atendimento Pré-Hospitalar (APH), BLS, Punção Venosa e cursos na área da saúde na Baixada Fluminense. Aulas práticas, instrutores atuantes e certificado. Nilópolis, RJ.",
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    title: "Magma Cursos — Formação de Socorrista APH | Baixada Fluminense",
    description:
      "Cursos e treinamentos profissionais na área da saúde com prática real e certificação. Turmas aos sábados em Nilópolis, RJ.",
    type: "website",
    locale: "pt_BR",
    url: `${SITE_URL}/`,
    siteName: "Magma Cursos",
  },
};

export default async function HomePage() {
  let cursos: CursoResumo[] = [];
  try {
    cursos = await api<CursoResumo[]>("/cursos/");
  } catch {
    cursos = []; // API fora → grid estático original (lib/home-cards)
  }

  let config: SiteConfig;
  try {
    config = await getConfig();
  } catch {
    config = FALLBACK_CONFIG;
  }

  return (
    <>
      <JsonLd data={localBusinessJsonLd(config)} />
      <HomeLP cursos={cursos} config={config} />
    </>
  );
}
