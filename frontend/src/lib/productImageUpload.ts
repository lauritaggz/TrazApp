import { getApiBaseUrl } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/tokenStorage";
import { ApiError } from "@/types/auth";
import type { Product } from "@/types/product";

export function resolveProductImageUrl(imagenUrl: string | null): string | null {
  if (!imagenUrl?.trim()) return null;
  if (imagenUrl.startsWith("http://") || imagenUrl.startsWith("https://")) {
    return imagenUrl;
  }
  return `${getApiBaseUrl()}${imagenUrl}`;
}

export async function uploadProductImage(
  productId: number,
  file: File,
): Promise<Product> {
  const token = getAccessToken();
  if (!token) {
    throw new ApiError("No autenticado", 401);
  }

  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    response = await fetch(
      `${getApiBaseUrl()}/gestion/productos/${productId}/imagen`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: formData,
      },
    );
  } catch {
    throw new ApiError(
      "No se pudo conectar con el servidor. Intenta de nuevo más tarde.",
      0,
    );
  }

  if (!response.ok) {
    let detail: unknown;
    try {
      const body = (await response.json()) as { detail?: unknown };
      detail = body.detail;
    } catch {
      detail = undefined;
    }

    if (response.status === 422) {
      const message =
        typeof detail === "string"
          ? detail
          : "No pudimos subir la imagen. Revisa el archivo.";
      throw new ApiError(message, 422);
    }

    if (response.status === 404) {
      throw new ApiError("Producto no encontrado.", 404);
    }

    throw new ApiError(
      "No pudimos subir la imagen. Inténtalo nuevamente.",
      response.status,
    );
  }

  return (await response.json()) as Product;
}
