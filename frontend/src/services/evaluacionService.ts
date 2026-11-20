import { apiRequest } from "@/lib/apiClient";
import type { ResultadosEvaluacion } from "@/types/product";

/** Results of the anonymous «¿te resultó útil?» for the productor's product (HU11, T11-03). Authenticated. */
export async function obtenerResultadosEvaluacion(productoId: number): Promise<ResultadosEvaluacion> {
  return apiRequest<ResultadosEvaluacion>(
    `/gestion/productos/${productoId}/evaluaciones`,
    { method: "GET", cache: "no-store" },
    true,
  );
}
