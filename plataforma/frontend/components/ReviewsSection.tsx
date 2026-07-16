import { iniciais } from "@/lib/format";
import type { Avaliacao } from "@/lib/types";

export default function ReviewsSection({
  avaliacoes,
}: {
  avaliacoes: Avaliacao[];
}) {
  return (
    <section className="section" style={{ background: "var(--paper)" }}>
      <div className="wrap">
        <div className="section-head center reveal">
          <span className="eyebrow">Quem já passou por aqui</span>
          <h2>Alunos que hoje trabalham salvando vidas</h2>
          <div className="gold-rule"></div>
        </div>
        <div className="depos">
          {avaliacoes.map((a, i) => (
            <div
              key={`${a.nome}-${a.turma_codigo}`}
              className="depo reveal"
              data-delay={i % 3 === 0 ? undefined : String(i % 3)}
            >
              <div className="stars">{"★".repeat(a.estrelas)}</div>
              <blockquote>{`"${a.comentario}"`}</blockquote>
              <footer>
                <div className="avatar">{iniciais(a.nome)}</div>
                <div>
                  <b>{a.nome}</b>
                  <span>
                    {a.cargo_atual} — Turma {a.turma_codigo}
                  </span>
                </div>
              </footer>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
