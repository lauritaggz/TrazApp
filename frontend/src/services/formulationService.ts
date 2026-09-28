import { apiRequest } from "@/lib/apiClient";
import type {
  FormulacionGuardada,
  FormulacionReemplazoPayload,
  FormulacionVigente,
} from "@/types/formulation";

export async function getProductFormulation(
  productoId: number,
): Promise<FormulacionVigente> {
  return apiRequest<FormulacionVigente>(
    `/gestion/productos/${productoId}/formulacion`,
    { method: "GET" },
    true,
  );
}

export async function saveProductFormulation(
  productoId: number,
  payload: FormulacionReemplazoPayload,
): Promise<FormulacionGuardada> {
  return apiRequest<FormulacionGuardada>(
    `/gestion/productos/${productoId}/formulacion`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    true,
  );
}
