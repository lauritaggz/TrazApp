import { getApiBaseUrl, parseError } from "@/lib/apiClient";
import { nombreDeContentDisposition, type FormatoQr } from "@/lib/qrArchivo";
import { clearAccessToken, getAccessToken } from "@/lib/tokenStorage";
import { ApiError } from "@/types/auth";

export interface ArchivoQr {
  blob: Blob;
  /** The name the API suggests (Content-Disposition), or null when the page cannot read that header. */
  nombre: string | null;
}

/**
 * The QR of a published product (HU09). The endpoint needs the token, so a plain link cannot be
 * used: the image is fetched with it and handed over as a Blob.
 */
export async function obtenerQr(productoId: number, formato: FormatoQr): Promise<ArchivoQr> {
  const token = getAccessToken();
  if (!token) throw new ApiError("No autenticado", 401);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/gestion/productos/${productoId}/qr?formato=${formato}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor. Intenta de nuevo más tarde.", 0);
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAccessToken();
      throw new ApiError("Tu sesión ha expirado. Inicia sesión nuevamente.", 401);
    }
    throw await parseError(response);
  }

  return {
    blob: await response.blob(),
    nombre: nombreDeContentDisposition(response.headers.get("Content-Disposition")),
  };
}
