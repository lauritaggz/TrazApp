import { apiRequest } from "@/lib/apiClient";
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
