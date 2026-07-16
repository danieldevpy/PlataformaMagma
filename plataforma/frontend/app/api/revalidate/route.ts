import { revalidatePath } from "next/cache";

/**
 * Receptor do hook Django→Next de ISR on-demand (doc 03).
 * Autentica pelo header X-Secret === REVALIDATE_SECRET.
 * Body: {"path": "/cursos/socorrista-aph"} ou {"paths": ["/", ...]}.
 * (O disparo do lado Django é pendência do backend.)
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const enviado = request.headers.get("x-secret");

  if (!secret || enviado !== secret) {
    return Response.json({ detail: "segredo inválido" }, { status: 401 });
  }

  let body: { path?: string; paths?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    /* body vazio → revalida a home */
  }

  const paths = body.paths ?? (body.path ? [body.path] : ["/"]);
  for (const p of paths) revalidatePath(p);

  return Response.json({ ok: true, revalidated: paths });
}
