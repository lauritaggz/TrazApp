import { listAlergenosCatalog } from "@/lib/alergenoCatalog";
import { apiRequest } from "@/lib/apiClient";
import type {
  Alergeno,
  ComposicionComponente,
  ComposicionComponenteCreatePayload,
  ComposicionComponenteUpdatePayload,
  Ingrediente,
  IngredienteCreatePayload,
  IngredienteUpdatePayload,
} from "@/types/ingredient";

export async function listIngredients(): Promise<Ingrediente[]> {
  return apiRequest<Ingrediente[]>("/gestion/ingredientes", { method: "GET" }, true);
}

export async function getIngredient(id: number): Promise<Ingrediente> {
  return apiRequest<Ingrediente>(
    `/gestion/ingredientes/${id}`,
    { method: "GET" },
    true,
  );
}

export async function createIngredient(
  payload: IngredienteCreatePayload,
): Promise<Ingrediente> {
  return apiRequest<Ingrediente>(
    "/gestion/ingredientes",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function updateIngredient(
  id: number,
  payload: IngredienteUpdatePayload,
): Promise<Ingrediente> {
  return apiRequest<Ingrediente>(
    `/gestion/ingredientes/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function deleteIngredient(id: number): Promise<void> {
  return apiRequest<void>(
    `/gestion/ingredientes/${id}`,
    { method: "DELETE" },
    true,
  );
}

export async function listIngredientComposition(
  ingredienteId: number,
): Promise<ComposicionComponente[]> {
  return apiRequest<ComposicionComponente[]>(
    `/gestion/ingredientes/${ingredienteId}/composicion`,
    { method: "GET" },
    true,
  );
}

export async function addCompositionComponent(
  ingredienteId: number,
  payload: ComposicionComponenteCreatePayload,
): Promise<ComposicionComponente> {
  return apiRequest<ComposicionComponente>(
    `/gestion/ingredientes/${ingredienteId}/composicion`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function updateCompositionComponent(
  ingredienteId: number,
  composicionId: number,
  payload: ComposicionComponenteUpdatePayload,
): Promise<ComposicionComponente> {
  return apiRequest<ComposicionComponente>(
    `/gestion/ingredientes/${ingredienteId}/composicion/${composicionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function deleteCompositionComponent(
  ingredienteId: number,
  composicionId: number,
): Promise<void> {
  return apiRequest<void>(
    `/gestion/ingredientes/${ingredienteId}/composicion/${composicionId}`,
    { method: "DELETE" },
    true,
  );
}

export async function listIngredientAllergens(
  ingredienteId: number,
): Promise<Alergeno[]> {
  return apiRequest<Alergeno[]>(
    `/gestion/ingredientes/${ingredienteId}/alergenos`,
    { method: "GET" },
    true,
  );
}

export async function addIngredientAllergen(
  ingredienteId: number,
  alergenoId: number,
): Promise<Alergeno> {
  return apiRequest<Alergeno>(
    `/gestion/ingredientes/${ingredienteId}/alergenos`,
    {
      method: "POST",
      body: JSON.stringify({ alergeno_id: alergenoId }),
    },
    true,
  );
}

export async function deleteIngredientAllergen(
  ingredienteId: number,
  alergenoId: number,
): Promise<void> {
  return apiRequest<void>(
    `/gestion/ingredientes/${ingredienteId}/alergenos/${alergenoId}`,
    { method: "DELETE" },
    true,
  );
}

export { listAlergenosCatalog };
