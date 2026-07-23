import { describe, expect, it } from "vitest";

import {
  fmtDataInicio,
  fmtMoeda,
  fmtTelefone,
  horasPorExtenso,
  iniciais,
  mesMaiusculo,
  pad2,
} from "./format";

// Intl às vezes usa espaço normal, às vezes NBSP ( ) dependendo da ICU
// do runtime — normaliza antes de comparar pra não depender disso.
const semNbsp = (s: string) => s.replace(/ /g, " ");

describe("fmtDataInicio", () => {
  it("formata data ISO em UTC, sem deslocar de fuso", () => {
    expect(fmtDataInicio("2026-03-07")).toBe("07 de março");
  });
});

describe("mesMaiusculo", () => {
  it("devolve o mês em maiúsculas", () => {
    expect(mesMaiusculo("2026-03-07")).toBe("MARÇO");
  });

  it("funciona pra qualquer mês do ano", () => {
    expect(mesMaiusculo("2026-12-25")).toBe("DEZEMBRO");
  });
});

describe("fmtMoeda", () => {
  it("valor inteiro não mostra centavos", () => {
    expect(semNbsp(fmtMoeda(1200))).toBe("R$ 1.200");
  });

  it("valor quebrado mostra 2 casas decimais", () => {
    expect(semNbsp(fmtMoeda(99.9))).toBe("R$ 99,90");
  });
});

describe("fmtTelefone", () => {
  it("formata E.164 BR (55 + DDD + 9 dígitos)", () => {
    expect(fmtTelefone("5521979767821")).toBe("(21) 97976-7821");
  });

  it("devolve o valor original quando não casa o padrão", () => {
    expect(fmtTelefone("12345")).toBe("12345");
  });
});

describe("iniciais", () => {
  it("pega a primeira letra do primeiro e do último nome", () => {
    expect(iniciais("Marcos Ribeiro")).toBe("MR");
  });

  it("nome com 3+ partes ignora os do meio", () => {
    expect(iniciais("Ana Paula Souza")).toBe("AS");
  });

  it("nome único usa só a primeira letra", () => {
    expect(iniciais("Marcos")).toBe("M");
  });

  it("string vazia não quebra", () => {
    expect(iniciais("")).toBe("");
  });
});

describe("pad2", () => {
  it("preenche com zero à esquerda quando < 10", () => {
    expect(pad2(8)).toBe("08");
  });

  it("mantém 2 dígitos como está", () => {
    expect(pad2(12)).toBe("12");
  });
});

describe("horasPorExtenso", () => {
  it("caso do docstring: 120 → Cento e Vinte", () => {
    expect(horasPorExtenso(120)).toBe("Cento e Vinte");
  });

  it("caso do docstring: 40 → Quarenta", () => {
    expect(horasPorExtenso(40)).toBe("Quarenta");
  });

  it("100 é caso especial: Cem (não 'Uma Cento')", () => {
    expect(horasPorExtenso(100)).toBe("Cem");
  });

  it("11-19 usam a forma irregular (Onze, não 'Dez e Um')", () => {
    expect(horasPorExtenso(11)).toBe("Onze");
    expect(horasPorExtenso(19)).toBe("Dezenove");
  });

  it("dezena exata não tem 'e' sobrando", () => {
    expect(horasPorExtenso(20)).toBe("Vinte");
  });

  it("gênero feminino nas unidades (Uma, não Um) — 'horas' concorda", () => {
    expect(horasPorExtenso(21)).toBe("Vinte e Uma");
    expect(horasPorExtenso(8)).toBe("Oito");
  });

  it("centena + dezena + unidade encadeadas", () => {
    expect(horasPorExtenso(999)).toBe("Novecentas e Noventa e Nove");
  });

  it("centena exata sem resto", () => {
    expect(horasPorExtenso(200)).toBe("Duzentas");
  });

  it("fora do intervalo suportado cai no fallback numérico", () => {
    expect(horasPorExtenso(0)).toBe("0");
    expect(horasPorExtenso(-5)).toBe("-5");
    expect(horasPorExtenso(1000)).toBe("1000");
  });

  it("não-inteiro cai no fallback numérico", () => {
    expect(horasPorExtenso(12.5)).toBe("12.5");
  });
});
