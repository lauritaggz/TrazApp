import { apiRequest } from "@/lib/apiClient";
import type { ConsultaCodigo, ResultadoBusquedaNombre } from "@/types/consultaCodigo";
import type {
  AlergenoDeclarado,
  AlergenoDeclaradoInput,
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

/**
 * Looks a barcode up in the product source (HU13). It only reads: nothing is registered. 200 with
 * `encontrado` true or false; 409 if the productor already has the code; 422 if it is not valid;
 * 503 if the source cannot answer.
 */
export async function consultarCodigoBarras(codigo: string): Promise<ConsultaCodigo> {
  return apiRequest<ConsultaCodigo>(
    `/gestion/insumos/consulta-codigo/${encodeURIComponent(codigo)}`,
    { method: "GET" },
    true,
  );
}

/**
 * Hits of the search by name or brand in Jumbo (HU07). It only reads. 200 with the hits (maybe none);
 * 422 if the text is too short or long; 503 if the source cannot answer.
 */
export async function buscarPorNombre(texto: string): Promise<ResultadoBusquedaNombre[]> {
  return apiRequest<ResultadoBusquedaNombre[]>(
    `/gestion/insumos/busqueda?texto=${encodeURIComponent(texto)}`,
    { method: "GET" },
    true,
  );
}

/**
 * The proposal for one hit of the search by name, with the format of the barcode lookup (HU07). It only
 * reads. 409 if the productor already has its barcode; 404 if the product is gone; 503 if Jumbo is down.
 */
export async function consultarResultadoDeBusqueda(id: string): Promise<ConsultaCodigo> {
  return apiRequest<ConsultaCodigo>(
    `/gestion/insumos/busqueda/${encodeURIComponent(id)}`,
    { method: "GET" },
    true,
  );
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

/**
 * Replaces the whole list of declared allergens and records the review (HT06). An empty list means
 * "reviewed, no allergens".
 */
export async function replaceInsumoAlergenos(
  insumoId: number,
  alergenos: AlergenoDeclaradoInput[],
): Promise<Insumo> {
  return apiRequest<Insumo>(
    `/gestion/insumos/${insumoId}/alergenos`,
    { method: "PUT", body: JSON.stringify({ alergenos }) },
    true,
  );
}
