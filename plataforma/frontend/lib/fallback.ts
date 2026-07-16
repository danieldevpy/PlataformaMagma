import type { Avaliacao, CursoCompleto, SiteConfig } from "./types";

/**
 * Fallbacks com os textos REAIS da LP atual
 * (landing-page/cursos/socorrista-aph/index.html).
 *
 * Papel (doc 04): tratamento de erro / render sem backend — o conteúdo
 * oficial vem do banco via seed (doc 08); isto NÃO é mecanismo de conteúdo.
 * Valores de turma/preço seguem o exemplo canônico do doc 03 (o HTML usa
 * placeholders [R$ 0.000] preenchidos pelo backend).
 */

/**
 * Assets locais usados quando a API devolve ImageField null
 * (imagem não cadastrada no painel) — fotos genéricas da Magma.
 */
export const FALLBACK_IMAGENS = {
  hero: "/assets/hero-rcp.jpg",
  pratica: "/assets/pratica-imobilizacao.jpg",
  carreira: "/assets/socorrista-ambulancia.jpg",
} as const;

export const FALLBACK_CONFIG: SiteConfig = {
  whatsapp_principal: "5521964946079",
  instagram: "@magma_curso",
  email: "curso.magma21@gmail.com",
  endereco: "Rua Nossa Senhora de Fátima, 495 — Olinda, Nilópolis/RJ",
  nota_google: 4.9,
  exibir_nota_google: true,
  total_alunos_formados: 500,
  exibir_total_formados: true,
};

/** Depoimentos-template da LP atual — usados quando `avaliacoes` vem vazia. */
export const FALLBACK_DEPOS: Avaliacao[] = [
  {
    nome: "Marcos Ribeiro",
    cargo_atual: "Socorrista em eventos",
    estrelas: 5,
    comentario:
      "Entrei sem saber nada da área. Saí fazendo RCP com segurança e hoje trabalho em ambulância de eventos. A prática fez toda a diferença.",
    foto: null,
    turma_codigo: "2025",
  },
  {
    nome: "Ana Souza",
    cargo_atual: "Socorrista de remoção",
    estrelas: 5,
    comentario:
      "O instrutor mostra o que acontece de verdade na rua. Consegui minha primeira vaga em remoção um mês depois de formada.",
    foto: null,
    turma_codigo: "2025",
  },
  {
    nome: "Carlos Lima",
    cargo_atual: "Brigadista industrial",
    estrelas: 5,
    comentario:
      "Fiz o curso para a brigada da empresa e acabei mudando de carreira. O certificado com QR code passou direto na entrevista.",
    foto: null,
    turma_codigo: "2024",
  },
];

/**
 * Itens do marquee decorativo (aria-hidden) — cópia fiel da LP atual.
 * Quando a API for ligada, decidir se o marquee deriva de
 * `saidas_profissionais` (doc 04) ou mantém lista própria.
 */
export const MARQUEE_ITENS = [
  "Ambulâncias",
  "Eventos e shows",
  "Remoções",
  "Resgate",
  "Brigadas de empresa",
  "Base para enfermagem",
  "Bombeiro civil",
];

export const FALLBACK_CURSO: CursoCompleto = {
  slug: "socorrista-aph",
  nome: "Socorrista APH",
  titulo_venda:
    "Em 120 horas você estará pronto para salvar vidas — e viver disso",
  titulo_destaque: "salvar vidas",
  subtitulo:
    "A formação de Socorrista APH mais prática da Baixada Fluminense: manequins, DEA, prancha e simulações reais, com instrutores enfermeiros que vivem a emergência todos os dias.",
  imagem_hero: "/assets/hero-rcp.jpg",
  carga_horaria: 120,
  formato: "Presencial",
  dias_e_horario_padrao: "Sábados, 09h–16h",
  texto_pratica:
    "Aqui você aprende com a mão na massa — não assistindo slide",
  imagem_pratica: "/assets/pratica-imobilizacao.jpg",
  texto_carreira:
    "O Socorrista APH é requisitado em ambulâncias, eventos, empresas e times de resgate. Com o certificado de 120h verificável, você mostra ao empregador exatamente o que sabe fazer.",
  imagem_carreira: "/assets/socorrista-ambulancia.jpg",
  itens_inclusos: [
    "120 horas de formação presencial completa",
    "Toda a prática com equipamentos inclusa (sem taxa extra)",
    "Material de apoio e apostila do curso",
    "Certificado de 120h com QR code de verificação",
    "Bônus: acesso ao grupo de vagas e indicações da Magma",
  ],
  saidas_profissionais: [
    "🚑 Ambulâncias e remoções",
    "🎤 Eventos, shows e competições",
    "🏭 Brigadas e emergência industrial",
    "⛑️ Caminho para enfermagem e bombeiro civil",
  ],
  habilidades: [
    {
      ordem: 1,
      icone: "rcp",
      titulo: "RCP e DEA",
      descricao:
        "Reanimação em adulto, criança e bebê + uso do desfibrilador — a manobra que mais salva vidas.",
    },
    {
      ordem: 2,
      icone: "trauma",
      titulo: "Atendimento ao trauma",
      descricao:
        "Hemorragias, fraturas, queimaduras e acidentes com múltiplas vítimas (método START).",
    },
    {
      ordem: 3,
      icone: "imobilizacao",
      titulo: "Imobilização e transporte",
      descricao:
        "Prancha, colar cervical, bandagens e a retirada segura da vítima até a ambulância.",
    },
    {
      ordem: 4,
      icone: "clinicas",
      titulo: "Emergências clínicas",
      descricao:
        "Infarto, AVC, convulsão, engasgo (OVACE) e parto de emergência — protocolo por protocolo.",
    },
    {
      ordem: 5,
      icone: "biosseguranca",
      titulo: "Biossegurança e cena",
      descricao:
        "Zona quente, morna e fria, EPIs e avaliação de riscos — proteger você antes de proteger a vítima.",
    },
    {
      ordem: 6,
      icone: "simulacoes",
      titulo: "Simulações reais",
      descricao:
        "Cenários completos do acionamento à entrega da vítima — com pressão de tempo, como na rua.",
    },
  ],
  faqs: [
    {
      ordem: 1,
      pergunta: "Preciso ter formação na área da saúde?",
      resposta:
        "Não. O curso forma você do zero: começa pelos fundamentos e avança até os protocolos completos de APH. É a porta de entrada para a área da saúde.",
    },
    {
      ordem: 2,
      pergunta: "O certificado é reconhecido pelo mercado?",
      resposta:
        "Sim. O certificado informa as 120 horas e traz QR code de verificação — o empregador confirma a autenticidade na hora. Nossos alunos atuam em ambulâncias, eventos, clínicas e remoções.",
    },
    {
      ordem: 3,
      pergunta: "Onde e quando acontecem as aulas?",
      resposta:
        "100% presenciais na unidade da Magma em Olinda, Nilópolis (RJ), aos sábados das 09h às 16h. Recebemos alunos de Nova Iguaçu, Mesquita, São João de Meriti, Belford Roxo, Queimados e Duque de Caxias.",
    },
    {
      ordem: 4,
      pergunta: "E se eu faltar em alguma aula?",
      resposta:
        "Nossa equipe monta com você um plano de reposição para não perder conteúdo — fale com a coordenação pelo WhatsApp.",
    },
    {
      ordem: 5,
      pergunta: "Quais as formas de pagamento?",
      resposta:
        "Cartão de crédito parcelado, PIX à vista com desconto ou boleto. Grupos e ex-alunos têm condições especiais — chame no WhatsApp e consulte.",
    },
  ],
  instrutores: [
    {
      nome: "João Paulo Bello dos Santos",
      registro: "COREN-RJ 525874-ENF",
      especializacao: "Especialista em Enfermagem Neonatal e Pediátrica",
      foto: "/assets/instrutor-dea.jpg",
    },
  ],
  turma_destaque: {
    codigo: "03/2026",
    status: "inscricoes",
    inicio_aulas: "2026-03-07",
    exibir_inicio: true,
    dias_e_horario: "Sábados, 09h–16h",
    vagas_restantes: 8,
    exibir_vagas: true,
    countdown: {
      ate: "2026-08-01T23:59:59-03:00",
      rotulo: "Condição de matrícula antecipada encerra em",
    },
    preco: {
      cheio: 1200.0,
      avista: 990.0,
      parcelas_qtd: 12,
      parcela_valor: 99.0,
      obs: "PIX com desconto à vista",
    },
  },
  fotos: [],
  avaliacoes: [], // vazio → CursoLP usa FALLBACK_DEPOS (regra do doc 04)
  seo: {
    titulo:
      "Curso de Socorrista APH (120h) em Nilópolis e Baixada Fluminense | Magma Cursos",
    descricao:
      "Formação presencial de Socorrista APH — 120h com prática real em manequins, DEA e prancha, instrutores enfermeiros COREN-RJ e certificado com QR code. Aulas aos sábados em Nilópolis, para toda a Baixada Fluminense.",
  },
};
