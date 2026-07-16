import type { SiteConfig } from "./types";

/**
 * Fetch tipado contra a API Django (docs/plataforma/03-api-contratos.md).
 * Base: NEXT_PUBLIC_API_URL (ver .env.local.example).
 */

// Base pública (navegador): normalmente relativa (`/api`), resolvida na
// mesma origem pelo nginx do host. É embutida no bundle do cliente no build
// (NEXT_PUBLIC_*). Componentes client-side importam isto direto.
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"
).replace(/\/$/, "");

// Base interna (SSR/Node): o servidor Next fala com o Django pela rede
// interna do Docker (ex.: http://backend:8000/api), onde um `/api` relativo
// não resolveria. Lida em runtime — não é NEXT_PUBLIC, então não vaza pro
// cliente. Em dev (sem essa var) cai no mesmo API_URL.
const INTERNAL_API_URL = (
  process.env.INTERNAL_API_URL ?? API_URL
).replace(/\/$/, "");

// No servidor usa a base interna; no navegador, a pública.
const baseUrl = (): string =>
  typeof window === "undefined" ? INTERNAL_API_URL : API_URL;

export interface ApiOptions {
  /**
   * ISR: segundos até revalidar o cache do fetch (default 60,
   * igual ao doc 04). `false` = cachear indefinidamente; 0 = sem cache.
   */
  revalidate?: number | false;
  /** Opções extras repassadas ao fetch (method, body, headers...). */
  init?: RequestInit;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly path: string,
  ) {
    super(`API ${status} em ${path}: ${detail}`);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { revalidate = 60, init } = opts;
  const base = baseUrl();
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  // No SSR o fetch bate direto no Django por http interno (sem passar pelo
  // nginx). Com DJANGO_HTTPS_ENABLED=true o SecurityMiddleware responderia
  // 301 pro https nesse hop e quebraria a chamada — este header faz o Django
  // tratar a request como segura (SECURE_PROXY_SSL_HEADER), igual ao que o
  // nginx envia pro tráfego do navegador.
  const serverHeaders =
    typeof window === "undefined" ? { "X-Forwarded-Proto": "https" } : undefined;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...serverHeaders, ...init?.headers },
      // Timeout curto: no build da imagem Docker o backend ainda não
      // existe (a base interna não resolve pra nada real nesse estágio) —
      // sem isso o fetch fica pendurado até o Next matar a página por
      // timeout de geração estática (doc 04 já prevê fallback, mas só se a
      // falha for rápida).
      signal: init?.signal ?? AbortSignal.timeout(8000),
      next: { revalidate },
    });
  } catch (err) {
    throw new ApiError(
      0,
      `falha de rede ao chamar ${url} (${err instanceof Error ? err.message : String(err)})`,
      path,
    );
  }

  if (!res.ok) {
    // Erros da API vêm sempre como {"detail": "mensagem legível"} (doc 03)
    let detail = res.statusText || `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      /* corpo não-JSON — mantém statusText */
    }
    throw new ApiError(res.status, detail, path);
  }

  return (await res.json()) as T;
}

/** GET /api/site/config/ — configuração global do site. */
export function getConfig(revalidate: number | false = 60): Promise<SiteConfig> {
  return api<SiteConfig>("/site/config/", { revalidate });
}
