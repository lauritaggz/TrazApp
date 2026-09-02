import { apiRequest } from "@/lib/apiClient";
import { ApiError } from "@/types/auth";
import type { Alergeno } from "@/types/ingredient";

/** EU reference list — matches backend migration 009_seed_alergenos order. */
export const ALERGENOS_CATALOGO_REFERENCIA: readonly {
  codigo: string;
  nombre: string;
}[] = [
  { codigo: "gluten", nombre: "Gluten" },
  { codigo: "crustaceos", nombre: "Crustáceos" },
  { codigo: "huevos", nombre: "Huevos" },
  { codigo: "pescado", nombre: "Pescado" },
  { codigo: "cacahuetes", nombre: "Cacahuetes" },
  { codigo: "soja", nombre: "Soja" },
  { codigo: "lacteos", nombre: "Lácteos" },
  { codigo: "frutos_cascara", nombre: "Frutos de cáscara" },
  { codigo: "apio", nombre: "Apio" },
  { codigo: "mostaza", nombre: "Mostaza" },
  { codigo: "sesamo", nombre: "Sésamo" },
  { codigo: "sulfitos", nombre: "Sulfitos" },
  { codigo: "altramuces", nombre: "Altramuces" },
  { codigo: "moluscos", nombre: "Moluscos" },
] as const;

function catalogFromSeedReference(): Alergeno[] {
  return ALERGENOS_CATALOGO_REFERENCIA.map((item, index) => ({
    id: index + 1,
    codigo: item.codigo,
    nombre: item.nombre,
  }));
}

/**
 * Read-only global allergen catalog.
 * Uses GET /gestion/alergenos when available; otherwise falls back to the
 * seeded EU list with sequential IDs (migration 009).
 */
export async function listAlergenosCatalog(): Promise<Alergeno[]> {
  try {
    return await apiRequest<Alergeno[]>("/gestion/alergenos", { method: "GET" }, true);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
      return catalogFromSeedReference();
    }
    throw error;
  }
}
