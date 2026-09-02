import { clearAccessToken, getAccessToken } from "@/lib/tokenStorage";
import { ApiError } from "@/types/auth";

const FRIENDLY_FIELD_MESSAGES: Record<string, string> = {
  codigo_interno: "Revisa el código interno.",
  nombre: "Revisa el nombre.",
  descripcion: "Revisa la descripción.",
  contenido_neto: "Revisa el contenido neto.",
  unidad_medida: "Revisa la unidad de medida.",
  presentacion: "Revisa la presentación.",
  costo_produccion: "Revisa el costo de producción.",
  precio_venta: "Revisa el precio de venta.",
  categoria_ids: "Revisa las categorías seleccionadas.",
  tipo: "Revisa el tipo de ingrediente.",
  alergeno_id: "Revisa el alérgeno seleccionado.",
};

export function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new ApiError(
      "No se pudo conectar con el servidor. Intenta de nuevo más tarde.",
      0,
    );
  }
  return baseUrl;
}

function extractFieldErrors(detail: unknown): Record<string, string> {
  if (!Array.isArray(detail)) {
    return {};
  }

  const fieldErrors: Record<string, string> = {};
  for (const item of detail) {
    if (!item || typeof item !== "object") continue;
    const loc = (item as { loc?: unknown }).loc;
    if (!Array.isArray(loc)) continue;

    const field = loc
      .filter((part): part is string => typeof part === "string")
      .filter((part) => part !== "body")
      .at(-1);
    if (!field || fieldErrors[field]) continue;

    fieldErrors[field] =
      FRIENDLY_FIELD_MESSAGES[field] ?? "Revisa este campo.";
  }
  return fieldErrors;
}

async function parseError(response: Response): Promise<ApiError> {
  let detail: unknown;
  try {
    const body = (await response.json()) as { detail?: unknown };
    detail = body.detail;
  } catch {
    detail = undefined;
  }

  if (response.status === 401) {
    return new ApiError("Credenciales inválidas", 401);
  }
  if (response.status === 409) {
    const message =
      typeof detail === "string" ? detail : "El recurso ya existe";
    return new ApiError(message, 409);
  }
  if (response.status === 422) {
    const message =
      typeof detail === "string" ? detail : "Revisa los datos enviados.";
    return new ApiError(message, 422, extractFieldErrors(detail));
  }

  return new ApiError(
    "No se pudo completar la operación. Intenta de nuevo más tarde.",
    response.status,
  );
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  authenticated = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (authenticated) {
    const token = getAccessToken();
    if (!token) {
      throw new ApiError("No autenticado", 401);
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      "No se pudo conectar con el servidor. Intenta de nuevo más tarde.",
      0,
    );
  }

  if (!response.ok) {
    if (authenticated && response.status === 401) {
      clearAccessToken();
      throw new ApiError("Tu sesión ha expirado. Inicia sesión nuevamente.", 401);
    }
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
