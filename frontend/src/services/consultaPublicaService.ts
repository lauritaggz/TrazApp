import { apiRequest } from "@/lib/apiClient";
import type { FichaPublica, SeleccionElaboracion } from "@/types/consultaPublica";

/**
 * Anonymous answer to «¿Esta información te resultó útil?» (HU11).
 *
 * Like the consultation, it NEVER sends the productor's token: only the signed consultation token
 * that came with the ficha and the answer. Errors keep their status (409 already answered, 422 the
 * token is not valid or expired, 404 not available, 0 network).
 */
export async function enviarEvaluacion(idPublico: string, token: string, util: boolean): Promise<void> {
  await apiRequest<{ registrada: boolean }>(
    `/publico/productos/${encodeURIComponent(idPublico)}/evaluaciones`,
    { method: "POST", body: JSON.stringify({ token, util }), cache: "no-store" },
    false,
  );
}

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
