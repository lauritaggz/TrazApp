import { apiRequest } from "@/lib/apiClient";
import type { FichaPublica, SeleccionElaboracion } from "@/types/consultaPublica";
import type { Publicacion } from "@/types/product";

/** Enable the publication (idempotent). 409 `detail.faltantes` lists every missing requirement. */
export async function habilitarPublicacion(productoId: number): Promise<Publicacion> {
  return apiRequest<Publicacion>(
    `/gestion/productos/${productoId}/publicacion`,
    { method: "POST" },
    true,
  );
}

/** Disable the publication (idempotent). The public id and the link are kept. */
export async function deshabilitarPublicacion(productoId: number): Promise<Publicacion> {
  return apiRequest<Publicacion>(
    `/gestion/productos/${productoId}/publicacion`,
    { method: "DELETE" },
    true,
  );
}

/**
 * The ficha the consumer WOULD see for the productor's product, published or not (CA10).
 * Authenticated, unlike the public consultation. Same response shape; it writes nothing.
 */
export async function previsualizarFichaPublica(
  productoId: number,
  seleccion: SeleccionElaboracion = {},
  signal?: AbortSignal,
): Promise<FichaPublica> {
  const params = new URLSearchParams();
  if (seleccion.codigo !== undefined) params.set("codigo", seleccion.codigo);
  if (seleccion.fecha !== undefined) params.set("fecha", seleccion.fecha);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return apiRequest<FichaPublica>(
    `/gestion/productos/${productoId}/vista-publica${query}`,
    { method: "GET", cache: "no-store", signal },
    true,
  );
}
