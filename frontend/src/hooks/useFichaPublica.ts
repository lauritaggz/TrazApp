import { useCallback, useEffect, useRef, useState } from "react";
import type { FichaPublica, SeleccionElaboracion } from "@/types/consultaPublica";
import { ApiError } from "@/types/auth";

export type FaseFicha = "cargando" | "lista" | "error";

export type CargarFicha = (seleccion: SeleccionElaboracion, signal: AbortSignal) => Promise<FichaPublica>;

interface Resultado {
  /** Identifies the request this result answers (source, selection and attempt). */
  clave: string;
  fuente: string;
  ficha: FichaPublica | null;
  error: ApiError | null;
}

/** Loads a public ficha for the requested selection (code or date) with the given loader.
 *
 * `fuente` says where it comes from (the public id, or the product of a preview). The loader is the
 * only difference between the public view (no token) and the preview (authenticated).
 *
 * While a new request is in flight (`fase` "cargando"), `ficha` is the last one received from the
 * SAME source, kept only to draw the product and the selector: the elaboración area must not show
 * data of a previous selection. */
export function useFichaPublica(fuente: string, cargar: CargarFicha, codigo: string | null, fecha: string | null) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [intento, setIntento] = useState(0);
  const clave = JSON.stringify([fuente, codigo, fecha, intento]);
  const cargarRef = useRef(cargar);

  useEffect(() => {
    cargarRef.current = cargar;
  });

  useEffect(() => {
    const control = new AbortController();
    cargarRef
      .current({ ...(codigo !== null ? { codigo } : {}), ...(fecha !== null ? { fecha } : {}) }, control.signal)
      .then((ficha) => {
        if (!control.signal.aborted) setResultado({ clave, fuente, ficha, error: null });
      })
      .catch((error: unknown) => {
        if (control.signal.aborted) return;
        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError("No se pudo conectar con el servidor. Intenta de nuevo más tarde.", 0);
        setResultado({ clave, fuente, ficha: null, error: apiError });
      });
    return () => control.abort();
  }, [clave, fuente, codigo, fecha]);

  const vigente = resultado !== null && resultado.clave === clave;
  const fase: FaseFicha = !vigente ? "cargando" : resultado.error ? "error" : "lista";
  const ficha = resultado !== null && resultado.fuente === fuente ? resultado.ficha : null;
  const error = vigente ? resultado.error : null;
  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  return { fase, ficha, error, reintentar };
}
