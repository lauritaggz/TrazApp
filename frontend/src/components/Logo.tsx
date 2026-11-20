/*
 * Logotipo «la z que une» (HT08): «trazapp» en minúsculas, con la z dibujada
 * como un recorrido entre un punto lleno (el origen) y uno abierto (quien consume).
 * El punto abierto no lleva relleno: el trazo termina en su borde, así funciona
 * sobre cualquier fondo.
 */

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light";
  /** Muestra el símbolo (la z sobre un cuadrado verde) delante del nombre. */
  withSymbol?: boolean;
}

const SIZES = {
  sm: { text: "text-xl", symbol: 28 },
  md: { text: "text-2xl", symbol: 32 },
  lg: { text: "text-3xl", symbol: 40 },
} as const;

export default function Logo({
  size = "md",
  variant = "dark",
  withSymbol = false,
}: LogoProps) {
  const word = variant === "dark" ? "text-text-primary" : "text-on-brand";
  const zColor = variant === "dark" ? "text-accent" : "text-on-brand-accent";

  return (
    <div className="flex items-center gap-2.5">
      {withSymbol && <TrazSymbol size={SIZES[size].symbol} />}
      <span
        className={`font-display leading-none font-extrabold tracking-[-0.05em] ${SIZES[size].text} ${word}`}
      >
        <span className="sr-only">TrazApp</span>
        <span aria-hidden="true">
          tra
          <ZMark className={zColor} />
          app
        </span>
      </span>
    </div>
  );
}

function ZMark({ className }: { className: string }) {
  return (
    <svg
      className={`inline-block ${className}`}
      style={{ height: "1em", width: "0.8em", verticalAlign: "-0.2em", margin: "0 -0.02em" }}
      viewBox="0 0 32 40"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {/* La z ocupa la altura x de Bricolage (≈0.53em) y apoya en la línea base. */}
      <path d="M4 14H25L5 29H21.2" strokeWidth="6.2" />
      <circle cx="26" cy="29" r="3.4" strokeWidth="3.4" />
    </svg>
  );
}

/** Símbolo cuadrado: la misma z sobre el verde de marca. */
export function TrazSymbol({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <rect width="48" height="48" rx="12" className="fill-brand-600" />
      <g
        className="stroke-on-brand"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 14.5H33.5L14.5 33.5H30.4" strokeWidth="3.8" />
        <circle cx="13" cy="14.5" r="4.4" className="fill-on-brand" stroke="none" />
        <circle cx="35" cy="33.5" r="4.2" strokeWidth="3" />
      </g>
    </svg>
  );
}
