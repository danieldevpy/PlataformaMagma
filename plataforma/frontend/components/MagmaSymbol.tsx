/**
 * Símbolo oficial Magma (Estrela da Vida) — renderizado UMA vez no layout raiz.
 * Path extraído fielmente de landing-page/cursos/socorrista-aph/index.html
 * (mesmo desenho de design-system/assets/simbolo-magma.svg).
 *
 * Uso nos demais componentes:
 *   <svg width="38" height="42"><use href="#magma-sym" /></svg>
 */
export default function MagmaSymbol() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden="true"
    >
      <defs>
        <symbol id="magma-sym" viewBox="0 0 100 110">
          <polygon
            points="50,8 90,31 90,79 50,102 10,79 10,31"
            fill="#232c3d"
            stroke="#232c3d"
            strokeWidth="12"
            strokeLinejoin="round"
          />
          <polygon
            points="50,15 84.5,35 84.5,75 50,95 15.5,75 15.5,35"
            fill="#fff"
            stroke="#fff"
            strokeWidth="7"
            strokeLinejoin="round"
          />
          <polygon
            points="50,19 81,37 81,73 50,91 19,73 19,37"
            fill="#c8102e"
            stroke="#c8102e"
            strokeWidth="7"
            strokeLinejoin="round"
          />
          <g transform="translate(50,55)">
            <g fill="#fff">
              <rect x="-9" y="-27" width="18" height="54" rx="3.5" />
              <rect
                x="-9"
                y="-27"
                width="18"
                height="54"
                rx="3.5"
                transform="rotate(60)"
              />
              <rect
                x="-9"
                y="-27"
                width="18"
                height="54"
                rx="3.5"
                transform="rotate(-60)"
              />
            </g>
            <g fill="#1d4f91">
              <rect x="-6.4" y="-24.4" width="12.8" height="48.8" rx="2.4" />
              <rect
                x="-6.4"
                y="-24.4"
                width="12.8"
                height="48.8"
                rx="2.4"
                transform="rotate(60)"
              />
              <rect
                x="-6.4"
                y="-24.4"
                width="12.8"
                height="48.8"
                rx="2.4"
                transform="rotate(-60)"
              />
            </g>
            <circle cx="0" cy="-17.5" r="3.1" fill="#fff" />
            <rect x="-1.7" y="-15" width="3.4" height="33" rx="1.7" fill="#fff" />
            <path
              d="M-5 -10 C 6 -7.5, 6 -3.5, 0 -1.5 C -6 0.5, -6 4.5, 0 6.5 C 5 8.2, 5 11.5, -3 13.5"
              fill="none"
              stroke="#fff"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </g>
        </symbol>
      </defs>
    </svg>
  );
}
