/* ============================================================
   MAGMA MARCA — contatos oficiais, hashtags e legenda com variáveis
   (JS puro, sem libs, sem build — mesmo padrão de templates-engine.js).

   Consumido pelo Studio (spec 003-studio-templates-campanha, T1) pra
   preencher a legenda padrão de cada template sem digitação manual
   (critério de aceite do gestor: "gera feed+story e publica — sem
   digitar nada além de ajustes finos"). Fonte da verdade dos dados:
   design-system/AGENTS.md §1 (contatos) e §8 (tom de voz); hashtags por
   curso: docs/subsistemas/07b-social-maker-manus.md §5.

   -------------------------------------------------------------
   FORMATO — window.MagmaMarca:

   {
     contatos: {
       instagram: "@magma_curso",
       instagramUrl: "https://instagram.com/magma_curso",
       whatsapp: ["(21) 97976-7821", "(21) 96494-6079"],
       whatsappUrls: ["https://wa.me/5521979767821", "https://wa.me/5521964946079"],
       email: "curso.magma21@gmail.com",
       endereco: "Rua Nossa Senhora de Fátima, 495, Olinda, Nilópolis/RJ",
       cidade: "Nilópolis/RJ",
       cnpj: "48.330.206/0001-06",
     },
     hashtagsFixas: ["#MagmaCursos", "#NovaIguacu"],
     hashtagsPorCurso: { "socorrista-aph": [...], ... },   // chave = slug do curso
     frasesModelo: ["Sua carreira na saúde começa com prática de verdade", ...],

     // Monta a string de hashtags de um curso: fixas + específicas do slug
     // (slug desconhecido ou vazio → só as fixas).
     hashtagsCurso(cursoSlug) -> "#MagmaCursos #NovaIguacu #SocorristaAPH ..."

     // Substitui variáveis num texto de legenda. contexto = {
     //   curso: "Socorrista APH",       // nome de exibição do curso
     //   cursoSlug: "socorrista-aph",   // slug (resolve {{hashtags_curso}})
     //   turma: "T24",                  // código da turma
     //   dataInicio: "2026-08-08" | Date | "",  // início das aulas
     // }
     // Variáveis suportadas no texto: {{curso}} {{turma}} {{data_inicio}}
     // {{hashtags_curso}}. Variável sem dado correspondente vira "" (nunca
     // deixa "{{...}}" cru na legenda publicada).
     resolverLegenda(texto, contexto) -> string
   }
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- Contatos oficiais (AGENTS.md §1) ---------- */
  var WHATSAPP_NUMEROS = ['(21) 97976-7821', '(21) 96494-6079'];

  var CONTATOS = {
    instagram: '@magma_curso',
    instagramUrl: 'https://instagram.com/magma_curso',
    whatsapp: WHATSAPP_NUMEROS.slice(),
    whatsappUrls: WHATSAPP_NUMEROS.map(function (numero) {
      return 'https://wa.me/55' + numero.replace(/\D/g, '');
    }),
    email: 'curso.magma21@gmail.com',
    endereco: 'Rua Nossa Senhora de Fátima, 495, Olinda, Nilópolis/RJ',
    cidade: 'Nilópolis/RJ',
    cnpj: '48.330.206/0001-06',
  };

  /* ---------- Hashtags ---------- */
  var HASHTAGS_FIXAS = ['#MagmaCursos', '#NovaIguacu'];

  // Chave = slug real do curso (ver plataforma/frontend/lib/home-cards.ts).
  var HASHTAGS_POR_CURSO = {
    'socorrista-aph': ['#SocorristaAPH', '#APH120h', '#AtendimentoPreHospitalar'],
    'puncao-venosa': ['#PuncaoVenosa', '#ICVP'],
    'cuidador-de-idosos': ['#CuidadorDeIdosos', '#CuidadoComIdosos'],
    'auxiliar-de-farmacia': ['#AuxiliarDeFarmacia'],
    'bombeiro-mirim': ['#BombeiroMirim'],
  };

  function hashtagsCurso(cursoSlug) {
    var especificas = HASHTAGS_POR_CURSO[cursoSlug] || [];
    return HASHTAGS_FIXAS.concat(especificas).join(' ');
  }

  /* ---------- Frases-modelo (tom de voz, AGENTS.md §8) ---------- */
  var FRASES_MODELO = [
    'Sua carreira na saúde começa com prática de verdade',
    'Turmas aos sábados, feitas para quem trabalha',
    'Certificado que o empregador confirma na hora',
  ];

  /* ---------- Legenda com variáveis ---------- */

  // Aceita "YYYY-MM-DD" (o que a API manda), objeto Date, ou já formatada
  // — sempre devolve "DD/MM/AAAA" em pt-BR (ou "" se não der pra formatar).
  function formatarData(bruto) {
    if (!bruto) return '';
    if (bruto instanceof Date) {
      if (isNaN(bruto.getTime())) return '';
      return brDeDate(bruto);
    }
    var texto = String(bruto).trim();
    var isoMatch = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return isoMatch[3] + '/' + isoMatch[2] + '/' + isoMatch[1];
    }
    // Já veio em outro formato (ex.: "08/08/2026") — devolve como está.
    return texto;
  }

  function brDeDate(data) {
    var dia = String(data.getDate()).padStart(2, '0');
    var mes = String(data.getMonth() + 1).padStart(2, '0');
    return dia + '/' + mes + '/' + data.getFullYear();
  }

  var VARIAVEIS = {
    curso: function (contexto) {
      return contexto.curso || '';
    },
    turma: function (contexto) {
      return contexto.turma || '';
    },
    data_inicio: function (contexto) {
      return formatarData(contexto.dataInicio);
    },
    hashtags_curso: function (contexto) {
      return hashtagsCurso(contexto.cursoSlug || '');
    },
  };

  // Substitui {{variavel}} (com espaços opcionais dentro das chaves) por
  // seu valor resolvido no contexto; variável desconhecida ou sem dado
  // vira string vazia — nunca deixa "{{...}}" cru na legenda publicada.
  function resolverLegenda(texto, contexto) {
    if (!texto) return '';
    var ctx = contexto || {};
    return String(texto).replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, function (match, nome) {
      var resolver = VARIAVEIS[nome];
      return resolver ? resolver(ctx) : '';
    });
  }

  global.MagmaMarca = {
    contatos: CONTATOS,
    hashtagsFixas: HASHTAGS_FIXAS.slice(),
    hashtagsPorCurso: HASHTAGS_POR_CURSO,
    frasesModelo: FRASES_MODELO.slice(),
    hashtagsCurso: hashtagsCurso,
    resolverLegenda: resolverLegenda,
  };
})(window);
