import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/jsonld";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // magic links e painel não devem ser indexados
      disallow: ["/avaliar/", "/painel/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
