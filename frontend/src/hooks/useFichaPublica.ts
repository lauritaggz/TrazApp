import { useCallback, useEffect, useState } from "react";
import { obtenerFichaPublica } from "@/services/consultaPublicaService";
import type { FichaPublica } from "@/types/consultaPublica";
import { ApiError } from "@/types/auth";

export type FaseFicha = "cargando" | "lista" | "error";

interface Resultado {
  /** Identifies the request this result answers (product, selection and attempt). */
  clave: string;
  idPublico: string;
  ficha: FichaPublica | null;
  error: ApiError | null;
}

/** Loads the public ficha of `idPublico` for the requested selection (code or date).
 *
 * While a new request is in flight (`fase` "cargando"), `ficha` is the last one received for the
 * SAME product, kept only to draw the product and the selector: the elaboración area must not show
 * data of a previous selection. */
export function useFichaPublica(idPublico: string, codigo: string | null, fecha: string | null) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [intento, setIntento] = useState(0);
  const clave = JSON.stringify([idPublico, codigo, fecha, intento]);

  useEffect(() => {
    const control = new AbortController();
    obtenerFichaPublica(
      idPublico,
      { ...(codigo !== null ? { codigo } : {}), ...(fecha !== null ? { fecha } : {}) },
      control.signal,
    )
      .then((ficha) => {
        if (!control.signal.aborted) setResultado({ clave, idPublico, ficha, error: null });
      })
      .catch((error: unknown) => {
        if (control.signal.aborted) return;
        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError("No se pudo conectar con el servidor. Intenta de nuevo más tarde.", 0);
        setResultado({ clave, idPublico, ficha: null, error: apiError });
      });
    return () => control.abort();
  }, [clave, idPublico, codigo, fecha]);

  const vigente = resultado !== null && resultado.clave === clave;
  const fase: FaseFicha = !vigente ? "cargando" : resultado.error ? "error" : "lista";
  const ficha = resultado !== null && resultado.idPublico === idPublico ? resultado.ficha : null;
  const error = vigente ? resultado.error : null;
  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  return { fase, ficha, error, reintentar };
}
