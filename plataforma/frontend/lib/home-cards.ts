import type { CursoResumo } from "./types";

/**
 * Grid de cursos da home — conteúdo estático fiel a
 * landing-page/index.html, mesclável com GET /api/cursos/:
 * cursos publicados na API sobrescrevem o card estático de mesmo slug
 * (horas, descrição e CTA passam a apontar para a LP própria);
 * cursos da API sem card estático entram como cards genéricos.
 */

export type CardCta =
  | { tipo: "link"; href: string; label: string }
  | { tipo: "wa"; msg: string; label: string };

export interface HomeCard {
  /** slug esperado na API; null = nunca mescla (ex.: in-company) */
  slug: string | null;
  chip: string;
  horas: string;
  nome: string;
  desc: string;
  facts: string[];
  cta: CardCta;
  destaque?: boolean;
}

export const HOME_CARDS: HomeCard[] = [
  {
    slug: "socorrista-aph",
    chip: "Carro-chefe",
    horas: "120h",
    nome: "Socorrista — APH",
    desc: "Formação completa em Atendimento Pré-Hospitalar para atuar em ambulâncias, eventos, remoções e emergências.",
    facts: [
      "Prática em manequins e equipamentos reais",
      "Aulas aos sábados, 09h às 16h",
      "Certificado de 120 horas",
    ],
    cta: { tipo: "link", href: "/cursos/socorrista-aph/", label: "Ver o curso completo" },
    destaque: true,
  },
  {
    slug: "bls",
    chip: "Especialização",
    horas: "20h",
    nome: "BLS — Suporte Básico de Vida",
    desc: "Protocolos de reanimação cardiopulmonar e suporte básico, exigência frequente em processos seletivos da saúde.",
    facts: ["RCP adulto, pediátrico e neonatal", "Treino com DEA"],
    cta: { tipo: "wa", msg: "Olá! Tenho interesse no curso de BLS (20h).", label: "Saber mais" },
  },
  {
    slug: "puncao-venosa",
    chip: "Especialização",
    horas: "8h",
    nome: "ICVP — Punção Venosa",
    desc: "Técnica de acesso venoso periférico com prática supervisionada. Habilidade que diferencia profissionais no mercado.",
    facts: ["Prática individual supervisionada", "Turma reduzida"],
    cta: { tipo: "wa", msg: "Olá! Tenho interesse no curso de Punção Venosa (ICVP, 8h).", label: "Saber mais" },
  },
  {
    slug: "stop-the-bleed",
    chip: "Especialização",
    horas: "8h",
    nome: "Stop the Bleed",
    desc: "Controle de hemorragias graves: torniquetes, curativos compressivos e conduta em cenários de trauma.",
    facts: ["Metodologia internacional", "Simulação de cenários reais"],
    cta: { tipo: "wa", msg: "Olá! Tenho interesse no curso Stop the Bleed (8h).", label: "Saber mais" },
  },
  {
    slug: "feridas-e-coberturas",
    chip: "Especialização",
    horas: "10h",
    nome: "Feridas e Coberturas",
    desc: "Avaliação e tratamento de feridas com as coberturas adequadas — competência valorizada em clínicas e home care.",
    facts: ["Casos práticos comentados", "Materiais e coberturas em mãos"],
    cta: { tipo: "wa", msg: "Olá! Tenho interesse no curso de Feridas e Coberturas (10h).", label: "Saber mais" },
  },
  {
    slug: "cuidador-de-idosos",
    chip: "Profissionalizante",
    horas: "—",
    nome: "Cuidador de Idosos",
    desc: "Formação para uma das profissões que mais crescem no Brasil, com foco no cuidado seguro e humanizado.",
    facts: ["Mercado em plena expansão", "Prática de mobilização e primeiros socorros"],
    cta: { tipo: "wa", msg: "Olá! Tenho interesse no curso de Cuidador de Idosos.", label: "Saber mais" },
  },
  {
    slug: "auxiliar-de-farmacia",
    chip: "Profissionalizante",
    horas: "—",
    nome: "Auxiliar de Farmácia",
    desc: "Porta de entrada para o mercado formal: atendimento, dispensação e rotina de farmácias e drogarias.",
    facts: ["Foco em empregabilidade", "Do balcão ao estoque"],
    cta: { tipo: "wa", msg: "Olá! Tenho interesse no curso de Auxiliar de Farmácia.", label: "Saber mais" },
  },
  {
    slug: "bombeiro-mirim",
    chip: "Infantojuvenil",
    horas: "—",
    nome: "Bombeiro Mirim",
    desc: "Disciplina, noções de segurança e primeiros socorros para crianças, em atividades lúdicas e supervisionadas.",
    facts: ["Atividades práticas e seguras", "Certificado de participação"],
    cta: { tipo: "wa", msg: "Olá! Quero informações sobre o Bombeiro Mirim para meu filho(a).", label: "Saber mais" },
  },
  {
    slug: null,
    chip: "Empresas e escolas",
    horas: "In-company",
    nome: "Treinamentos sob medida",
    desc: "Primeiros socorros, brigada e capacitações para equipes de escolas, condomínios, clínicas e indústrias.",
    facts: ["Realizado na sua unidade", "Certificação para toda a equipe"],
    cta: {
      tipo: "wa",
      msg: "Olá! Represento uma instituição e quero um orçamento de treinamento in-company.",
      label: "Pedir orçamento",
    },
  },
];

/** Mescla os cards estáticos com os cursos publicados na API. */
export function mesclarCards(cursos: CursoResumo[]): HomeCard[] {
  const porSlug = new Map(cursos.map((c) => [c.slug, c]));
  const usados = new Set<string>();

  const cards = HOME_CARDS.map((card) => {
    const cursoApi = card.slug ? porSlug.get(card.slug) : undefined;
    if (!cursoApi) return card;
    usados.add(cursoApi.slug);
    return {
      ...card,
      horas: `${cursoApi.carga_horaria}h`,
      desc: cursoApi.subtitulo,
      cta: {
        tipo: "link",
        href: `/cursos/${cursoApi.slug}/`,
        label: "Ver o curso completo",
      } as CardCta,
    };
  });

  const extras: HomeCard[] = cursos
    .filter((c) => !usados.has(c.slug))
    .map((c) => ({
      slug: c.slug,
      chip: c.turma_destaque?.status === "inscricoes" ? "Matrículas abertas" : "Curso",
      horas: `${c.carga_horaria}h`,
      nome: c.nome,
      desc: c.subtitulo,
      facts: [],
      cta: { tipo: "link", href: `/cursos/${c.slug}/`, label: "Ver o curso completo" },
    }));

  return [...cards, ...extras];
}

/** Opções do select "Curso de interesse" — fiel ao HTML da home. */
export interface OpcaoCursoHome {
  slug: string;
  label: string;
}

const OPCOES_ESTATICAS: OpcaoCursoHome[] = [
  { slug: "socorrista-aph", label: "Socorrista APH (120h)" },
  { slug: "bls", label: "BLS — Suporte Básico de Vida (20h)" },
  { slug: "puncao-venosa", label: "ICVP — Punção Venosa (8h)" },
  { slug: "stop-the-bleed", label: "Stop the Bleed (8h)" },
  { slug: "feridas-e-coberturas", label: "Feridas e Coberturas (10h)" },
  { slug: "cuidador-de-idosos", label: "Cuidador de Idosos" },
  { slug: "auxiliar-de-farmacia", label: "Auxiliar de Farmácia" },
  { slug: "bombeiro-mirim", label: "Bombeiro Mirim" },
  // slug vazio → LeadForm pula a API e abre o WhatsApp direto
  { slug: "", label: "Treinamento para empresa/escola (Lei Lucas)" },
];

export function opcoesCursoHome(cursos: CursoResumo[]): OpcaoCursoHome[] {
  if (cursos.length === 0) return OPCOES_ESTATICAS;
  return [
    ...cursos.map((c) => ({
      slug: c.slug,
      label: `${c.nome} (${c.carga_horaria}h)`,
    })),
    { slug: "", label: "Treinamento para empresa/escola (Lei Lucas)" },
  ];
}
