import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Pieces shared by the screens of "Nuevo insumo" (HU07): the first screen, the search by barcode and the
 * search by name. They follow the design of "docs/diseno/DISEÑOS SPRINT 3/" (NewSupply.tsx).
 */

const trazo = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

type IconoProps = { size?: number };

export function IconoFlechaIzquierda({ size = 15 }: IconoProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...trazo}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function IconoFlechaDerecha({ size = 14 }: IconoProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...trazo}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function IconoEscaner({ size = 23 }: IconoProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...trazo}>
      <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 8v8M12 8v8M17 8v8" />
    </svg>
  );
}

export function IconoBusqueda({ size = 22 }: IconoProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...trazo}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.7" y2="16.7" />
    </svg>
  );
}

export function IconoLapiz({ size = 21 }: IconoProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...trazo}>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function IconoEscudo({ size = 15 }: IconoProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...trazo}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

export function IconoBaseDeDatos({ size = 14 }: IconoProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...trazo}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" />
    </svg>
  );
}

export function IconoTienda({ size = 14 }: IconoProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...trazo}>
      <path d="M3 9l2-6h14l2 6" />
      <path d="M5 13v8h14v-8M9 21v-6h6v6" />
      <path d="M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0" />
    </svg>
  );
}

export function IconoCopiar({ size = 16 }: IconoProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...trazo}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

export function IconoAlerta({ size = 15 }: IconoProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...trazo}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function IconoCargando({ size = 23 }: IconoProps) {
  return (
    <svg aria-hidden="true" className="animate-pulse" width={size} height={size} viewBox="0 0 24 24" {...trazo}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" />
    </svg>
  );
}

const BASE_BOTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 select-none";
const VARIANTES = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
  secondary: "border border-border bg-card text-text-primary hover:bg-surface active:bg-brand-50",
  ghost: "text-accent hover:bg-brand-50 active:bg-brand-100",
} as const;

/** A link that looks like a button of the design system (a navigation is a link, not a button). */
export function EnlaceBoton({
  to,
  variant = "secondary",
  className = "",
  children,
}: {
  to: string;
  variant?: keyof typeof VARIANTES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={`${BASE_BOTON} ${VARIANTES[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export type ModoDeBusqueda = "codigo" | "nombre";

/** «Código de barras» / «Nombre o marca»: the two ways of searching, as the design's segmented control. */
export function PestanasDeBusqueda({ modo }: { modo: ModoDeBusqueda }) {
  const base =
    "inline-flex min-h-11 items-center rounded-md px-3.5 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";
  const activa = "bg-card text-text-primary shadow-sm";
  const inactiva = "text-text-secondary hover:text-text-primary";
  return (
    <nav aria-label="Método de búsqueda" className="mb-5 flex w-fit rounded-lg bg-surface p-1">
      <Link
        to="/insumos/nuevo/codigo"
        aria-current={modo === "codigo" ? "page" : undefined}
        className={`${base} ${modo === "codigo" ? activa : inactiva}`}
      >
        Código de barras
      </Link>
      <Link
        to="/insumos/nuevo/nombre"
        aria-current={modo === "nombre" ? "page" : undefined}
        className={`${base} ${modo === "nombre" ? activa : inactiva}`}
      >
        Nombre o marca
      </Link>
    </nav>
  );
}

/** One source in the strip that shows where the search goes. */
export function PasoDeFuente({ icono, nombre, detalle }: { icono: ReactNode; nombre: string; detalle: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-brand-600">{icono}</span>
      <div>
        <p className="text-xs font-semibold text-text-primary">{nombre}</p>
        <p className="text-xs text-text-secondary">{detalle}</p>
      </div>
    </div>
  );
}

/** «Tú mantienes el control»: nothing is registered without the productor's confirmation (CA9). */
export function NotaDeControl() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
      <span className="mt-0.5 text-text-secondary">
        <IconoEscudo />
      </span>
      <div>
        <p className="text-xs font-semibold text-text-primary">Tú mantienes el control</p>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          La información recuperada solo completa un borrador. Puedes corregirla y nada se incorpora a tu catálogo
          sin tu confirmación.
        </p>
      </div>
    </div>
  );
}

/** What the search area shows before anything was searched. */
export function EstadoVacioDeBusqueda({
  icono,
  titulo,
  texto,
}: {
  icono: ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        {icono}
      </span>
      <p className="text-sm font-semibold text-text-primary">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-text-secondary">{texto}</p>
    </div>
  );
}
