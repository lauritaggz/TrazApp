import { apiRequest } from "@/lib/apiClient";
import type {
  Elaboracion,
  ElaboracionCreatePayload,
  ElaboracionResumen,
  ElaboracionUpdatePayload,
  EstadoElaboracion,
  LoteInsumo,
  UsoPayload,
} from "@/types/elaboracion";

interface ListElaboracionesParams {
  productoId?: number;
  estado?: EstadoElaboracion;
}

export async function getCodigoSugerido(productoId: number): Promise<{ codigo: string }> {
  return apiRequest<{ codigo: string }>(
    `/gestion/productos/${productoId}/elaboraciones/codigo-sugerido`,
    { method: "GET" },
    true,
  );
}

/** Creates a borrador from the current formulation; code and date default on the server. */
export async function createElaboracion(
  productoId: number,
  payload: ElaboracionCreatePayload = {},
): Promise<Elaboracion> {
  return apiRequest<Elaboracion>(
    `/gestion/productos/${productoId}/elaboraciones`,
    { method: "POST", body: JSON.stringify(payload) },
    true,
  );
}

export async function listElaboraciones(
  params: ListElaboracionesParams = {},
): Promise<ElaboracionResumen[]> {
  const query = new URLSearchParams();
  if (params.productoId !== undefined) query.set("producto_id", String(params.productoId));
  if (params.estado !== undefined) query.set("estado", params.estado);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<ElaboracionResumen[]>(
    `/gestion/elaboraciones${suffix}`,
    { method: "GET" },
    true,
  );
}

export async function getElaboracion(id: number): Promise<Elaboracion> {
  return apiRequest<Elaboracion>(`/gestion/elaboraciones/${id}`, { method: "GET" }, true);
}

export async function updateElaboracion(
  id: number,
  payload: ElaboracionUpdatePayload,
): Promise<Elaboracion> {
  return apiRequest<Elaboracion>(
    `/gestion/elaboraciones/${id}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    true,
  );
}

/** Replaces the whole assignment of supplies and lots: one entry per ingredient. */
export async function replaceUsos(id: number, usos: UsoPayload[]): Promise<Elaboracion> {
  return apiRequest<Elaboracion>(
    `/gestion/elaboraciones/${id}/usos`,
    { method: "PUT", body: JSON.stringify({ usos }) },
    true,
  );
}

export async function deleteElaboracion(id: number): Promise<void> {
  return apiRequest<void>(`/gestion/elaboraciones/${id}`, { method: "DELETE" }, true);
}

export async function finalizarElaboracion(id: number): Promise<Elaboracion> {
  return apiRequest<Elaboracion>(
    `/gestion/elaboraciones/${id}/finalizar`,
    { method: "POST" },
    true,
  );
}

export async function listLotesInsumo(insumoId: number): Promise<LoteInsumo[]> {
  return apiRequest<LoteInsumo[]>(`/gestion/insumos/${insumoId}/lotes`, { method: "GET" }, true);
}
