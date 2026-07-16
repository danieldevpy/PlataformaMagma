import type { NextConfig } from "next";
import path from "node:path";

// Domínio de produção placeholder — o dono real da mídia (Django/S3/CDN)
// entra via env quando existir. Ver .env.local.example.
const PROD_MEDIA_HOST =
  process.env.NEXT_PUBLIC_MEDIA_HOST || "media.magmacursosltda.com.br";

const nextConfig: NextConfig = {
  // Build standalone (server.js autocontido) — usado pelo Dockerfile de
  // produção pra copiar só o necessário pra imagem final.
  output: "standalone",
  // VPS de produção é modesto (build single-worker) — dá mais margem que
  // o default de 60s antes de desistir de uma página estática.
  staticPageGenerationTimeout: 180,
  // Evita que o Turbopack suba até um lockfile solto fora do projeto
  // (ex.: ~/package-lock.json) ao inferir a raiz do workspace.
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/**",
      },
      // http liberado também: fase de teste pelo IP da VPS ainda sem TLS
      // configurado. Depois que o domínio tiver certificado, só o https
      // é usado na prática, mas manter o http não é um problema de
      // segurança (é só um allowlist de onde o next/image pode buscar).
      {
        protocol: "http",
        hostname: PROD_MEDIA_HOST,
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: PROD_MEDIA_HOST,
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
