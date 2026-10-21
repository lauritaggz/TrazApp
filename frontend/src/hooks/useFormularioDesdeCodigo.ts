import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useBusquedaCodigoBarras, type ResultadoBusqueda } from "@/hooks/useBusquedaCodigoBarras";
import type { useInsumoForm } from "@/hooks/useInsumoForm";
import { isInsumoFormDirtyComparedTo } from "@/lib/insumoFormValidation";
import {
  precargaDeProducto,
  precargaSoloCodigo,
  PRECARGA_INICIAL,
  type DatosPrecarga,
  type PrecargaInsumo,
} from "@/lib/precargaInsumo";
import type { ConsultaCodigo } from "@/types/consultaCodigo";
import {
  ALERGENOS_VACIOS,
  EMPTY_INSUMO_FORM_VALUES,
  type AlergenosValue,
  type InsumoFormValues,
} from "@/types/insumo";

/** What the screen needs to know about the form that is on screen when a lookup ends. */
export interface EstadoDelFormulario {
  /** Anything differs from where the form started (including the ingredient). */
  dirty: boolean;
  /** Something other than the ingredient differs: that is what a product from the source would replace. */
  cambiosSalvoIngrediente: boolean;
  values: InsumoFormValues;
  alergenos: AlergenosValue;
}

const FORMULARIO_VACIO: EstadoDelFormulario = {
  dirty: false,
  cambiosSalvoIngrediente: false,
  values: EMPTY_INSUMO_FORM_VALUES,
  alergenos: ALERGENOS_VACIOS,
};

/**
 * The barcode lookup wired to the supply form, shared by the page of new supplies and by the dialog
 * of the elaboración (HU13 / T13-05).
 *
 * The form takes its starting point only when it mounts, so a product that was found is applied by
 * giving `precarga` a new `clave`: the screen mounts the form again with `key={precarga.clave}`. The
 * ingredient the productor had already chosen stays (CA07). If the form had changes of their own, the
 * product waits in `porConfirmar` until they decide. Nothing here registers anything: the supply
 * (and its allergen review) exists only when the productor saves the form.
 */
export function useFormularioDesdeCodigo(valoresIniciales: Partial<InsumoFormValues> = {}) {
  const [precarga, setPrecarga] = useState<PrecargaInsumo>({
    ...PRECARGA_INICIAL,
    valores: valoresIniciales,
  });
  const [porConfirmar, setPorConfirmar] = useState<ConsultaCodigo | null>(null);
  const formularioRef = useRef<EstadoDelFormulario>(FORMULARIO_VACIO);

  function aplicar(datos: DatosPrecarga, heredaCambios: boolean) {
    setPrecarga((actual) => ({ ...datos, clave: actual.clave + 1, heredaCambios }));
  }

  function handleResultado(resultado: ResultadoBusqueda) {
    const actual = formularioRef.current;
    if (resultado.tipo === "encontrado") {
      if (actual.cambiosSalvoIngrediente) {
        setPorConfirmar(resultado.consulta);
        return;
      }
      aplicar(precargaDeProducto(resultado.consulta, actual.values.ingrediente_id), false);
      return;
    }
    // Not found, or the source is not available: the form keeps what was typed and gets the code.
    aplicar(precargaSoloCodigo(resultado.codigo, actual), actual.dirty);
  }

  const busqueda = useBusquedaCodigoBarras({ onResultado: handleResultado });

  /** The productor accepts replacing what they typed with the product that was found. */
  function reemplazar() {
    if (porConfirmar) {
      aplicar(precargaDeProducto(porConfirmar, formularioRef.current.values.ingrediente_id), false);
    }
    setPorConfirmar(null);
  }

  /** The productor keeps what they typed; the product that was found is not used. */
  function conservar() {
    setPorConfirmar(null);
    // Do not leave the message that says the product was found.
    busqueda.limpiar();
  }

  return { busqueda, precarga, formularioRef, porConfirmar, reemplazar, conservar };
}

/**
 * Called by the form that is on screen: publishes its state for the lookup and returns whether it has
 * changes (its own, or typed before the last lookup and kept by it).
 */
export function usePublicarFormulario(
  form: ReturnType<typeof useInsumoForm>,
  precarga: PrecargaInsumo,
  formularioRef: MutableRefObject<EstadoDelFormulario>,
): { dirty: boolean } {
  const dirty = form.dirty || precarga.heredaCambios;
  const cambiosSalvoIngrediente =
    isInsumoFormDirtyComparedTo(
      { ...form.values, ingrediente_id: form.baseline.ingrediente_id },
      form.baseline,
    ) || form.alergenosModificados;

  useEffect(() => {
    formularioRef.current = {
      dirty,
      cambiosSalvoIngrediente,
      values: form.values,
      alergenos: form.alergenos,
    };
  });

  return { dirty };
}
