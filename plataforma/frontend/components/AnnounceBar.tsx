import { mesMaiusculo, pad2 } from "@/lib/format";
import type { TurmaDestaque } from "@/lib/types";

/**
 * Barra de urgência. Só é montada pelo CursoLP quando
 * `turma.exibir_vagas && turma.vagas_restantes != null` (doc 04).
 */
export default function AnnounceBar({ turma }: { turma: TurmaDestaque }) {
  const rotuloTurma = turma.inicio_aulas
    ? mesMaiusculo(turma.inicio_aulas)
    : turma.codigo;

  return (
    <div className="announce">
      🔥 Turma de <b>{rotuloTurma}</b> com matrículas abertas — restam{" "}
      <b>{pad2(turma.vagas_restantes ?? 0)}</b> vagas com condição de matrícula
      antecipada
    </div>
  );
}
