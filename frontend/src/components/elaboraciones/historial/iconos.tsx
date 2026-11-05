import type { ReactNode } from "react";

function Icono({ children, size = 16, grosor = 2 }: { children: ReactNode; size?: number; grosor?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** Capas: el total de elaboraciones. */
export function CapasIcon({ size }: { size?: number }) {
  return (
    <Icono size={size}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 12 12 17 22 12" />
      <polyline points="2 17 12 22 22 17" />
    </Icono>
  );
}

/** Check: una elaboración finalizada. */
export function CheckIcon({ size }: { size?: number }) {
  return (
    <Icono size={size} grosor={2.3}>
      <polyline points="20 6 9 17 4 12" />
    </Icono>
  );
}

/** Lápiz: un borrador. */
export function LapizIcon({ size }: { size?: number }) {
  return (
    <Icono size={size}>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Icono>
  );
}

export function FlechaDerechaIcon({ size }: { size?: number }) {
  return (
    <Icono size={size}>
      <polyline points="9 18 15 12 9 6" />
    </Icono>
  );
}

export function ChevronIcon({ abierto }: { abierto: boolean }) {
  return (
    <span aria-hidden="true" className={`inline-flex transition-transform duration-200 motion-reduce:transition-none ${abierto ? "rotate-180" : ""}`}>
      <Icono size={14}>
        <polyline points="6 9 12 15 18 9" />
      </Icono>
    </span>
  );
}
