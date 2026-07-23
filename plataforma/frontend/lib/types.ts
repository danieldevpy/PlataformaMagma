/**
 * Tipos espelhando docs/plataforma/03-api-contratos.md (fonte de verdade).
 * Nomes de campos em PT-BR, exatamente como o serializer devolve.
 */

/* ---------- GET /api/site/config/ ---------- */

export interface SiteConfig {
  whatsapp_principal: string;
  instagram: string;
  email: string;
  endereco: string;
  /** null quando não configurado (backend real devolve null + toggle false) */
  nota_google: number | null;
  exibir_nota_google: boolean;
  total_alunos_formados: number | null;
  exibir_total_formados: boolean;
}

/* ---------- GET /api/cursos/ ---------- */

export interface TurmaResumo {
  codigo: string;
  status: string; // ex.: "inscricoes"
}

export interface CursoResumo {
  slug: string;
  nome: string;
  carga_horaria: number;
  subtitulo: string;
  /** ImageField vazio → backend devolve null */
  imagem_hero: string | null;
  turma_destaque: TurmaResumo | null;
}

/* ---------- GET /api/cursos/{slug}/ ---------- */

export interface Habilidade {
  ordem: number;
  icone: string; // chave do mapa de SVGs (ex.: "rcp")
  titulo: string;
  descricao: string;
}

export interface Faq {
  ordem: number;
  pergunta: string;
  resposta: string;
}

export interface FotoCurso {
  ordem: number;
  imagem: string;
  legenda: string;
}

export interface Instrutor {
  nome: string;
  registro: string; // ex.: "COREN-RJ 525874-ENF"
  especializacao: string;
  foto: string | null;
}

export interface Countdown {
  ate: string; // ISO 8601 com offset — ex.: "2026-02-20T23:59:59-03:00"
  rotulo: string;
}

export interface Preco {
  cheio: number;
  avista: number;
  parcelas_qtd: number;
  parcela_valor: number;
  obs: string;
}

export interface TurmaDestaque {
  codigo: string;
  status: string;
  inicio_aulas: string | null; // "2026-03-07"
  exibir_inicio: boolean;
  dias_e_horario: string;
  vagas_restantes: number | null;
  exibir_vagas: boolean;
  /** null quando desativado/expirado — regra vive no serializer */
  countdown: Countdown | null;
  /** null quando exibir_preco=false → front mostra "Consulte condições" */
  preco: Preco | null;
}

export interface Avaliacao {
  nome: string;
  cargo_atual: string;
  estrelas: number;
  comentario: string;
  foto: string | null;
  turma_codigo: string;
}

export interface Seo {
  titulo: string;
  descricao: string;
}

export interface CursoCompleto {
  slug: string;
  nome: string;
  titulo_venda: string;
  /** trecho de titulo_venda destacado com <em> no hero */
  titulo_destaque: string;
  subtitulo: string;
  /** ImageFields vazios → backend devolve null */
  imagem_hero: string | null;
  carga_horaria: number;
  formato: string;
  dias_e_horario_padrao: string;
  texto_pratica: string;
  imagem_pratica: string | null;
  texto_carreira: string;
  imagem_carreira: string | null;
  itens_inclusos: string[];
  saidas_profissionais: string[];
  habilidades: Habilidade[];
  faqs: Faq[];
  fotos: FotoCurso[];
  instrutores: Instrutor[];
  turma_destaque: TurmaDestaque | null;
  avaliacoes: Avaliacao[]; // máx. 6, apenas aprovadas
  seo: Seo;
}

/* ---------- POST /api/leads/ ---------- */

export interface LeadPayload {
  nome: string;
  curso_slug: string;
  quando_pretende: string;
  utm_source?: string;
  utm_campaign?: string;
  pagina_origem?: string;
}

export interface LeadResposta {
  ok: boolean;
  whatsapp_url: string;
}

/* ---------- Magic link de avaliação ---------- */

export type ConviteAvaliacao =
  | {
      valido: true;
      curso: string;
      turma_codigo: string | null;
      nome_aluno: string;
      fotos: FotoCurso[];
    }
  | {
      valido: false;
      motivo: "expirado" | "usado" | "inexistente";
    };

export interface AvaliacaoConvitePayload {
  nome: string;
  estrelas: number;
  comentario: string;
  cargo_atual: string;
}

export interface AvaliacaoConviteResposta {
  ok: boolean;
}

/* ---------- Carteirinha digital (spec 014) ---------- */
/* Duas portas: cadastro (Turma.token_cadastro, aluno novo) e card
 * (Aluno.token, identidade durável) — ver docs/plataforma/03 §Carteirinha. */

export interface MatriculaResumo {
  curso: string;
  turma_codigo: string;
  status: string;
}

/** Card do aluno — mesmo shape no GET do card e na resposta do POST de
 * cadastro (o cadastro devolve o card recém-criado). */
export interface CarteirinhaAluno {
  token: string;
  url: string;
  nome: string;
  cpf: string;
  /** ISO "yyyy-mm-dd" */
  data_nascimento: string | null;
  /** ImageField vazio → backend devolve null */
  foto: string | null;
  codigo_carteirinha: string;
  /** ISO "yyyy-mm-dd" */
  validade_carteirinha: string;
  matriculas: MatriculaResumo[];
}

export type ConviteCarteirinha =
  | ({ valido: true } & CarteirinhaAluno)
  | { valido: false; motivo: "inexistente" };

/** `GET /carteirinha/nova/{turma.token_cadastro}/` — dados pra montar a
 * tela de cadastro de aluno novo. */
export type ConviteCadastroTurma =
  | { valido: true; turma_codigo: string; curso: string }
  | { valido: false; motivo: "inexistente" | "fechada" };

/* ---------- Erros (`{"detail": "mensagem legível"}`) ---------- */

export interface ApiErro {
  detail: string;
}
