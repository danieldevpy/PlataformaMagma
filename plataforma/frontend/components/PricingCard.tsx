import type { ReactNode } from "react";
import { Check } from "./icons";
import { fmtMoeda } from "@/lib/format";
import type { CursoCompleto, Preco } from "@/lib/types";

/** "Bônus: xyz" → <b>Bônus:</b>&nbsp;xyz (como na LP atual). */
function itemIncluso(item: string): ReactNode {
  const m = item.match(/^(Bônus:)\s*(.*)$/);
  if (!m) return item;
  return (
    <>
      <b>{m[1]}</b>&nbsp;{m[2]}
    </>
  );
}

function Garantia() {
  return (
    <div className="garantia">
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#b8933f"
        strokeWidth="1.8"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      <div>
        <b>Risco zero na primeira aula</b>
        <span>
          Participe da primeira aula e, se não for para você, devolvemos 100% do
          valor.
        </span>
      </div>
    </div>
  );
}

function CardComPreco({
  preco,
  turmaCodigo,
  nome,
}: {
  preco: Preco;
  turmaCodigo: string;
  nome: string;
}) {
  return (
    <div className="price-card">
      <span className="ribbon">Condição de matrícula antecipada</span>
      <p className="de">
        de <span>{fmtMoeda(preco.cheio)}</span> por
      </p>
      <p className="por">
        <span>{preco.parcelas_qtd}x</span> de{" "}
        <span>{fmtMoeda(preco.parcela_valor)}</span>
        <small>
          ou <span>{fmtMoeda(preco.avista)}</span> à vista no PIX
        </small>
      </p>
      <div className="divide"></div>
      <ul>
        <li>
          <Check size={16} stroke="#2e8b57" />
          Matrícula garante a vaga na turma <span>{turmaCodigo}</span>
        </li>
        <li>
          <Check size={16} stroke="#2e8b57" />
          Pagamento no cartão, PIX ou boleto
        </li>
        <li>
          <Check size={16} stroke="#2e8b57" />
          Condições especiais para grupos e ex-alunos
        </li>
      </ul>
      <a
        className="btn btn-gold btn-block btn-pulse"
        data-wa=""
        data-msg={`Olá! Quero garantir minha matrícula na turma de ${nome} com a condição antecipada.`}
        href="#"
      >
        Garantir minha vaga agora
      </a>
      <Garantia />
    </div>
  );
}

/** Estado quando `turma.preco` é null (exibir_preco=false no backend). */
export function ConsulteCondicoes({ nome }: { nome: string }) {
  return (
    <div className="price-card">
      <p className="por">
        Consulte condições
        <small>
          Chame no WhatsApp e receba valores, parcelamento e a condição da
          próxima turma.
        </small>
      </p>
      <div className="divide"></div>
      <ul>
        <li>
          <Check size={16} stroke="#2e8b57" />
          Matrícula garante a vaga na próxima turma
        </li>
        <li>
          <Check size={16} stroke="#2e8b57" />
          Pagamento no cartão, PIX ou boleto
        </li>
        <li>
          <Check size={16} stroke="#2e8b57" />
          Condições especiais para grupos e ex-alunos
        </li>
      </ul>
      <a
        className="btn btn-gold btn-block btn-pulse"
        data-wa=""
        data-msg={`Olá! Quero saber as condições de matrícula do curso de ${nome}.`}
        href="#"
      >
        Consultar condições
      </a>
      <Garantia />
    </div>
  );
}

/**
 * Seção "Oferta / investimento" inteira (bloco → componente, doc 04):
 * coluna com itens_inclusos + card de preço (ou "Consulte condições").
 */
export default function PricingCard({ curso }: { curso: CursoCompleto }) {
  const turma = curso.turma_destaque;

  return (
    <section className="section oferta" id="oferta">
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow" style={{ color: "var(--gold-light)" }}>
            Investimento
          </span>
          <h2>Quanto custa mudar de profissão?</h2>
          <p style={{ color: "rgba(255,255,255,.85)", marginTop: 14 }}>
            Menos que um celular — e é uma profissão para a vida inteira. Sua
            matrícula inclui:
          </p>
          <ul className="inclui">
            {curso.itens_inclusos.map((item) => (
              <li key={item}>
                <Check />
                {itemIncluso(item)}
              </li>
            ))}
          </ul>
        </div>
        <div className="reveal" data-delay="1">
          {turma?.preco ? (
            <CardComPreco
              preco={turma.preco}
              turmaCodigo={turma.codigo}
              nome={curso.nome}
            />
          ) : (
            <ConsulteCondicoes nome={curso.nome} />
          )}
        </div>
      </div>
    </section>
  );
}
