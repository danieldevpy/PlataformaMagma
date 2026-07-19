import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, getConfig } from "./api";

function mockResponse(options: {
  ok: boolean;
  status?: number;
  statusText?: string;
  json?: unknown;
  jsonFails?: boolean;
}): Response {
  return {
    ok: options.ok,
    status: options.status ?? (options.ok ? 200 : 400),
    statusText: options.statusText ?? "",
    json: options.jsonFails
      ? vi.fn().mockRejectedValue(new Error("corpo não é JSON"))
      : vi.fn().mockResolvedValue(options.json ?? {}),
  } as unknown as Response;
}

describe("api()", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devolve o JSON decodificado em caso de sucesso", async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, json: { ok: true } }));
    const resultado = await api<{ ok: boolean }>("/site/config/");
    expect(resultado).toEqual({ ok: true });
  });

  it("monta a URL concatenando a base com o path", async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, json: {} }));
    await api("/cursos/");
    const [url] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/cursos\/$/);
  });

  it("erro HTTP com corpo {detail} usa a mensagem do backend (contrato doc 03)", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ ok: false, status: 404, json: { detail: "Curso não encontrado." } })
    );
    await expect(api("/cursos/nao-existe/")).rejects.toMatchObject({
      status: 404,
      detail: "Curso não encontrado.",
    });
  });

  it("erro HTTP sem corpo JSON válido cai no statusText", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ ok: false, status: 500, statusText: "Internal Server Error", jsonFails: true })
    );
    await expect(api("/site/config/")).rejects.toMatchObject({
      status: 500,
      detail: "Internal Server Error",
    });
  });

  it("falha de rede vira ApiError status 0 (não deixa a exceção crua vazar)", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    let erro: unknown;
    try {
      await api("/site/config/");
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).status).toBe(0);
    expect((erro as ApiError).detail).toContain("fetch failed");
  });

  it("getConfig() chama /site/config/ com revalidate default 60", async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, json: {} }));
    await getConfig();
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.next).toEqual({ revalidate: 60 });
  });
});
