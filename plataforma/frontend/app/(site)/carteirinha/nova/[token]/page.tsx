import type { Metadata, Viewport } from "next";
import CarteirinhaCadastro from "@/components/client/CarteirinhaCadastro";
import { api } from "@/lib/api";
import type { ConviteCadastroTurma } from "@/lib/types";

/**
 * Cadastro de aluno novo (spec 014) — link estável e reutilizável da
 * Turma (`token_cadastro`). Sem cache: turma pode fechar/lotar a
 * qualquer momento.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preencher Carteirinha | Magma Cursos",
  robots: { index: false, follow: false },
};

// viewport-fit=cover: sem isso env(safe-area-inset-*) fica sempre 0 e o
// bottom sheet/painel de sucesso colam no home indicator do iPhone.
export const viewport: Viewport = { viewportFit: "cover" };

const MOTIVOS: Record<string, string> = {
  fechada:
    "As inscrições desta turma não estão abertas no momento. Fale com a equipe da Magma pelo WhatsApp.",
  inexistente:
    "Link de cadastro inválido. Confira o endereço que você recebeu.",
};

export default async function CarteirinhaNovaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let convite: ConviteCadastroTurma | null = null;
  try {
    convite = await api<ConviteCadastroTurma>(`/carteirinha/nova/${token}/`, {
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
            Não foi possível carregar o cadastro agora. Tente novamente em
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

  return <CarteirinhaCadastro token={token} convite={convite} />;
}
