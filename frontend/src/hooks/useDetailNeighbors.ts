import { useEffect, useState } from "react";
import type { Vecinos } from "@/types/vecinos";

type Respuesta = { id: number; vecinos: Vecinos | null };

/**
 * Loads the neighbours of a detail page (HT08) with the resource's own request, e.g. `getProductNeighbors`.
 * `cargar` must be stable (a module function, not an inline arrow).
 *
 * The answer remembers which record it belongs to: while the current one has not answered, `cargando` is
 * true and `vecinos` keeps the last ones, so the links stay in place (disabled) instead of disappearing.
 * An answer for a previous record is discarded. `vecinos` is null before the first answer and when the
 * request fails (the navigation is not shown).
 */
export function useDetailNeighbors(
  id: number | null,
  cargar: (id: number) => Promise<Vecinos>,
): { vecinos: Vecinos | null; cargando: boolean } {
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);

  useEffect(() => {
    if (id == null) return;
    let vigente = true;
    cargar(id).then(
      (vecinos) => {
        if (vigente) setRespuesta({ id, vecinos });
      },
      () => {
        if (vigente) setRespuesta({ id, vecinos: null });
      },
    );
    return () => {
      vigente = false;
    };
  }, [id, cargar]);

  return {
    vecinos: respuesta?.vecinos ?? null,
    cargando: respuesta === null || respuesta.id !== id,
  };
}
