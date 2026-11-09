import { apiRequest } from "@/lib/apiClient";
import type { ElaboracionVisibilidad } from "@/types/elaboracion";

/** Hide a finalized elaboración from the public consultation (idempotent; a borrador answers 409). */
export async function ocultarElaboracion(id: number): Promise<ElaboracionVisibilidad> {
  return apiRequest<ElaboracionVisibilidad>(`/gestion/elaboraciones/${id}/ocultar`, { method: "POST" }, true);
}

/** Show it again (idempotent). */
export async function mostrarElaboracion(id: number): Promise<ElaboracionVisibilidad> {
  return apiRequest<ElaboracionVisibilidad>(`/gestion/elaboraciones/${id}/mostrar`, { method: "POST" }, true);
}
