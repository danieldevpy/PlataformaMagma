/**
 * Helpers de formatação pt-BR usados pelos componentes da LP.
 * Rodam no servidor (server components) — sem dependência de browser.
 */

/** "2026-03-07" → "07 de março" (como no HTML original). */
export function fmtDataInicio(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  }).format(d);
}

/** "2026-03-07" → "MARÇO" (barra de urgência: "Turma de MARÇO"). */
export function mesMaiusculo(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" })
    .format(d)
    .toUpperCase();
}

/** 1200 → "R$ 1.200" · 99.9 → "R$ 99,90" (sem centavos quando inteiro). */
export function fmtMoeda(valor: number): string {
  const inteiro = Number.isInteger(valor);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: inteiro ? 0 : 2,
    maximumFractionDigits: inteiro ? 0 : 2,
  }).format(valor);
}

/** "5521964946079" → "(21) 96494-6079" (exibição no footer). */
export function fmtTelefone(e164: string): string {
  const m = e164.replace(/\D/g, "").match(/^55(\d{2})(\d{5})(\d{4})$/);
  if (!m) return e164;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

/** "Marcos Ribeiro" → "MR" (avatar dos depoimentos). */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}

/** 8 → "08" (vagas na barra de urgência, como no HTML original). */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/* ---- horas por extenso (feminino) — "120 (Cento e Vinte) horas" ---- */

const UNIDADES = ["", "Uma", "Duas", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove"];
const DEZ_A_DEZENOVE = ["Dez", "Onze", "Doze", "Treze", "Quatorze", "Quinze", "Dezesseis", "Dezessete", "Dezoito", "Dezenove"];
const DEZENAS = ["", "", "Vinte", "Trinta", "Quarenta", "Cinquenta", "Sessenta", "Setenta", "Oitenta", "Noventa"];
const CENTENAS = ["", "Cento", "Duzentas", "Trezentas", "Quatrocentas", "Quinhentas", "Seiscentas", "Setecentas", "Oitocentas", "Novecentas"];

/** 120 → "Cento e Vinte" · 40 → "Quarenta" (miniatura do certificado). */
export function horasPorExtenso(n: number): string {
  if (!Number.isInteger(n) || n <= 0 || n > 999) return String(n);
  if (n === 100) return "Cem";

  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);

  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(" e ");
}
