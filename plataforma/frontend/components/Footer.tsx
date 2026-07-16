import { Fragment } from "react";
import Link from "next/link";
import { fmtTelefone } from "@/lib/format";
import type { SiteConfig } from "@/lib/types";

export default function Footer({
  config,
  nome,
}: {
  config: SiteConfig;
  nome: string;
}) {
  const linhasEndereco = config.endereco.split(/\s+—\s+/);
  const instagramUser = config.instagram.replace(/^@/, "");

  return (
    <footer className="site">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <div className="brand" style={{ marginBottom: 16 }}>
              <svg width="32" height="36">
                <use href="#magma-sym" />
              </svg>
              <span className="brand-name" style={{ fontSize: "1.05rem" }}>
                MAGMA<span>Cursos</span>
              </span>
            </div>
            <p>
              Cursos e treinamentos profissionais na área da saúde. Educar
              também é cuidar.
            </p>
          </div>
          <div>
            <h4>Cursos</h4>
            <Link href="/cursos/socorrista-aph/">Socorrista APH</Link>
            <Link href="/#cursos">Todos os cursos</Link>
            <Link href="/#leilucas">Lei Lucas para escolas</Link>
          </div>
          <div>
            <h4>Contato</h4>
            <a
              data-wa=""
              data-msg={`Olá! Vim pela página do curso de ${nome}.`}
              href="#"
            >
              {fmtTelefone(config.whatsapp_principal)}
            </a>
            <a href={`mailto:${config.email}`}>{config.email}</a>
            <a
              href={`https://www.instagram.com/${instagramUser}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram {config.instagram}
            </a>
            <p>
              {linhasEndereco.map((linha, i) => (
                <Fragment key={linha}>
                  {i > 0 && <br />}
                  {linha}
                </Fragment>
              ))}
            </p>
          </div>
        </div>
        <div className="foot-bar">
          <span>Curso Magma LTDA — CNPJ 48.330.206/0001-06</span>
          <span>Nilópolis, Rio de Janeiro</span>
        </div>
      </div>
    </footer>
  );
}
