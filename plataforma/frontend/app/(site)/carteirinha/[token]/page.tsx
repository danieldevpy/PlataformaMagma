import type { Metadata, Viewport } from "next";
import CarteirinhaCard from "@/components/client/CarteirinhaCard";
import { api } from "@/lib/api";
import type { ConviteCarteirinha } from "@/lib/types";

/**
 * Card digital do aluno (spec 014) — `Aluno.token`, identidade durável,
 * nunca expira. Sem cache: o estado (matrículas) pode mudar a qualquer
 * momento.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sua Carteirinha Digital | Magma Cursos",
  robots: { index: false, follow: false },
};

// viewport-fit=cover: sem isso env(safe-area-inset-*) fica sempre 0 e o
// painel de sucesso cola no home indicator do iPhone.
export const viewport: Viewport = { viewportFit: "cover" };

export default async function CarteirinhaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let convite: ConviteCarteirinha | null = null;
  try {
    convite = await api<ConviteCarteirinha>(`/carteirinha/${token}/`, {
      revalidate: 0,
    });
  } catch {
    convite = null;
  }

  if (convite === null || !convite.valido) {
    return (
      <section style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--navy-deep)", padding: 24 }}>
        <div className="form-card" style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ color: "var(--muted)" }}>
            {convite === null
              ? "Não foi possível carregar sua carteirinha agora. Tente novamente em alguns minutos."
              : "Link de carteirinha inválido. Confira o endereço que você recebeu."}
          </p>
        </div>
      </section>
    );
  }

  return <CarteirinhaCard aluno={convite} />;
}
