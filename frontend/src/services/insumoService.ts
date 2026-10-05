import { apiRequest } from "@/lib/apiClient";
import type {
  AlergenoDeclarado,
  Insumo,
  InsumoCreatePayload,
  InsumoUpdatePayload,
  TipoDeclaracion,
} from "@/types/insumo";

interface ListInsumosParams {
  /** Backend default is active supplies only; false asks for the inactive ones. */
  activo?: boolean;
  ingredienteId?: number;
}

export async function listInsumos(params: ListInsumosParams = {}): Promise<Insumo[]> {
  const query = new URLSearchParams();
  if (params.activo !== undefined) query.set("activo", String(params.activo));
  if (params.ingredienteId !== undefined) {
    query.set("ingrediente_id", String(params.ingredienteId));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<Insumo[]>(`/gestion/insumos${suffix}`, { method: "GET" }, true);
}

export async function getInsumo(id: number): Promise<Insumo> {
  return apiRequest<Insumo>(`/gestion/insumos/${id}`, { method: "GET" }, true);
}

export async function createInsumo(payload: InsumoCreatePayload): Promise<Insumo> {
  return apiRequest<Insumo>(
    "/gestion/insumos",
    { method: "POST", body: JSON.stringify(payload) },
    true,
  );
}

export async function updateInsumo(
  id: number,
  payload: InsumoUpdatePayload,
): Promise<Insumo> {
  return apiRequest<Insumo>(
    `/gestion/insumos/${id}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    true,
  );
}

/** DELETE deactivates (soft delete); the supply stays viewable and can be reactivated. */
export async function deactivateInsumo(id: number): Promise<void> {
  return apiRequest<void>(`/gestion/insumos/${id}`, { method: "DELETE" }, true);
}

export async function reactivateInsumo(id: number): Promise<Insumo> {
  return updateInsumo(id, { activo: true });
}

export async function listInsumoAlergenos(insumoId: number): Promise<AlergenoDeclarado[]> {
  return apiRequest<AlergenoDeclarado[]>(
    `/gestion/insumos/${insumoId}/alergenos`,
    { method: "GET" },
    true,
  );
}

export async function addInsumoAlergeno(
  insumoId: number,
  alergenoId: number,
  tipo: TipoDeclaracion,
): Promise<AlergenoDeclarado> {
  return apiRequest<AlergenoDeclarado>(
    `/gestion/insumos/${insumoId}/alergenos`,
    { method: "POST", body: JSON.stringify({ alergeno_id: alergenoId, tipo }) },
    true,
  );
}

export async function updateInsumoAlergenoTipo(
  insumoId: number,
  alergenoId: number,
  tipo: TipoDeclaracion,
): Promise<AlergenoDeclarado> {
  return apiRequest<AlergenoDeclarado>(
    `/gestion/insumos/${insumoId}/alergenos/${alergenoId}`,
    { method: "PATCH", body: JSON.stringify({ tipo }) },
    true,
  );
}

export async function deleteInsumoAlergeno(
  insumoId: number,
  alergenoId: number,
): Promise<void> {
  return apiRequest<void>(
    `/gestion/insumos/${insumoId}/alergenos/${alergenoId}`,
    { method: "DELETE" },
    true,
  );
}
