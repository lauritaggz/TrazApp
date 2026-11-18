import { apiRequest } from "@/lib/apiClient";
import type { Alternativas, CostosProducto, CostosUpdatePayload } from "@/types/costos";

/** `?insumo=<ingrediente_id>:<insumo_id>`, repetido una vez por ingrediente. Vacío si no hay alternativas. */
export function consultaDeAlternativas(alternativas: Alternativas): string {
  const params = new URLSearchParams();
  for (const [ingredienteId, insumoId] of Object.entries(alternativas)) {
    params.append("insumo", `${ingredienteId}:${insumoId}`);
  }
  const texto = params.toString();
  return texto === "" ? "" : `?${texto}`;
}

/** El cálculo de costos del producto con lo que está guardado; las alternativas solo cambian este cálculo. */
export async function obtenerCostos(
  productoId: number,
  alternativas: Alternativas = {},
  signal?: AbortSignal,
): Promise<CostosProducto> {
  return apiRequest<CostosProducto>(
    `/gestion/productos/${productoId}/costos${consultaDeAlternativas(alternativas)}`,
    { method: "GET", cache: "no-store", signal },
    true,
  );
}

/** Guarda cantidades, rendimiento y otros costos, y devuelve el cálculo ya recalculado. */
export async function guardarCostos(
  productoId: number,
  payload: CostosUpdatePayload,
  alternativas: Alternativas = {},
): Promise<CostosProducto> {
  return apiRequest<CostosProducto>(
    `/gestion/productos/${productoId}/costos${consultaDeAlternativas(alternativas)}`,
    { method: "PUT", body: JSON.stringify(payload) },
    true,
  );
}
