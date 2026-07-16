import type { SiteConfig } from "./types";

/**
 * Fetch tipado contra a API Django (docs/plataforma/03-api-contratos.md).
 * Base: NEXT_PUBLIC_API_URL (ver .env.local.example).
 */

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"
).replace(/\/$/, "");

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
  const url = `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", ...init?.headers },
      ...init,
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
