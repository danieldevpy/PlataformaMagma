import AnnounceBar from "./AnnounceBar";
import SiteNav from "./SiteNav";
import CourseHero from "./CourseHero";
import StatsStrip from "./StatsStrip";
import SkillsGrid from "./SkillsGrid";
import PracticeSection from "./PracticeSection";
import OutcomesMarquee from "./OutcomesMarquee";
import CareerSection from "./CareerSection";
import InstructorSection from "./InstructorSection";
import CertificateSection from "./CertificateSection";
import PricingCard from "./PricingCard";
import ReviewsSection from "./ReviewsSection";
import FaqSection from "./FaqSection";
import LeadCaptureSection from "./LeadCaptureSection";
import Footer from "./Footer";
import StickyCtaBar from "./StickyCtaBar";
import WhatsFloat from "./WhatsFloat";
import RevealObserver from "./client/RevealObserver";
import WaLinks from "./client/WaLinks";
import { FALLBACK_DEPOS, FALLBACK_IMAGENS, MARQUEE_ITENS } from "@/lib/fallback";
import type { CursoCompleto, SiteConfig } from "@/lib/types";

/**
 * LP de curso completa — mesma ordem de blocos do HTML atual
 * (landing-page/cursos/socorrista-aph/index.html).
 * Regras condicionais do doc 04: o front só checa null/booleano.
 */
export default function CursoLP({
  curso,
  config,
}: {
  curso: CursoCompleto;
  config: SiteConfig;
}) {
  const turma = curso.turma_destaque;
  const avaliacoes =
    curso.avaliacoes.length > 0 ? curso.avaliacoes : FALLBACK_DEPOS;

  return (
    <>
      {turma?.exibir_vagas && turma.vagas_restantes != null && (
        <AnnounceBar turma={turma} />
      )}
      <div className="topline"></div>

      <SiteNav nome={curso.nome} />
      <CourseHero curso={curso} config={config} />
      <StatsStrip carga={curso.carga_horaria} config={config} />
      <SkillsGrid carga={curso.carga_horaria} habilidades={curso.habilidades} />
      <PracticeSection
        nome={curso.nome}
        titulo={curso.texto_pratica}
        imagem={curso.imagem_pratica || FALLBACK_IMAGENS.pratica}
      />
      <OutcomesMarquee itens={MARQUEE_ITENS} />
      <CareerSection
        nome={curso.nome}
        texto={curso.texto_carreira}
        imagem={curso.imagem_carreira || FALLBACK_IMAGENS.carreira}
        saidas={curso.saidas_profissionais}
      />
      <InstructorSection instrutores={curso.instrutores} />
      <CertificateSection nome={curso.nome} carga={curso.carga_horaria} />
      <PricingCard curso={curso} />
      <ReviewsSection avaliacoes={avaliacoes} />
      <FaqSection faqs={curso.faqs} />
      <LeadCaptureSection curso={curso} whats={config.whatsapp_principal} />
      <Footer config={config} nome={curso.nome} />
      <StickyCtaBar curso={curso} />
      <WhatsFloat nome={curso.nome} />

      {/* comportamentos do lp.js (client, sem DOM próprio) */}
      <RevealObserver />
      <WaLinks whats={config.whatsapp_principal} />
    </>
  );
}
