import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconoFlechaIzquierda } from "@/components/insumos/piezasBusqueda";

interface EncabezadoNuevoInsumoProps {
  /** Where the back button goes and what it says: «Volver a Insumos» on the first screen, «Volver al inicio» after. */
  volver: { to: string; texto: string } | { onClick: () => void; texto: string };
  /** The label above the title; «Nuevo insumo» by default («Editar insumo» when editing). */
  etiqueta?: string;
  /** To the right of the title (the sources used, in the review). */
  derecha?: ReactNode;
  /** The step after «Nuevo insumo» in the label («Búsqueda», «Revisión final»). */
  paso?: string;
  titulo: string;
  descripcion: string;
}

/**
 * The header of the screens of "Nuevo insumo" (HU07), as in the design: a back button, the label «Nuevo
 * insumo» (the page's h1, in the label style of the design), the title as h2 and a line of help. It
 * replaces the breadcrumbs of the other pages.
 */
export default function EncabezadoNuevoInsumo({
  volver,
  etiqueta = "Nuevo insumo",
  paso,
  titulo,
  descripcion,
  derecha,
}: EncabezadoNuevoInsumoProps) {
  const claseVolver =
    "-ml-3 mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
  return (
    <header>
      {"to" in volver ? (
        <Link to={volver.to} className={claseVolver}>
          <IconoFlechaIzquierda />
          {volver.texto}
        </Link>
      ) : (
        <button type="button" onClick={volver.onClick} className={claseVolver}>
          <IconoFlechaIzquierda />
          {volver.texto}
        </button>
      )}
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
       <div>
        <div className="mb-1 flex flex-wrap items-baseline gap-x-1.5">
          <h1 className="text-xs font-semibold text-brand-600">{etiqueta}</h1>
          {paso && <span className="text-xs font-semibold text-brand-600">· {paso}</span>}
        </div>
        <h2 className="text-2xl font-semibold text-text-primary">{titulo}</h2>
        <p className="mt-1 max-w-2xl text-sm text-text-secondary">{descripcion}</p>
       </div>
       {derecha}
      </div>
    </header>
  );
}
