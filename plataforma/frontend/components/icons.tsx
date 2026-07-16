import type { ReactNode } from "react";

/**
 * SVGs inline extraídos fielmente da LP atual
 * (landing-page/cursos/socorrista-aph/index.html).
 */

/** Check "m5 12 5 5L20 7" — usado em listas de benefícios em toda a LP. */
export function Check({
  size = 18,
  stroke = "#dcb96a",
  width = 2.5,
}: {
  size?: number;
  stroke?: string;
  width?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={width}
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

/* ---- Mapa icone → SVG dos cards de habilidade (24x24, dourado) ---- */

function skillSvg(children: ReactNode) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#dcb96a"
      strokeWidth="2"
    >
      {children}
    </svg>
  );
}

export const SKILL_ICONS: Record<string, ReactNode> = {
  rcp: skillSvg(
    <>
      <path d="M20.4 12.6a2 2 0 0 0 0-2.8L13.5 3a2 2 0 0 0-2.9 0L3.7 9.8a2 2 0 0 0 0 2.8l6.9 6.9a2 2 0 0 0 2.9 0Z" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>,
  ),
  trauma: skillSvg(<path d="M12 2v20M2 12h20" />),
  imobilizacao: skillSvg(
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M12 8V4M8 4h8" />
    </>,
  ),
  clinicas: skillSvg(<path d="M22 12h-4l-3 9L9 3l-3 9H2" />),
  biosseguranca: skillSvg(
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  ),
  simulacoes: skillSvg(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>,
  ),
};

/** Ícone padrão quando a chave `icone` do backend não está no mapa. */
export const SKILL_ICON_DEFAULT = SKILL_ICONS.clinicas;
