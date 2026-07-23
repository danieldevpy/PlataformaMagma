import { Fragment } from "react";
import Link from "next/link";
import LeadForm from "./client/LeadForm";
import WaLinks from "./client/WaLinks";
import { Check } from "./icons";
import { fmtTelefone } from "@/lib/format";
import { mesclarCards, opcoesCursoHome, type HomeCard } from "@/lib/home-cards";
import type { CursoResumo, SiteConfig } from "@/lib/types";

const LI_CAPTURA = {
  display: "flex",
  gap: 12,
  padding: "8px 0",
  color: "#43506b",
  fontSize: ".93rem",
} as const;

function CardCurso({ card }: { card: HomeCard }) {
  const strokeFact = card.destaque ? "#dcb96a" : "#b8933f";
  return (
    <article className={card.destaque ? "curso destaque" : "curso"}>
      <div className="curso-top">
        <span className="chip">{card.chip}</span>
        <span className="horas">{card.horas}</span>
      </div>
      <h3>{card.nome}</h3>
      <p className="curso-desc">{card.desc}</p>
      {card.facts.length > 0 && (
        <ul className="facts">
          {card.facts.map((f) => (
            <li key={f} className="fact">
              <Check size={15} stroke={strokeFact} />
              {f}
            </li>
          ))}
        </ul>
      )}
      {card.cta.tipo === "link" ? (
        <Link
          className={card.destaque ? "btn btn-gold" : "btn btn-navy"}
          href={card.cta.href}
        >
          {card.cta.label}
        </Link>
      ) : (
        <a
          className={card.destaque ? "btn btn-gold" : "btn btn-navy"}
          data-wa=""
          data-msg={card.cta.msg}
          href="#"
        >
          {card.cta.label}
        </a>
      )}
    </article>
  );
}

/**
 * Home migrada de landing-page/index.html (zero redesign) —
 * CSS original escopado em styles/home.css (.home-page).
 * Grid de cursos e select do form mesclam GET /api/cursos/ com o
 * conteúdo estático original (fallback sem backend).
 */
export default function HomeLP({
  cursos,
  config,
}: {
  cursos: CursoResumo[];
  config: SiteConfig;
}) {
  const cards = mesclarCards(cursos);
  const opcoes = opcoesCursoHome(cursos);
  const linhasEndereco = config.endereco.split(/\s+—\s+/);
  const instagramUser = config.instagram.replace(/^@/, "");

  return (
    <div className="home-page">
      <div className="topline"></div>

      {/* ============ NAVEGACAO ============ */}
      <nav className="nav">
        <div className="wrap nav-inner">
          <a href="#" className="brand" aria-label="Magma Cursos">
            <svg width="38" height="42" aria-hidden="true">
              <use href="#magma-sym" />
            </svg>
            <span className="brand-name">
              MAGMA<span>Cursos</span>
            </span>
          </a>
          <div className="nav-links">
            <a href="#cursos">Cursos</a>
            <a href="#leilucas">Para Escolas</a>
            <a href="#sobre">A Magma</a>
            <a href="#faq">Dúvidas</a>
            <a
              className="btn btn-gold"
              data-wa=""
              data-msg="Olá! Vim pelo site da Magma e quero informações sobre os cursos."
              href="#"
            >
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="hero">
        <div className="wrap hero-inner">
          <div>
            <span className="eyebrow">
              Escola de cursos profissionais — Baixada Fluminense
            </span>
            <h1>
              Sua carreira na saúde começa com <em>prática de verdade</em>
            </h1>
            <p className="lead">
              Formação de Socorrista APH e cursos de especialização com
              instrutores que atuam na área, treino em equipamentos reais e
              certificado reconhecido pelo mercado.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-gold" href="#cursos">
                Conhecer os cursos
              </a>
              <a
                className="btn btn-outline"
                data-wa=""
                data-msg="Olá! Quero saber as datas das próximas turmas da Magma."
                href="#"
              >
                Próximas turmas
              </a>
            </div>
            <div className="hero-trust">
              <div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dcb96a" strokeWidth="2">
                  <path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-4Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                Certificado com código de verificação
              </div>
              <div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dcb96a" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                </svg>
                Instrutores atuantes na emergência
              </div>
              <div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dcb96a" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                Turmas aos sábados, feitas para quem trabalha
              </div>
            </div>
          </div>

          <aside className="hero-card">
            <span className="tag">Matrículas abertas</span>
            <h3>Socorrista APH</h3>
            <ul className="meta">
              <li>
                Carga horária <strong>120 horas</strong>
              </li>
              <li>
                Formato <strong>Sábados, 09h às 16h</strong>
              </li>
              <li>
                Local <strong>Olinda, Nilópolis — RJ</strong>
              </li>
              <li>
                Investimento <strong>Consulte condições</strong>
              </li>
            </ul>
            <a
              className="btn btn-gold"
              data-wa=""
              data-msg="Olá! Quero garantir minha vaga na próxima turma de Socorrista APH."
              href="#"
            >
              Garantir minha vaga
            </a>
            <small>
              Vagas limitadas por turma para garantir a qualidade da prática
            </small>
          </aside>
        </div>
      </header>

      {/* ============ FAIXA DE PROVA ============ */}
      <div className="strip">
        <div className="wrap strip-inner">
          <div>
            <b>120h</b>
            <span>de formação completa em APH</span>
          </div>
          <div>
            <b>8</b>
            <span>cursos e especializações</span>
          </div>
          <div>
            <b>100%</b>
            <span>das aulas com prática supervisionada</span>
          </div>
          <div>
            <b>Lei Lucas</b>
            <span>capacitação oficial para escolas</span>
          </div>
        </div>
      </div>

      {/* ============ CURSOS ============ */}
      <section className="section cursos" id="cursos">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">Formações e especializações</span>
            <h2>Escolha o curso que muda a sua carreira</h2>
            <div className="gold-rule"></div>
            <p>
              Do primeiro passo na área da saúde às especializações técnicas,
              todos os cursos unem teoria objetiva e prática intensiva.
            </p>
          </div>
          <div className="grid-cursos">
            {cards.map((card) => (
              <CardCurso key={card.nome} card={card} />
            ))}
          </div>
        </div>
      </section>

      {/* ============ LEI LUCAS (B2B) ============ */}
      <section className="section leilucas" id="leilucas">
        <div className="wrap">
          <div>
            <span className="eyebrow">Lei nº 13.722/2018</span>
            <h2>Sua escola já está em conformidade com a Lei Lucas?</h2>
            <div className="gold-rule"></div>
            <p>
              A Lei Lucas torna <strong>obrigatória</strong> a capacitação em
              primeiros socorros de professores e funcionários de escolas
              públicas e privadas de educação básica. A Magma leva o
              treinamento completo até a sua instituição, com prática em
              equipamentos reais e certificação para toda a equipe.
            </p>
            <p>
              Escolas como a Estação Ceag Kids já capacitaram suas equipes com
              a Magma.
            </p>
            <a
              className="btn btn-gold"
              data-wa=""
              data-msg="Olá! Represento uma escola e quero um orçamento de capacitação Lei Lucas para nossa equipe."
              href="#"
            >
              Solicitar orçamento para minha escola
            </a>
          </div>
          <div className="ll-box">
            <h4>O que o treinamento inclui</h4>
            <ul>
              <li>
                <Check size={17} />
                Reanimação cardiopulmonar (RCP) e uso de DEA
              </li>
              <li>
                <Check size={17} />
                Desengasgo em bebês, crianças e adultos
              </li>
              <li>
                <Check size={17} />
                Conduta em quedas, cortes e crises convulsivas
              </li>
              <li>
                <Check size={17} />
                Protocolo de acionamento do socorro (192/193)
              </li>
              <li>
                <Check size={17} />
                Certificado individual para cada colaborador
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ============ DIFERENCIAIS ============ */}
      <section className="section" id="sobre">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">Por que a Magma</span>
            <h2>Aqui, a segurança e o cuidado salvam vidas</h2>
            <div className="gold-rule"></div>
          </div>
          <div className="grid-dif">
            <div className="dif">
              <div className="ic">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dcb96a" strokeWidth="2">
                  <path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-4Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <h3>Prática de verdade</h3>
              <p>
                Manequins de RCP, DEA de treinamento e simulação de cenários.
                Você sai sabendo fazer, não só sabendo a teoria.
              </p>
            </div>
            <div className="dif">
              <div className="ic">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dcb96a" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <h3>Quem ensina, atua</h3>
              <p>
                Instrutores enfermeiros com registro no COREN e vivência real
                na emergência — o que cai na prova e o que acontece na rua.
              </p>
            </div>
            <div className="dif">
              <div className="ic">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dcb96a" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M7 15h4M7 11h10" />
                </svg>
              </div>
              <h3>Certificado que abre portas</h3>
              <p>
                Certificado com carga horária e código de verificação por QR
                code — o empregador confirma a autenticidade na hora.
              </p>
            </div>
            <div className="dif">
              <div className="ic">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dcb96a" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <h3>Feito para quem trabalha</h3>
              <p>
                Turmas aos sábados e carga horária organizada para quem precisa
                conciliar estudo, emprego e família.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ INSTRUTOR ============ */}
      <section className="section instrutor">
        <div className="wrap">
          <div className="foto-frame">
            {/* eslint-disable-next-line @next/next/no-img-element -- mesma convenção do InstructorSection */}
            <img
              src="/assets/instrutor-dea.jpg"
              alt="João Bello, instrutor de APH, segurando um DEA de treinamento"
              loading="lazy"
            />
          </div>
          <div>
            <span className="eyebrow">Coordenação técnica</span>
            <h2>Aprenda com quem vive a emergência</h2>
            <div className="gold-rule"></div>
            <p style={{ color: "var(--muted)" }}>
              O curso é conduzido pelo enfermeiro e instrutor{" "}
              <strong>João Bello</strong>, com atuação em atendimento
              pré-hospitalar e formação de socorristas. Cada aula parte de
              casos reais: o que funciona, o que falha e como agir sob pressão.
            </p>
            <div className="cred">
              <span>Enfermeiro — COREN-RJ</span>
              <span>Instrutor de APH</span>
              <span>Suporte Básico de Vida</span>
              <span>Capacitação Lei Lucas</span>
            </div>
            <a
              className="btn btn-navy"
              data-wa=""
              data-msg="Olá! Quero conversar sobre os cursos com a equipe Magma."
              href="#"
            >
              Conversar com a equipe
            </a>
          </div>
        </div>
      </section>

      {/* ============ COMO FUNCIONA ============ */}
      <section className="section">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">Simples do início ao fim</span>
            <h2>Da inscrição ao certificado em 4 passos</h2>
            <div className="gold-rule"></div>
          </div>
          <div className="grid-passos">
            <div className="passo">
              <h3>Fale conosco</h3>
              <p>
                Chame no WhatsApp, tire suas dúvidas e receba as datas e
                condições da próxima turma.
              </p>
            </div>
            <div className="passo">
              <h3>Garanta sua vaga</h3>
              <p>
                Matrícula rápida com condições de pagamento facilitadas. As
                turmas têm vagas limitadas.
              </p>
            </div>
            <div className="passo">
              <h3>Estude e pratique</h3>
              <p>
                Teoria objetiva e muita prática supervisionada, aos sábados, na
                nossa unidade em Nilópolis.
              </p>
            </div>
            <div className="passo">
              <h3>Receba o certificado</h3>
              <p>
                Concluiu com aproveitamento? Certificado com carga horária e
                verificação de autenticidade.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ DEPOIMENTOS (placeholders do original) ============ */}
      <section className="section depo">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">Quem fez, recomenda</span>
            <h2>Histórias de quem passou pela Magma</h2>
            <div className="gold-rule"></div>
            <p>Depoimentos de alunos das últimas turmas.</p>
          </div>
          <div className="grid-depo">
            <div className="depo-card">
              <span className="aspas">&ldquo;</span>
              <blockquote>
                [Depoimento real do aluno — 2 a 4 frases sobre a experiência no
                curso e o resultado na carreira.]
              </blockquote>
              <footer>
                <div className="avatar">A</div>
                <div>
                  <b>Nome do aluno</b>
                  <span>Socorrista APH — Turma 2026</span>
                </div>
              </footer>
            </div>
            <div className="depo-card">
              <span className="aspas">&ldquo;</span>
              <blockquote>
                [Depoimento real do aluno — priorizar quem conseguiu emprego ou
                promoção após o curso.]
              </blockquote>
              <footer>
                <div className="avatar">B</div>
                <div>
                  <b>Nome do aluno</b>
                  <span>Punção Venosa — Turma 2026</span>
                </div>
              </footer>
            </div>
            <div className="depo-card">
              <span className="aspas">&ldquo;</span>
              <blockquote>
                [Depoimento real de gestor escolar sobre o treinamento Lei
                Lucas realizado na instituição.]
              </blockquote>
              <footer>
                <div className="avatar">C</div>
                <div>
                  <b>Nome do gestor</b>
                  <span>Escola parceira — Lei Lucas</span>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CAPTURA DE LEAD ============ */}
      <section className="section captura" id="turmas">
        <div className="wrap">
          <div>
            <span className="eyebrow">Calendário de turmas</span>
            <h2>Receba as datas e valores da próxima turma</h2>
            <div className="gold-rule"></div>
            <p style={{ color: "var(--muted)" }}>
              Deixe seu contato e receba no WhatsApp o calendário atualizado,
              os valores e as condições de pagamento do curso que você escolher
              — sem compromisso.
            </p>
            <ul style={{ listStyle: "none", marginTop: 24 }}>
              <li style={LI_CAPTURA}>
                <Check stroke="#b8933f" />
                Resposta rápida pelo WhatsApp
              </li>
              <li style={LI_CAPTURA}>
                <Check stroke="#b8933f" />
                Condições especiais de matrícula antecipada
              </li>
              <li style={LI_CAPTURA}>
                <Check stroke="#b8933f" />
                Seus dados não são compartilhados com terceiros
              </li>
            </ul>
          </div>
          <LeadForm
            whats={config.whatsapp_principal}
            opcoesCurso={opcoes}
            opcoesQuando={[
              "O quanto antes",
              "Em até 3 meses",
              "Ainda estou pesquisando",
            ]}
            ctaLabel="Receber calendário no WhatsApp"
            ctaBlock={false}
          />
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="section" id="faq">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">Dúvidas frequentes</span>
            <h2>O que os alunos mais perguntam</h2>
            <div className="gold-rule"></div>
          </div>
          <div className="faq-list">
            <details>
              <summary>
                Preciso ter formação na área da saúde para fazer o curso de
                Socorrista?
              </summary>
              <p>
                Não. O curso de Socorrista APH forma você do zero: começamos
                pelos fundamentos e avançamos até os protocolos completos de
                atendimento pré-hospitalar. É uma porta de entrada para a área
                da saúde.
              </p>
            </details>
            <details>
              <summary>O certificado é reconhecido pelo mercado?</summary>
              <p>
                Sim. O certificado informa a carga horária completa e traz
                código de verificação por QR code, permitindo que qualquer
                empregador confirme a autenticidade. Nossos alunos atuam em
                ambulâncias, eventos, clínicas e home care.
              </p>
            </details>
            <details>
              <summary>
                Como funcionam os horários? Trabalho durante a semana.
              </summary>
              <p>
                As turmas foram desenhadas para quem trabalha: as aulas
                acontecem aos sábados, das 09h às 16h, na nossa unidade em
                Nilópolis. A carga horária total varia conforme o curso.
              </p>
            </details>
            <details>
              <summary>Quais são as formas de pagamento?</summary>
              <p>
                Aceitamos Pix, cartão e parcelamento. As condições variam por
                curso e por período de matrícula — quem se inscreve com
                antecedência garante as melhores condições. Consulte pelo
                WhatsApp.
              </p>
            </details>
            <details>
              <summary>As aulas são teóricas ou práticas?</summary>
              <p>
                As duas coisas, com ênfase na prática. Você treina em manequins
                de RCP, equipamentos de imobilização e simulações de cenário
                real, sempre com supervisão do instrutor.
              </p>
            </details>
            <details>
              <summary>
                Minha escola precisa se adequar à Lei Lucas. Como funciona?
              </summary>
              <p>
                Levamos o treinamento completo até a sua instituição:
                capacitação prática da equipe, material e certificado
                individual para cada colaborador. Solicite um orçamento pelo
                WhatsApp informando o número de participantes.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ============ LOCALIZACAO ============ */}
      <section className="section local" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="local-map">
            <iframe
              title="Mapa — Magma Cursos"
              loading="lazy"
              src="https://www.google.com/maps?q=Rua+Nossa+Senhora+de+F%C3%A1tima+495+Olinda+Nil%C3%B3polis+RJ&output=embed"
            ></iframe>
          </div>
          <div>
            <span className="eyebrow">Onde estamos</span>
            <h2>Venha nos visitar</h2>
            <div className="gold-rule"></div>
            <ul>
              <li>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#b8933f" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {config.endereco} — CEP 26545-080
              </li>
              <li>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#b8933f" strokeWidth="2">
                  <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 2Z" />
                </svg>
                {fmtTelefone(config.whatsapp_principal)} — (21) 96494-6079
              </li>
              <li>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#b8933f" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-10 6L2 7" />
                </svg>
                {config.email}
              </li>
              <li>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#b8933f" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="#b8933f" />
                </svg>
                <a
                  href={`https://www.instagram.com/${instagramUser}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#43506b" }}
                >
                  {config.instagram}
                </a>
              </li>
            </ul>
            <a
              className="btn btn-gold"
              style={{ marginTop: 22 }}
              data-wa=""
              data-msg="Olá! Quero agendar uma visita à unidade da Magma em Nilópolis."
              href="#"
            >
              Agendar uma visita
            </a>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="site">
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <div className="brand" style={{ marginBottom: 16 }}>
                <svg width="32" height="36" aria-hidden="true">
                  <use href="#magma-sym" />
                </svg>
                <span className="brand-name" style={{ fontSize: "1.1rem" }}>
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
              <a href="#cursos">BLS — Suporte Básico de Vida</a>
              <a href="#cursos">Punção Venosa</a>
              <a href="#cursos">Cuidador de Idosos</a>
              <a href="#leilucas">Lei Lucas para escolas</a>
            </div>
            <div>
              <h4>Contato</h4>
              <a data-wa="" data-msg="Olá! Vim pelo site da Magma." href="#">
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

      {/* ============ WHATSAPP FLUTUANTE ============ */}
      <a
        className="wa-float"
        data-wa=""
        data-msg="Olá! Vim pelo site da Magma e quero informações sobre os cursos."
        href="#"
        aria-label="Falar no WhatsApp"
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.4-3c-.3-.4 0-.5.1-.7l.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5c-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.5-.3Z" />
        </svg>
      </a>

      {/* comportamento do script.js (links WhatsApp com UTM) */}
      <WaLinks whats={config.whatsapp_principal} />
    </div>
  );
}
