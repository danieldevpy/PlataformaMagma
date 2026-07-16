import LeadForm from "./client/LeadForm";
import { Check } from "./icons";
import type { CursoCompleto } from "@/lib/types";

const LI_STYLE = {
  display: "flex",
  gap: 12,
  padding: "8px 0",
  color: "#43506b",
  fontSize: ".93rem",
} as const;

/**
 * Captura final — form funcional (<LeadForm> client: POST /api/leads/
 * → abre whatsapp_url; fallback wa.me local se a API falhar).
 */
export default function LeadCaptureSection({
  curso,
  whats,
}: {
  curso: CursoCompleto;
  whats: string;
}) {
  const turma = curso.turma_destaque;

  return (
    <section className="section captura" id="turmas">
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow">Último passo</span>
          <h2>
            {turma ? (
              <>
                Garanta sua vaga na turma <span>{turma.codigo}</span>
              </>
            ) : (
              <>Garanta sua vaga na próxima turma</>
            )}
          </h2>
          <div className="gold-rule"></div>
          <p style={{ color: "var(--muted)", marginTop: 14 }}>
            Deixe seu nome e receba no WhatsApp o calendário completo, valores
            e a condição de matrícula antecipada — sem compromisso.
          </p>
          <ul style={{ listStyle: "none", marginTop: 22 }}>
            <li style={LI_STYLE}>
              <Check stroke="#b8933f" />
              Resposta em minutos no horário comercial
            </li>
            <li style={LI_STYLE}>
              <Check stroke="#b8933f" />
              Vagas limitadas — prioridade por ordem de contato
            </li>
            <li style={LI_STYLE}>
              <Check stroke="#b8933f" />
              Seus dados não são compartilhados com terceiros
            </li>
          </ul>
        </div>
        <LeadForm
          cursoSlug={curso.slug}
          dataCurso={`${curso.nome} (${curso.carga_horaria}h)`}
          whats={whats}
          opcoesQuando={[
            "O quanto antes",
            "Na próxima turma",
            "Ainda estou pesquisando",
          ]}
          ctaLabel="Receber condições no WhatsApp"
          revealDelay="1"
        />
      </div>
    </section>
  );
}
