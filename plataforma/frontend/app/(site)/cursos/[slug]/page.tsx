import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CursoLP from "@/components/CursoLP";
import JsonLd from "@/components/JsonLd";
import { api, getConfig, ApiError } from "@/lib/api";
import { FALLBACK_CONFIG, FALLBACK_CURSO, FALLBACK_IMAGENS } from "@/lib/fallback";
import { cursoJsonLd, faqJsonLd, SITE_URL } from "@/lib/jsonld";
import type { CursoCompleto, CursoResumo, SiteConfig } from "@/lib/types";

export const revalidate = 60;

export async function generateStaticParams() {
  try {
    const cursos = await api<CursoResumo[]>("/cursos/");
    return cursos.map((c) => ({ slug: c.slug }));
  } catch {
    // API fora do ar durante o build → nunca quebrar (doc 04)
    return [{ slug: FALLBACK_CURSO.slug }];
  }
}

/**
 * Busca curso+config com a política de erro do doc 04:
 * - 404 da API → página não existe (notFound).
 * - API fora do ar → fallback estático APENAS para socorrista-aph
 *   (lib/fallback é tratamento de erro, não mecanismo de conteúdo).
 */
async function carregar(
  slug: string,
): Promise<{ curso: CursoCompleto; config: SiteConfig } | null> {
  let curso: CursoCompleto;
  try {
    curso = await api<CursoCompleto>(`/cursos/${slug}/`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    if (slug === FALLBACK_CURSO.slug) {
      return { curso: FALLBACK_CURSO, config: FALLBACK_CONFIG };
    }
    return null;
  }

  let config: SiteConfig;
  try {
    config = await getConfig();
  } catch {
    config = FALLBACK_CONFIG;
  }
  return { curso, config };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dados = await carregar(slug);
  if (!dados) return {};

  const { curso } = dados;
  const url = `${SITE_URL}/cursos/${curso.slug}/`;
  // ImageField vazio → null; OG image cai no asset local de fallback
  const hero = curso.imagem_hero || FALLBACK_IMAGENS.hero;
  const imagem = hero.startsWith("http") ? hero : `${SITE_URL}${hero}`;
  // seo.titulo/descricao podem vir vazios do painel → deriva do curso
  const titulo =
    curso.seo.titulo || `${curso.nome} (${curso.carga_horaria}h) | Magma Cursos`;
  const descricao = curso.seo.descricao || curso.subtitulo;

  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: url },
    openGraph: {
      title: titulo,
      description: descricao,
      type: "website",
      locale: "pt_BR",
      url,
      siteName: "Magma Cursos",
      images: [imagem],
    },
  };
}

export default async function CursoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dados = await carregar(slug);
  if (!dados) notFound();

  const { curso, config } = dados;
  return (
    <>
      <JsonLd data={cursoJsonLd(curso, config)} />
      <JsonLd data={faqJsonLd(curso)} />
      <CursoLP curso={curso} config={config} />
    </>
  );
}
