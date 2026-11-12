import { useCallback, useEffect, useState } from "react";
import { getElaboracionesDeInsumo, getElaboracionesDeLote } from "@/services/relacionadasService";
import { ApiError } from "@/types/auth";
import type { ResultadoRelacionadas } from "@/types/relacionadas";

export type EstadoRelacionadas =
  | { fase: "inicial" }
  | { fase: "cargando" }
  | { fase: "ok"; datos: ResultadoRelacionadas }
  | { fase: "no_encontrado" }
  | { fase: "error" };

/**
 * The elaboraciones related to a supply, or to one of its lots (HU08). Without a supply nothing is asked.
 * A 404 is told apart by the status code (the API answers with a text `detail`, which `parseError` does not
 * read for a 404); any other failure is an error that can be retried with `recargar`.
 */
export function useElaboracionesRelacionadas(insumoId: number | null, loteId: number | null) {
  const [recarga, setRecarga] = useState(0);
  // The answer is kept with the request it belongs to: while the current request has no answer, the state is
  // «cargando» (derived, not set inside the effect).
  const [respuesta, setRespuesta] = useState<{ clave: string; estado: EstadoRelacionadas } | null>(null);
  const clave = `${insumoId}:${loteId}:${recarga}`;

  useEffect(() => {
    if (insumoId === null) return;
    let vigente = true;
    const pedido =
      loteId === null ? getElaboracionesDeInsumo(insumoId) : getElaboracionesDeLote(insumoId, loteId);
    pedido.then(
      (datos) => {
        if (vigente) setRespuesta({ clave, estado: { fase: "ok", datos } });
      },
      (error: unknown) => {
        if (!vigente) return;
        const estado: EstadoRelacionadas =
          error instanceof ApiError && error.status === 404 ? { fase: "no_encontrado" } : { fase: "error" };
        setRespuesta({ clave, estado });
      },
    );
    return () => {
      vigente = false;
    };
  }, [insumoId, loteId, clave]);

  const estado: EstadoRelacionadas =
    insumoId === null ? { fase: "inicial" } : respuesta?.clave === clave ? respuesta.estado : { fase: "cargando" };
  const recargar = useCallback(() => setRecarga((n) => n + 1), []);
  return { estado, recargar };
}
