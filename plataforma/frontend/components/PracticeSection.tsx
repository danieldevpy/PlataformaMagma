import { Check } from "./icons";

/**
 * Seção "Prática de verdade" (dark). `titulo` = texto_pratica da API
 * (mapeado para o h2); a lista de equipamentos e os badges são estáticos,
 * como na LP atual.
 */
export default function PracticeSection({
  nome,
  titulo,
  imagem,
}: {
  nome: string;
  titulo: string;
  imagem: string;
}) {
  return (
    <section className="section pratica" id="pratica">
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow" style={{ color: "var(--gold-light)" }}>
            100% presencial · equipamentos reais
          </span>
          <h2>{titulo}</h2>
          <div className="gold-rule"></div>
          <ul>
            <li>
              <Check />
              Manequins de RCP adulto, infantil e bebê
            </li>
            <li>
              <Check />
              DEA de treinamento igual ao usado nas ambulâncias
            </li>
            <li>
              <Check />
              Prancha rígida, colar cervical e kit de imobilização
            </li>
            <li>
              <Check />
              Turmas reduzidas: todo aluno pratica em todas as aulas
            </li>
          </ul>
          <a
            className="btn btn-gold"
            style={{ marginTop: 26 }}
            data-wa=""
            data-msg={`Olá! Quero conhecer a estrutura do curso de ${nome}.`}
            href="#"
          >
            Quero treinar assim
          </a>
        </div>
        <div className="foto-stack reveal" data-delay="1">
          {/* eslint-disable-next-line @next/next/no-img-element -- fidelidade à LP atual; migrar para next/image em tarefa futura */}
          <img
            className="main"
            src={imagem}
            alt="Alunos praticando imobilização em prancha rígida com colar cervical"
            loading="lazy"
          />
          <div className="badge-float b1">
            <div className="dot">
              <Check size={20} stroke="#101c38" width={2.5} />
            </div>
            <div>
              <b>Prática supervisionada</b>
              <span>em todas as aulas</span>
            </div>
          </div>
          <div className="badge-float b2">
            <div className="dot">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#101c38"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
              </svg>
            </div>
            <div>
              <b>COREN-RJ</b>
              <span>instrutores registrados</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
