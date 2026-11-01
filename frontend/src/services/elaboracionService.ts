import { apiRequest } from "@/lib/apiClient";
import type {
  Elaboracion,
  ElaboracionCreatePayload,
  ElaboracionLista,
  ElaboracionUpdatePayload,
  EstadoElaboracion,
  LoteInsumo,
  UsoPayload,
} from "@/types/elaboracion";

export interface ListElaboracionesParams {
  productoId?: number;
  estado?: EstadoElaboracion;
  /** Inclusive dates (yyyy-mm-dd) over the elaboración date. */
  fechaDesde?: string;
  fechaHasta?: string;
  /** Partial, case-insensitive search over the code. */
  codigo?: string;
  /** Page size (the API default is 20; 1 to 100). */
  limit?: number;
  offset?: number;
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

/** A page of the elaboraciones: `{items, total, limit, offset}` (HU06). */
export async function listElaboraciones(
  params: ListElaboracionesParams = {},
): Promise<ElaboracionLista> {
  const query = new URLSearchParams();
  if (params.productoId !== undefined) query.set("producto_id", String(params.productoId));
  if (params.estado !== undefined) query.set("estado", params.estado);
  if (params.fechaDesde) query.set("fecha_desde", params.fechaDesde);
  if (params.fechaHasta) query.set("fecha_hasta", params.fechaHasta);
  if (params.codigo?.trim()) query.set("codigo", params.codigo.trim());
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<ElaboracionLista>(
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
