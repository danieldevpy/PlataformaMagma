/**
 * Seção "Carreira" (bg foto). `texto` = texto_carreira;
 * `saidas` = saidas_profissionais (chips visíveis).
 */
export default function CareerSection({
  nome,
  texto,
  imagem,
  saidas,
}: {
  nome: string;
  texto: string;
  imagem: string;
  saidas: string[];
}) {
  return (
    <section className="carreira">
      <div
        className="bg"
        style={{ backgroundImage: `url('${imagem}')` }}
      ></div>
      <div className="wrap">
        <div className="reveal" style={{ maxWidth: 640 }}>
          <span className="eyebrow" style={{ color: "var(--gold-light)" }}>
            Sua nova profissão
          </span>
          <h2>
            A saúde é uma das áreas que mais emprega no Brasil — e começa aqui
          </h2>
          <p style={{ color: "rgba(255,255,255,.85)", marginTop: 14 }}>
            {texto}
          </p>
          <div className="saidas">
            {saidas.map((s) => (
              <div key={s}>{s}</div>
            ))}
          </div>
          <a
            className="btn btn-gold"
            style={{ marginTop: 30 }}
            data-wa=""
            data-msg={`Olá! Quero começar minha carreira na saúde com o curso de ${nome}.`}
            href="#"
          >
            Começar minha carreira
          </a>
        </div>
      </div>
    </section>
  );
}
