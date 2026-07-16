import type { ReactNode } from "react";
import OfferCard from "./OfferCard";
import { FALLBACK_IMAGENS } from "@/lib/fallback";
import type { CursoCompleto, SiteConfig } from "@/lib/types";

/** Envolve `titulo_destaque` em <em> dentro de `titulo_venda`. */
function comDestaque(titulo: string, destaque: string): ReactNode {
  const i = destaque ? titulo.indexOf(destaque) : -1;
  if (i < 0) return titulo;
  return (
    <>
      {titulo.slice(0, i)}
      <em>{destaque}</em>
      {titulo.slice(i + destaque.length)}
    </>
  );
}

export default function CourseHero({
  curso,
  config,
}: {
  curso: CursoCompleto;
  config: SiteConfig;
}) {
  const turma = curso.turma_destaque;

  return (
    <header className="hero">
      <div
        className="hero-bg"
        style={{
          backgroundImage: `url('${curso.imagem_hero || FALLBACK_IMAGENS.hero}')`,
        }}
      ></div>
      <div className="wrap hero-inner">
        <div>
          <span className="eyebrow" style={{ color: "var(--gold-light)" }}>
            Formação presencial · {curso.carga_horaria} horas · Nilópolis, RJ
          </span>
          <h1>{comDestaque(curso.titulo_venda, curso.titulo_destaque)}</h1>
          <p className="lead">{curso.subtitulo}</p>
          <div className="hero-proof">
            {config.exibir_nota_google && config.nota_google != null && (
              <span>
                ⭐ <b>{config.nota_google}</b>&nbsp;no Google
              </span>
            )}
            {config.exibir_total_formados && config.total_alunos_formados != null && (
              <span>
                ✔ <b>+{config.total_alunos_formados}</b>&nbsp;alunos formados
              </span>
            )}
            <span>✔ Instrutores COREN-RJ</span>
            <span>✔ Sábados, para quem trabalha</span>
          </div>
          <div className="hero-ctas">
            <a
              className="btn btn-gold btn-pulse"
              data-wa=""
              data-msg={`Olá! Quero garantir minha vaga na próxima turma de ${curso.nome} (${curso.carga_horaria}h).`}
              href="#"
            >
              Quero minha vaga agora
            </a>
            <a className="btn btn-outline" href="#pratica">
              Ver como funciona ↓
            </a>
            <small>
              Sem compromisso — você fala direto com a nossa equipe no WhatsApp.
            </small>
          </div>
        </div>

        {turma && (
          <OfferCard
            turma={turma}
            nome={curso.nome}
            formato={curso.formato}
            carga={curso.carga_horaria}
          />
        )}
      </div>
    </header>
  );
}
