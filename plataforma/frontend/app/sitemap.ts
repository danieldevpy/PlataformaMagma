import type { MetadataRoute } from "next";
import { api } from "@/lib/api";
import { FALLBACK_CURSO } from "@/lib/fallback";
import { SITE_URL } from "@/lib/jsonld";
import type { CursoResumo } from "@/lib/types";

/** Sitemap: home + cursos publicados (fallback se a API estiver fora). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let slugs: string[];
  try {
    const cursos = await api<CursoResumo[]>("/cursos/", { revalidate: 3600 });
    slugs = cursos.map((c) => c.slug);
  } catch {
    slugs = [FALLBACK_CURSO.slug];
  }

  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...slugs.map((slug) => ({
      url: `${SITE_URL}/cursos/${slug}/`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
