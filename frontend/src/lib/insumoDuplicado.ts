import type { ApiError } from "@/types/auth";
import type { InsumoDuplicateInfo } from "@/types/insumo";

/**
 * The existing supply behind a 409 for a repeated barcode: `{mensaje, insumo_id, activo}`, from both
 * `POST /gestion/insumos` and the barcode lookup. Null if the 409 is about something else.
 */
export function duplicadoDe(error: ApiError): InsumoDuplicateInfo | null {
  const detail = error.detail as { insumo_id?: unknown; activo?: unknown } | undefined;
  if (!detail || typeof detail.insumo_id !== "number") return null;
  return {
    insumoId: detail.insumo_id,
    activo: detail.activo !== false,
    mensaje: error.message,
  };
}
