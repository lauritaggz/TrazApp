import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { getProductNeighbors } from "@/services/productService";
import type { ProductoVecino, ProductoVecinos } from "@/types/product";

const BOTON =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium text-text-primary";
const ACTIVO = "hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
const INACTIVO = "cursor-not-allowed opacity-50";

type Respuesta = { productoId: number; vecinos: ProductoVecinos | null };

/**
 * «Anterior» / «Siguiente» of the product detail (HT08, CA8–CA10): the neighbours in the default order
 * of the list («Más recientes», no search or filters), so «Siguiente» goes to an older product.
 *
 * The page stays mounted when moving to another product. While the new neighbours load, the same
 * links stay in place (so the focus is not lost) but are aria-disabled and do not navigate; an answer
 * for a previous product is discarded. A real end (no neighbour) is a non-focusable aria-disabled span.
 * If the neighbours cannot be loaded, the navigation is not shown: it is a secondary control.
 */
export default function ProductNeighborsNav({ productoId }: { productoId: number }) {
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);

  useEffect(() => {
    let vigente = true;
    getProductNeighbors(productoId).then(
      (vecinos) => {
        if (vigente) setRespuesta({ productoId, vecinos });
      },
      () => {
        if (vigente) setRespuesta({ productoId, vecinos: null });
      },
    );
    return () => {
      vigente = false;
    };
  }, [productoId]);

  if (respuesta === null) return null;
  const cargando = respuesta.productoId !== productoId;
  // Until the current product answers, keep drawing the last neighbours (disabled).
  const vecinos = respuesta.vecinos;
  if (vecinos === null) return null;

  return (
    <nav aria-label="Navegación entre productos" className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
      <Vecino direccion="Anterior" vecino={vecinos.anterior} cargando={cargando} />
      <Vecino direccion="Siguiente" vecino={vecinos.siguiente} cargando={cargando} />
    </nav>
  );
}

function Vecino({
  direccion,
  vecino,
  cargando,
}: {
  direccion: "Anterior" | "Siguiente";
  vecino: ProductoVecino | null;
  cargando: boolean;
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
      to={`/productos/${vecino.id}`}
      aria-label={cargando ? direccion : `${direccion}: ${vecino.nombre}`}
      aria-disabled={cargando ? "true" : undefined}
      onClick={bloquear}
      className={`${BOTON} ${cargando ? INACTIVO : ACTIVO}`}
    >
      {contenido}
    </Link>
  );
}
