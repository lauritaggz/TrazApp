/**
 * What went wrong with the camera, in words the productor can act on (HU13 / T13-02, CA05).
 *
 * The scanner hook exposes the raw error; this turns it into one of five cases, each with its message
 * and whether trying again can help. The manual entry of the code is always offered next to it.
 */

/** The page cannot ask for the camera at all: it is not a secure context (HTTPS) or lacks the API. */
export class ContextoInseguroError extends Error {
  constructor() {
    super("La cámara requiere una conexión segura (HTTPS).");
    this.name = "ContextoInseguroError";
  }
}

export type TipoErrorCamara =
  | "permiso_denegado"
  | "sin_camara"
  | "camara_ocupada"
  | "contexto_inseguro"
  | "otro";

export interface PresentacionErrorCamara {
  mensaje: string;
  /** Whether "Intentar de nuevo" can change the outcome. */
  reintentable: boolean;
}

// Names of the standard DOMExceptions of getUserMedia, plus the legacy names older browsers use.
const PERMISO_DENEGADO = new Set(["NotAllowedError", "SecurityError", "PermissionDeniedError"]);
const SIN_CAMARA = new Set([
  "NotFoundError",
  "OverconstrainedError",
  "DevicesNotFoundError",
  "ConstraintNotSatisfiedError",
]);
const CAMARA_OCUPADA = new Set(["NotReadableError", "AbortError", "TrackStartError"]);

function nombreDelError(error: unknown): string {
  if (typeof error === "object" && error !== null && "name" in error) {
    const { name } = error as { name: unknown };
    return typeof name === "string" ? name : "";
  }
  return "";
}

export function clasificarErrorCamara(error: unknown): TipoErrorCamara {
  if (error instanceof ContextoInseguroError) return "contexto_inseguro";
  const nombre = nombreDelError(error);
  if (PERMISO_DENEGADO.has(nombre)) return "permiso_denegado";
  if (SIN_CAMARA.has(nombre)) return "sin_camara";
  if (CAMARA_OCUPADA.has(nombre)) return "camara_ocupada";
  return "otro";
}

export const ERRORES_CAMARA: Record<TipoErrorCamara, PresentacionErrorCamara> = {
  permiso_denegado: {
    mensaje:
      "El navegador no tiene permiso para usar la cámara. Para habilitarlo, toca el candado junto a la dirección del sitio, abre los permisos y permite la cámara; luego vuelve a abrir el escáner. Mientras tanto, ingresa el número del código de barras.",
    reintentable: false,
  },
  sin_camara: {
    mensaje:
      "No encontramos una cámara disponible en este dispositivo. Ingresa el número del código de barras.",
    reintentable: false,
  },
  camara_ocupada: {
    mensaje:
      "La cámara está en uso por otra aplicación. Ciérrala e inténtalo de nuevo, o ingresa el número del código de barras.",
    reintentable: true,
  },
  contexto_inseguro: {
    mensaje:
      "La cámara solo funciona en una conexión segura (HTTPS). Abre TrazApp desde una dirección que empiece con https:// o ingresa el número del código de barras.",
    reintentable: false,
  },
  otro: {
    mensaje:
      "No pudimos usar la cámara. Inténtalo de nuevo o ingresa el número del código de barras.",
    reintentable: true,
  },
};
