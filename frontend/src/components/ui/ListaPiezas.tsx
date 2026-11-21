import type { ReactNode } from "react";

/*
 * Piezas compartidas de los listados (HT08, «Cuaderno de campo»): la ficha con la inicial,
 * la flecha de las filas y los estados vacío o de error dentro de un listado.
 */

/** Ficha cuadrada con la inicial del registro, sobre trigo. */
export function FichaInicial({ nombre }: { nombre: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wheat font-display text-base font-bold text-accent-strong transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] group-hover:-rotate-6"
    >
      {nombre.trim().charAt(0).toUpperCase() || "·"}
    </span>
  );
}

/** Flecha al final de una fila: se desliza un poco al pasar el cursor. */
export function FlechaFila() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block text-text-muted transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/** Etiqueta discreta (por ejemplo, el ingrediente de un insumo). */
export function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center whitespace-nowrap rounded-md bg-panel px-2 text-[12.5px] font-medium text-text-secondary">
      {children}
    </span>
  );
}

/** Bloque para «no hay resultados», «no pudimos cargar» y similares dentro de un listado. */
export function AvisoLista({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-wheat-deep bg-panel px-6 py-10 text-center">
      <h2 className="mb-2 text-lg font-bold text-text-primary">{title}</h2>
      {description && (
        <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-text-secondary">{description}</p>
      )}
      {action}
    </div>
  );
}
