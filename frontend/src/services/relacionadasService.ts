import { apiRequest } from "@/lib/apiClient";
import type { ElaboracionesDeInsumo, ElaboracionesDeLote } from "@/types/relacionadas";

/** Elaboraciones (finalizadas and borradores) that used the supply. Read only (HU08). */
export async function getElaboracionesDeInsumo(insumoId: number): Promise<ElaboracionesDeInsumo> {
  return apiRequest<ElaboracionesDeInsumo>(
    `/gestion/insumos/${insumoId}/elaboraciones`,
    { method: "GET" },
    true,
  );
}

/** Elaboraciones that used that lot, plus how many of the same supply cannot be ruled out. Read only. */
export async function getElaboracionesDeLote(
  insumoId: number,
  loteId: number,
): Promise<ElaboracionesDeLote> {
  return apiRequest<ElaboracionesDeLote>(
    `/gestion/insumos/${insumoId}/lotes/${loteId}/elaboraciones`,
    { method: "GET" },
    true,
  );
}
