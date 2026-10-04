import { apiRequest } from "@/lib/apiClient";
import type {
  FormulacionGuardada,
  FormulacionLinea,
  FormulacionReemplazoPayload,
  FormulacionVigente,
  VersionProductoHistorial,
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

export async function listProductVersions(
  productoId: number,
): Promise<VersionProductoHistorial[]> {
  return apiRequest<VersionProductoHistorial[]>(
    `/gestion/productos/${productoId}/versiones`,
    { method: "GET" },
    true,
  );
}

export async function getVersionFormulation(
  productoId: number,
  versionId: number,
): Promise<FormulacionLinea[]> {
  return apiRequest<FormulacionLinea[]>(
    `/gestion/productos/${productoId}/versiones/${versionId}/formulacion`,
    { method: "GET" },
    true,
  );
}
