import Countdown from "./client/Countdown";
import { fmtDataInicio } from "@/lib/format";
import type { TurmaDestaque } from "@/lib/types";

/**
 * Card da turma no hero. Countdown funcional via client component,
 * renderizado apenas quando `turma.countdown` não é null (regra do
 * serializer, doc 04).
 */
export default function OfferCard({
  turma,
  nome,
  formato,
  carga,
}: {
  turma: TurmaDestaque;
  nome: string;
  formato: string;
  carga: number;
}) {
  return (
    <aside className="offer-card reveal" data-delay="1">
      {turma.status === "inscricoes" && (
        <span className="tag">Matrículas abertas</span>
      )}
      <h3>
        {nome} — Turma <span>{turma.codigo}</span>
      </h3>
      <p className="sub">{formato} · Unidade Olinda, Nilópolis</p>
      <ul className="meta">
        {turma.exibir_inicio && turma.inicio_aulas && (
          <li>
            Início das aulas <strong>{fmtDataInicio(turma.inicio_aulas)}</strong>
          </li>
        )}
        <li>
          Formato <strong>{turma.dias_e_horario}</strong>
        </li>
        <li>
          Carga horária <strong>{carga} horas</strong>
        </li>
        <li>
          Certificado <strong>{carga}h com QR code</strong>
        </li>
        {turma.exibir_vagas && turma.vagas_restantes != null && (
          <li>
            Vagas restantes <strong>Somente {turma.vagas_restantes}</strong>
          </li>
        )}
      </ul>
      {turma.countdown && (
        <Countdown ate={turma.countdown.ate} rotulo={turma.countdown.rotulo} />
      )}
      <a
        className="btn btn-gold btn-block"
        style={{ marginTop: 16 }}
        data-wa=""
        data-msg={`Olá! Quero a condição de matrícula antecipada da turma de ${nome}.`}
        href="#"
      >
        Garantir condição especial
      </a>
      <small>Vagas limitadas para garantir a qualidade da prática</small>
    </aside>
  );
}
