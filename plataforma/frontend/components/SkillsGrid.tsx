import { SKILL_ICONS, SKILL_ICON_DEFAULT } from "./icons";
import type { Habilidade } from "@/lib/types";

export default function SkillsGrid({
  carga,
  habilidades,
}: {
  carga: number;
  habilidades: Habilidade[];
}) {
  return (
    <section className="section">
      <div className="wrap">
        <div className="section-head center reveal">
          <span className="eyebrow">Do zero ao profissional</span>
          <h2>O que você vai dominar nas {carga} horas</h2>
          <div className="gold-rule"></div>
          <p>
            Nada de decoreba: cada habilidade é treinada na prática até virar
            reflexo — porque na emergência não dá tempo de pensar duas vezes.
          </p>
        </div>
        <div className="skills">
          {habilidades.map((h, i) => (
            <div
              key={h.ordem}
              className="skill reveal"
              data-delay={i % 3 === 0 ? undefined : String(i % 3)}
            >
              <div className="ico">{SKILL_ICONS[h.icone] ?? SKILL_ICON_DEFAULT}</div>
              <h3>{h.titulo}</h3>
              <p>{h.descricao}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
