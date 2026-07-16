import { Check } from "./icons";
import { horasPorExtenso } from "@/lib/format";

/**
 * Seção do certificado — conteúdo estático (cert-mini fiel ao PDF oficial)
 * parametrizado pelo nome do curso e carga horária.
 */
export default function CertificateSection({
  nome,
  carga,
}: {
  nome: string;
  carga: number;
}) {
  return (
    <section
      className="section certif"
      id="certificado"
      style={{ background: "var(--paper)" }}
    >
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow">Sua credencial</span>
          <h2>Certificado de {carga}h que o empregador confirma na hora</h2>
          <div className="gold-rule"></div>
          <ul className="cert-feats">
            <li>
              <Check stroke="#b8933f" />
              <span>
                <b>QR code de verificação</b> — qualquer empresa escaneia e
                confirma a autenticidade em segundos.
              </span>
            </li>
            <li>
              <Check stroke="#b8933f" />
              <span>
                <b>Conteúdo programático no verso</b> — o empregador vê
                exatamente o que você domina.
              </span>
            </li>
            <li>
              <Check stroke="#b8933f" />
              <span>
                <b>Assinado por instrutor COREN-RJ</b> — credencial com
                responsável técnico identificado.
              </span>
            </li>
          </ul>
          <a
            className="btn btn-gold"
            style={{ marginTop: 24 }}
            data-wa=""
            data-msg={`Olá! Quero saber mais sobre o certificado do curso de ${nome}.`}
            href="#"
          >
            Quero esse certificado
          </a>
        </div>
        <div className="reveal" data-delay="1">
          <div className="cert-mini">
            <div className="tri g1"></div>
            <div className="tri n1"></div>
            <div className="tri g2"></div>
            <div className="tri n2"></div>
            <div className="line"></div>
            <div className="mid">
              <svg width="14%" viewBox="0 0 100 110" style={{ maxWidth: 64 }}>
                <use href="#magma-sym" />
              </svg>
              <span className="script">Certificado</span>
              <div className="nome">SEU NOME COMPLETO AQUI</div>
              <p className="desc">
                por ter frequentado integralmente o curso de{" "}
                <b>{nome.toUpperCase()}</b> perfazendo um total de {carga} (
                {horasPorExtenso(carga)}) horas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
