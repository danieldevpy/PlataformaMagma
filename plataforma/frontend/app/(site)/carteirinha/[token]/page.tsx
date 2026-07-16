import type { Metadata, Viewport } from "next";
import CarteirinhaExperience from "@/components/client/CarteirinhaExperience";
import { api } from "@/lib/api";
import type { ConviteCarteirinha } from "@/lib/types";

/**
 * Página do magic link de carteirinha digital. Sem cache: cada token é
 * único e o estado (preenchida ou não) pode mudar a qualquer momento.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sua Carteirinha Digital | Magma Cursos",
  robots: { index: false, follow: false },
};

// viewport-fit=cover: sem isso env(safe-area-inset-*) fica sempre 0 e o
// bottom sheet/painel de sucesso colam no home indicator do iPhone.
export const viewport: Viewport = { viewportFit: "cover" };

const MOTIVOS: Record<string, string> = {
  expirado:
    "Este link de carteirinha expirou. Peça um novo link para a equipe da Magma pelo WhatsApp.",
  inexistente:
    "Link de carteirinha inválido. Confira o endereço que você recebeu.",
};

export default async function CarteirinhaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let convite: ConviteCarteirinha | null = null;
  try {
    convite = await api<ConviteCarteirinha>(`/carteirinha/convite/${token}/`, {
      revalidate: 0,
    });
  } catch {
    convite = null;
  }

  if (convite === null) {
    return (
      <section style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--navy-deep)", padding: 24 }}>
        <div className="form-card" style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ color: "var(--muted)" }}>
            Não foi possível carregar sua carteirinha agora. Tente novamente em
            alguns minutos.
          </p>
        </div>
      </section>
    );
  }

  if (!convite.valido) {
    return (
      <section style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--navy-deep)", padding: 24 }}>
        <div className="form-card" style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ color: "var(--muted)" }}>
            {MOTIVOS[convite.motivo] ?? MOTIVOS.inexistente}
          </p>
        </div>
      </section>
    );
  }

  return <CarteirinhaExperience token={token} convite={convite} />;
}
