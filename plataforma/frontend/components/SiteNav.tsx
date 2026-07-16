import Link from "next/link";

export default function SiteNav({ nome }: { nome: string }) {
  return (
    <nav className="nav">
      <div className="wrap nav-inner">
        <Link
          href="/"
          className="brand"
          aria-label="Magma Cursos — página inicial"
        >
          <svg width="38" height="42">
            <use href="#magma-sym" />
          </svg>
          <span className="brand-name">
            MAGMA<span>Cursos</span>
          </span>
        </Link>
        <div className="nav-links">
          <a href="#pratica">A prática</a>
          <a href="#certificado">Certificado</a>
          <a href="#oferta">Investimento</a>
          <a href="#faq">Dúvidas</a>
          <a
            className="btn btn-gold"
            data-wa=""
            data-msg={`Olá! Vim pela página do curso de ${nome} e quero garantir minha vaga.`}
            href="#"
          >
            Garantir minha vaga
          </a>
        </div>
      </div>
    </nav>
  );
}
