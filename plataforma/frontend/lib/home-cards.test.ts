import { describe, expect, it } from "vitest";

import { HOME_CARDS, mesclarCards, opcoesCursoHome } from "./home-cards";
import type { CursoResumo } from "./types";

function curso(overrides: Partial<CursoResumo> = {}): CursoResumo {
  return {
    slug: "curso-teste",
    nome: "Curso Teste",
    carga_horaria: 40,
    subtitulo: "Subtítulo do curso teste.",
    imagem_hero: null,
    turma_destaque: null,
    ...overrides,
  };
}

describe("mesclarCards", () => {
  it("sem cursos da API devolve os cards estáticos intocados", () => {
    const resultado = mesclarCards([]);
    expect(resultado).toHaveLength(HOME_CARDS.length);
    expect(resultado[0]).toEqual(HOME_CARDS[0]);
  });

  it("curso da API com slug conhecido sobrescreve horas/desc/cta do card estático", () => {
    const resultado = mesclarCards([
      curso({ slug: "socorrista-aph", carga_horaria: 130, subtitulo: "Novo texto." }),
    ]);
    const card = resultado.find((c) => c.slug === "socorrista-aph");
    expect(card?.horas).toBe("130h");
    expect(card?.desc).toBe("Novo texto.");
    expect(card?.cta).toEqual({
      tipo: "link",
      href: "/cursos/socorrista-aph/",
      label: "Ver o curso completo",
    });
    // resto do card estático (chip, facts, destaque) não muda.
    expect(card?.chip).toBe("Carro-chefe");
    expect(card?.destaque).toBe(true);
  });

  it("curso da API sem card estático correspondente vira card extra", () => {
    const resultado = mesclarCards([
      curso({
        slug: "curso-novo",
        nome: "Curso Novo",
        turma_destaque: { codigo: "T1", status: "inscricoes" },
      }),
    ]);
    const extra = resultado.find((c) => c.slug === "curso-novo");
    expect(extra).toBeDefined();
    expect(extra?.chip).toBe("Matrículas abertas");
    expect(extra?.cta).toEqual({
      tipo: "link",
      href: "/cursos/curso-novo/",
      label: "Ver o curso completo",
    });
  });

  it("curso extra sem turma em inscrições vira chip genérico 'Curso'", () => {
    const resultado = mesclarCards([curso({ slug: "curso-parado" })]);
    const extra = resultado.find((c) => c.slug === "curso-parado");
    expect(extra?.chip).toBe("Curso");
  });

  it("card 'in-company' (slug null) nunca é mesclado", () => {
    const resultado = mesclarCards([curso({ slug: "socorrista-aph" })]);
    const inCompany = resultado.find((c) => c.nome === "Treinamentos sob medida");
    expect(inCompany?.slug).toBeNull();
    expect(inCompany?.cta.tipo).toBe("wa");
  });
});

describe("opcoesCursoHome", () => {
  it("sem cursos da API usa a lista estática (com a opção in-company no fim)", () => {
    const opcoes = opcoesCursoHome([]);
    expect(opcoes[0]).toEqual({ slug: "socorrista-aph", label: "Socorrista APH (120h)" });
    expect(opcoes[opcoes.length - 1]).toEqual({
      slug: "",
      label: "Treinamento para empresa/escola (Lei Lucas)",
    });
  });

  it("com cursos da API, monta a partir deles + opção in-company", () => {
    const opcoes = opcoesCursoHome([curso({ slug: "x", nome: "Curso X", carga_horaria: 30 })]);
    expect(opcoes).toEqual([
      { slug: "x", label: "Curso X (30h)" },
      { slug: "", label: "Treinamento para empresa/escola (Lei Lucas)" },
    ]);
  });
});
