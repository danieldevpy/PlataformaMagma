import type { Metadata, Viewport } from "next";
import AvaliacaoExperience from "@/components/client/AvaliacaoExperience";
import { api } from "@/lib/api";
import type { ConviteAvaliacao } from "@/lib/types";

/**
 * Página do magic link de avaliação. Sem cache: cada token é único.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Avalie seu curso | Magma Cursos",
  robots: { index: false, follow: false },
};

// viewport-fit=cover: sem isso env(safe-area-inset-*) fica sempre 0 e a
// barra/modal de avaliação cola no home indicator do iPhone.
export const viewport: Viewport = { viewportFit: "cover" };

const MOTIVOS: Record<string, string> = {
  expirado:
    "Este link de avaliação expirou. Peça um novo link para a equipe da Magma pelo WhatsApp.",
  usado: "Este link já foi utilizado. Obrigado pela sua avaliação!",
  inexistente:
    "Link de avaliação inválido. Confira o endereço que você recebeu.",
};

export default async function AvaliarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let convite: ConviteAvaliacao | null = null;
  try {
    convite = await api<ConviteAvaliacao>(`/avaliacoes/convite/${token}/`, {
      revalidate: 0,
    });
  } catch {
    convite = null;
  }

  if (convite === null) {
    return (
      <section
        style={{
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--navy-deep)",
          padding: 24,
        }}
      >
        <div className="form-card" style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ color: "var(--muted)" }}>
            Não foi possível carregar seu convite agora. Tente novamente em
            alguns minutos.
          </p>
        </div>
      </section>
    );
  }

  if (!convite.valido) {
    return (
      <section
        style={{
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--navy-deep)",
          padding: 24,
        }}
      >
        <div className="form-card" style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ color: "var(--muted)" }}>
            {MOTIVOS[convite.motivo] ?? MOTIVOS.inexistente}
          </p>
        </div>
      </section>
    );
  }

  return <AvaliacaoExperience token={token} convite={convite} />;
}
