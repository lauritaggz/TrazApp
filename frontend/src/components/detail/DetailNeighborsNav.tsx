import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import type { Vecino, Vecinos } from "@/types/vecinos";

const BOTON =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium text-text-primary";
const ACTIVO = "hover:bg-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
const INACTIVO = "cursor-not-allowed opacity-50";

interface DetailNeighborsNavProps {
  /** From `useDetailNeighbors`. Null: nothing to show yet, or the request failed. */
  vecinos: Vecinos | null;
  /** True while the neighbours of the current record are on the way: links stay but are disabled. */
  cargando: boolean;
  /** Where each neighbour opens: `${rutaBase}/${id}`, e.g. "/productos". */
  rutaBase: string;
  /** Accessible name of the <nav>, e.g. "Navegación entre productos". */
  etiqueta: string;
}

/**
 * «Anterior» / «Siguiente» of a detail page (HT08, CA8–CA10), the same for every resource.
 *
 * Each neighbour is a link named «Anterior: <nombre>». While the new neighbours load, the same links stay
 * in place (so the focus is not lost) with aria-disabled and the click blocked. A real end (no neighbour)
 * is a non-focusable aria-disabled span. Render it OUTSIDE the page's loading block.
 */
export default function DetailNeighborsNav({ vecinos, cargando, rutaBase, etiqueta }: DetailNeighborsNavProps) {
  if (vecinos === null) return null;
  return (
    <nav aria-label={etiqueta} className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
      <Vecino direccion="Anterior" vecino={vecinos.anterior} cargando={cargando} rutaBase={rutaBase} />
      <Vecino direccion="Siguiente" vecino={vecinos.siguiente} cargando={cargando} rutaBase={rutaBase} />
    </nav>
  );
}

function Vecino({
  direccion,
  vecino,
  cargando,
  rutaBase,
}: {
  direccion: "Anterior" | "Siguiente";
  vecino: Vecino | null;
  cargando: boolean;
  rutaBase: string;
}) {
  const contenido =
    direccion === "Anterior" ? (
      <>
        <span aria-hidden="true">‹</span> Anterior
      </>
    ) : (
      <>
        Siguiente <span aria-hidden="true">›</span>
      </>
    );

  if (vecino === null) {
    return (
      <span aria-disabled="true" className={`${BOTON} ${INACTIVO}`}>
        {contenido}
      </span>
    );
  }

  const bloquear = (evento: MouseEvent<HTMLAnchorElement>) => {
    if (cargando) evento.preventDefault();
  };

  return (
    <Link
      to={`${rutaBase}/${vecino.id}`}
      aria-label={cargando ? direccion : `${direccion}: ${vecino.nombre}`}
      aria-disabled={cargando ? "true" : undefined}
      onClick={bloquear}
      className={`${BOTON} ${cargando ? INACTIVO : ACTIVO}`}
    >
      {contenido}
    </Link>
  );
}
