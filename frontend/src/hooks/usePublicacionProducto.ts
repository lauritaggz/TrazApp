import { useRef, useState } from "react";
import { useToast } from "@/components/ui/toastContext";
import { deshabilitarPublicacion, habilitarPublicacion } from "@/services/publicacionService";
import { ApiError } from "@/types/auth";
import type { Product, Publicacion } from "@/types/product";

export const MENSAJE_RED = "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
export const MENSAJE_GENERICO = "No pudimos completar la operación. Inténtalo de nuevo.";

interface Opciones {
  productoId: number;
  /** The new publication state, to merge into the product the page shows. */
  onChange: (cambios: Partial<Product>) => void;
  /** The API says the product does not exist (or is not the productor's). */
  onNotFound: () => void;
}

/** The requisitos the 409 reports, in the order the API sends them. */
function faltantesDe(error: ApiError): string[] {
  const detalle = error.detail;
  if (!detalle || typeof detalle !== "object") return [];
  const faltantes = (detalle as { faltantes?: unknown }).faltantes;
  return Array.isArray(faltantes) ? faltantes.filter((f): f is string => typeof f === "string") : [];
}

/**
 * Enable / disable the publication of ONE product (HU09). Shared by the list and the detail of
 * Publicaciones: the 409 with its faltantes, the confirmation before disabling and the guard
 * against a double submit live here, once.
 */
export function usePublicacionProducto({ productoId, onChange, onNotFound }: Opciones) {
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const enCurso = useRef(false);
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  async function ejecutar(accion: () => Promise<Publicacion>, aviso: string) {
    if (enCurso.current) return;
    enCurso.current = true;
    setBusy(true);
    setError("");
    try {
      const estado = await accion();
      setFaltantes([]);
      onChange({
        publicado: estado.publicado,
        id_publico: estado.id_publico,
        publicado_en: estado.publicado_en,
        url_publica: estado.url_publica,
      });
      notify(aviso);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        onNotFound();
        return;
      }
      if (err instanceof ApiError && err.status === 409 && faltantesDe(err).length > 0) {
        setFaltantes(faltantesDe(err));
        return;
      }
      setError(err instanceof ApiError && err.status === 0 ? MENSAJE_RED : MENSAJE_GENERICO);
    } finally {
      enCurso.current = false;
      setBusy(false);
      setConfirmando(false);
    }
  }

  return {
    busy,
    faltantes,
    error,
    confirmando,
    habilitar: () => ejecutar(() => habilitarPublicacion(productoId), "Publicación habilitada."),
    pedirDeshabilitar: () => setConfirmando(true),
    confirmarDeshabilitar: () =>
      ejecutar(() => deshabilitarPublicacion(productoId), "Publicación deshabilitada."),
    cancelarDeshabilitar: () => {
      if (!enCurso.current) setConfirmando(false);
    },
  };
}
