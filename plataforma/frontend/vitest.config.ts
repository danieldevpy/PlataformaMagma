import { defineConfig } from "vitest/config";

/**
 * Runner de testes da lógica pura (lib/*, rotas de API) — spec 001 (backend)
 * ampliada pro frontend. Sem jsdom/Testing Library de propósito: cobre só
 * módulos sem DOM (formatação, merge de dados, JSON-LD, fetch wrapper,
 * webhook de revalidação). Testes de componente/E2E ficam pra spec futura
 * (ver docs/plataforma/README.md §Como rodar os testes).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
