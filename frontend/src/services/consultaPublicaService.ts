import { apiRequest } from "@/lib/apiClient";
import type { FichaPublica, SeleccionElaboracion } from "@/types/consultaPublica";

/**
 * Ficha of a published product, for any visitor.
 *
 * It NEVER sends the productor's token, even with a session open in the same browser: it calls
 * `apiRequest` as unauthenticated and exposes no way to pass headers or authentication.
 */
export async function obtenerFichaPublica(
  idPublico: string,
  seleccion: SeleccionElaboracion = {},
  signal?: AbortSignal,
): Promise<FichaPublica> {
  const params = new URLSearchParams();
  if (seleccion.codigo !== undefined) params.set("codigo", seleccion.codigo);
  if (seleccion.fecha !== undefined) params.set("fecha", seleccion.fecha);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return apiRequest<FichaPublica>(
    `/publico/productos/${encodeURIComponent(idPublico)}${query}`,
    { cache: "no-store", signal },
    false,
  );
}
