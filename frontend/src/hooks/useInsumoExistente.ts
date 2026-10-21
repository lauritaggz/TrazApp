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
  /**
   * The supply that a lookup just reported as the owner of the code. With an `ingredienteId` it is read
   * right away, so the screen knows BEFORE offering anything whether it belongs to the line's ingredient.
   */
  duplicadoId?: number | null;
}

/** What reading the existing supply said: still reading, same ingredient, another one, or it could not be read. */
export type VeredictoExistente = "pendiente" | "mismo" | "otro" | "error";

/**
 * Using or reactivating the supply that already has a barcode, shared by the form (409 on save) and
 * by the barcode lookup (409 on search). With an ingredient to match, the existing supply is read
 * first and nothing is assigned or reactivated if it belongs to another ingredient.
 */
export function useInsumoExistente({ ingredienteId, onUsar, onReactivado, duplicadoId = null }: Options) {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  // What reading the owner of the code said, with the id it was about (an older answer is not the current one).
  const [lectura, setLectura] = useState<{
    id: number;
    veredicto: Exclude<VeredictoExistente, "pendiente">;
    aviso: string;
  } | null>(null);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const limpiarAviso = useCallback(() => setAviso(""), []);

  // A lookup reported the owner of the code: find out whose ingredient it is before offering to use it.
  useEffect(() => {
    if (duplicadoId === null || ingredienteId === undefined) return;
    let vigente = true;
    getInsumo(duplicadoId).then(
      (existente) => {
        if (!vigente) return;
        if (existente.ingrediente_id !== ingredienteId) {
          setLectura({ id: duplicadoId, veredicto: "otro", aviso: otroIngrediente(existente.ingrediente.nombre) });
        } else {
          setLectura({ id: duplicadoId, veredicto: "mismo", aviso: "" });
        }
      },
      () => {
        if (vigente) setLectura({ id: duplicadoId, veredicto: "error", aviso: LOOKUP_ERROR });
      },
    );
    return () => {
      vigente = false;
    };
  }, [duplicadoId, ingredienteId]);

  const leyendo = duplicadoId !== null && ingredienteId !== undefined;
  const actual = leyendo && lectura?.id === duplicadoId ? lectura : null;
  const veredicto: VeredictoExistente | null = !leyendo ? null : (actual?.veredicto ?? "pendiente");

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

  return { usar, reactivar, ocupado, aviso: aviso || actual?.aviso || "", veredicto, limpiarAviso };
}
