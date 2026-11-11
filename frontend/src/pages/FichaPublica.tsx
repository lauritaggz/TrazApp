import { useCallback } from "react";
import { useParams } from "react-router-dom";
import FichaVista from "@/components/fichaPublica/FichaVista";
import { useNoIndex } from "@/hooks/useNoIndex";
import { obtenerFichaPublica } from "@/services/consultaPublicaService";
import type { SeleccionElaboracion } from "@/types/consultaPublica";

/** Public ficha of a product (HU10): no account, no productor menu, and the productor's token is
 *  never sent (see `consultaPublicaService`). The view itself is shared with the preview. */
export default function FichaPublica() {
  useNoIndex();
  const { idPublico = "" } = useParams();
  const cargar = useCallback(
    (seleccion: SeleccionElaboracion, signal: AbortSignal) => obtenerFichaPublica(idPublico, seleccion, signal),
    [idPublico],
  );
  return <FichaVista fuente={idPublico} cargar={cargar} rutaBase={`/p/${encodeURIComponent(idPublico)}`} />;
}
