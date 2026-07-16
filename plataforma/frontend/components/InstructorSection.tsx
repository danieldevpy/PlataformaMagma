import { Fragment } from "react";
import type { Instrutor } from "@/lib/types";

export default function InstructorSection({
  instrutores,
}: {
  instrutores: Instrutor[];
}) {
  const foto = instrutores[0]?.foto;

  return (
    <section className="section instrutor">
      <div className="wrap">
        <div className="reveal">
          {foto && (
            // eslint-disable-next-line @next/next/no-img-element -- fidelidade à LP atual; migrar para next/image em tarefa futura
            <img
              src={foto}
              alt="Instrutor enfermeiro com DEA de treinamento"
              loading="lazy"
            />
          )}
        </div>
        <div className="reveal" data-delay="1">
          <span className="eyebrow">Quem ensina</span>
          <h2>Instrutores que vivem a emergência de verdade</h2>
          <div className="gold-rule"></div>
          <p style={{ color: "var(--muted)", marginTop: 16 }}>
            As aulas são conduzidas por enfermeiros registrados no COREN-RJ e
            com vivência real em atendimento pré-hospitalar. Você aprende o que
            cai na prova <b>e o que acontece na rua</b> — os erros mais comuns,
            os atalhos que funcionam e a postura profissional que o mercado
            espera.
          </p>
          <div className="cred">
            {instrutores.map((i) => (
              <Fragment key={i.nome}>
                <span>{i.nome}</span>
                <span>{i.registro}</span>
                <span>{i.especializacao}</span>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
