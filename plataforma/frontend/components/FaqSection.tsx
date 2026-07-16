import type { Faq } from "@/lib/types";

export default function FaqSection({ faqs }: { faqs: Faq[] }) {
  return (
    <section className="section" id="faq">
      <div className="wrap">
        <div className="section-head center reveal">
          <span className="eyebrow">Dúvidas frequentes</span>
          <h2>O que todo mundo pergunta antes de se matricular</h2>
          <div className="gold-rule"></div>
        </div>
        <div className="faq-list reveal">
          {faqs.map((f) => (
            <details key={f.ordem}>
              <summary>{f.pergunta}</summary>
              <p>{f.resposta}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
