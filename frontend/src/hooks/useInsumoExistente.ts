import { useCallback, useEffect, useRef, useState } from "react";
import { getInsumo, reactivateInsumo } from "@/services/insumoService";
import type { Insumo } from "@/types/insumo";

const LOOKUP_ERROR = "No pudimos comprobar el insumo existente. Inténtalo nuevamente.";
const REACTIVATE_ERROR = "No pudimos reactivar el insumo. Inténtalo nuevamente.";

function otroIngrediente(nombre: string): string {
  return `Ese insumo está asociado a «${nombre}».`;
}

interface Options {
  /**
   * HU05: the supply is wanted for this ingredient (the line of the elaboración). Using or
   * reactivating a supply of ANOTHER ingredient is refused and explained. Without it (the page of
   * new supplies) there is nothing to match.
   */
  ingredienteId?: number;
  /** The existing supply was chosen for use. */
  onUsar?: (insumo: Insumo) => void;
  /** The deactivated supply was reactivated. */
  onReactivado: (insumo: Insumo) => void;
}

/**
 * Using or reactivating the supply that already has a barcode, shared by the form (409 on save) and
 * by the barcode lookup (409 on search). With an ingredient to match, the existing supply is read
 * first and nothing is assigned or reactivated if it belongs to another ingredient.
 */
export function useInsumoExistente({ ingredienteId, onUsar, onReactivado }: Options) {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const limpiarAviso = useCallback(() => setAviso(""), []);

  /** The existing supply, or null (with the reason in `aviso`) when it cannot be used for this ingredient. */
  const comprobar = useCallback(
    async (insumoId: number): Promise<Insumo | null> => {
      try {
        const existente = await getInsumo(insumoId);
        if (ingredienteId !== undefined && existente.ingrediente_id !== ingredienteId) {
          setAviso(otroIngrediente(existente.ingrediente.nombre));
          return null;
        }
        return existente;
      } catch {
        setAviso(LOOKUP_ERROR);
        return null;
      }
    },
    [ingredienteId],
  );

  const usar = useCallback(
    async (insumoId: number) => {
      if (ocupado) return;
      setAviso("");
      setOcupado(true);
      try {
        const existente = await comprobar(insumoId);
        if (existente && montadoRef.current) onUsar?.(existente);
      } finally {
        if (montadoRef.current) setOcupado(false);
      }
    },
    [comprobar, ocupado, onUsar],
  );

  const reactivar = useCallback(
    async (insumoId: number) => {
      if (ocupado) return;
      setAviso("");
      setOcupado(true);
      try {
        // Reactivating also assigns it, so it must belong to this ingredient: check before touching anything.
        if (ingredienteId !== undefined && !(await comprobar(insumoId))) return;
        try {
          const reactivado = await reactivateInsumo(insumoId);
          if (montadoRef.current) onReactivado(reactivado);
        } catch {
          if (montadoRef.current) setAviso(REACTIVATE_ERROR);
        }
      } finally {
        if (montadoRef.current) setOcupado(false);
      }
    },
    [comprobar, ingredienteId, ocupado, onReactivado],
  );

  return { usar, reactivar, ocupado, aviso, limpiarAviso };
}
