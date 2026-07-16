import AnimatedNumber from "./client/AnimatedNumber";
import type { SiteConfig } from "@/lib/types";

/**
 * Faixa de números com contadores animados (comportamento do lp.js
 * via <AnimatedNumber>). Toggles de nota/formados seguem o doc 04.
 */
export default function StatsStrip({
  carga,
  config,
}: {
  carga: number;
  config: SiteConfig;
}) {
  return (
    <div className="strip">
      <div className="wrap strip-inner">
        <div>
          <AnimatedNumber value={carga} suffix="h" />
          <span>de formação completa</span>
        </div>
        {config.exibir_total_formados && config.total_alunos_formados != null && (
          <div>
            <AnimatedNumber value={config.total_alunos_formados} suffix="+" />
            <span>alunos formados</span>
          </div>
        )}
        <div>
          <AnimatedNumber value={100} suffix="%" />
          <span>presencial com prática</span>
        </div>
        {config.exibir_nota_google && config.nota_google != null && (
          <div>
            <AnimatedNumber value={config.nota_google} suffix="★" />
            <span>avaliação dos alunos</span>
          </div>
        )}
      </div>
    </div>
  );
}
