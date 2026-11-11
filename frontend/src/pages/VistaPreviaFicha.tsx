import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BarraVistaPrevia from "@/components/fichaPublica/BarraVistaPrevia";
import FichaVista from "@/components/fichaPublica/FichaVista";
import { getProduct } from "@/services/productService";
import { previsualizarFichaPublica } from "@/services/publicacionService";
import { ApiError } from "@/types/auth";
import type { SeleccionElaboracion } from "@/types/consultaPublica";

function parseProductId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const PRODUCTO_NO_ENCONTRADO = {
  etiqueta: "Producto no encontrado",
  titulo: "No encontramos este producto",
  descripcion: "Puede que haya sido eliminado o que no sea uno de tus productos. Vuelve a Publicaciones.",
};

/** The productor's preview of the public ficha, before (or without) publishing (CA10).
 *  Same view as the consumer's (`FichaVista`); only the data source differs: authenticated. */
export default function VistaPreviaFicha() {
  const { productoId: rawId } = useParams();
  const productoId = parseProductId(rawId);
  // Publication state of THIS product (null while unknown); derived, so a product change never shows the previous state.
  const [estado, setEstado] = useState<{ id: number; publicado: boolean } | null>(null);
  const publicado = estado !== null && estado.id === productoId ? estado.publicado : null;

  useEffect(() => {
    if (productoId === null) return;
    let vigente = true;
    getProduct(productoId)
      .then((producto) => {
        if (vigente) setEstado({ id: productoId, publicado: producto.publicado === true });
      })
      .catch(() => {
        if (vigente) setEstado(null);
      });
    return () => {
      vigente = false;
    };
  }, [productoId]);

  const cargar = useCallback(
    (seleccion: SeleccionElaboracion, signal: AbortSignal) =>
      productoId === null
        ? Promise.reject(new ApiError("Producto no encontrado", 404))
        : previsualizarFichaPublica(productoId, seleccion, signal),
    [productoId],
  );
  const rutaPublicacion = productoId === null ? "/publicaciones" : `/publicaciones/${productoId}`;

  return (
    <FichaVista
      fuente={`vista-previa-${productoId ?? "invalido"}`}
      cargar={cargar}
      rutaBase={`${rutaPublicacion}/vista-previa`}
      barraSuperior={<BarraVistaPrevia publicado={publicado} volverA={rutaPublicacion} />}
      prefijoTitulo="Vista previa"
      estado404={PRODUCTO_NO_ENCONTRADO}
    />
  );
}
