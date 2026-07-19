import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

// import dinâmico DEPOIS do mock (a rota lê process.env.REVALIDATE_SECRET
// dentro do handler, não no top-level — então trocar o env por teste é seguro).
const { POST } = await import("./route");

function req(options: { secret?: string; body?: unknown; rawBody?: string } = {}) {
  const headers: Record<string, string> = {};
  if (options.secret !== undefined) headers["x-secret"] = options.secret;
  const body =
    options.rawBody ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined);
  return new Request("http://localhost/api/revalidate", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    revalidatePathMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sem REVALIDATE_SECRET configurado no ambiente, nega SEMPRE (fail-closed)", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "");
    const resposta = await POST(req({ secret: "qualquer-coisa" }));
    expect(resposta.status).toBe(401);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("header ausente → 401", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "segredo-teste");
    const resposta = await POST(req());
    expect(resposta.status).toBe(401);
  });

  it("segredo errado → 401", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "segredo-teste");
    const resposta = await POST(req({ secret: "errado" }));
    expect(resposta.status).toBe(401);
    const corpo = await resposta.json();
    expect(corpo.detail).toBe("segredo inválido");
  });

  it("segredo certo + 'path' único → revalida só aquele path", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "segredo-teste");
    const resposta = await POST(
      req({ secret: "segredo-teste", body: { path: "/cursos/socorrista-aph" } })
    );
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo).toEqual({ ok: true, revalidated: ["/cursos/socorrista-aph"] });
    expect(revalidatePathMock).toHaveBeenCalledExactlyOnceWith("/cursos/socorrista-aph");
  });

  it("segredo certo + 'paths' (lista) → revalida cada um", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "segredo-teste");
    const resposta = await POST(
      req({ secret: "segredo-teste", body: { paths: ["/", "/cursos/socorrista-aph"] } })
    );
    expect(resposta.status).toBe(200);
    expect(revalidatePathMock).toHaveBeenCalledTimes(2);
    expect(revalidatePathMock).toHaveBeenNthCalledWith(1, "/");
    expect(revalidatePathMock).toHaveBeenNthCalledWith(2, "/cursos/socorrista-aph");
  });

  it("corpo ausente ou inválido cai no default: revalida a home", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "segredo-teste");
    const resposta = await POST(req({ secret: "segredo-teste", rawBody: "isto não é JSON" }));
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.revalidated).toEqual(["/"]);
    expect(revalidatePathMock).toHaveBeenCalledExactlyOnceWith("/");
  });
});
