import type { ConsultaCodigo, SugerenciasAlergenos } from "@/types/consultaCodigo";
import {
  TIPO_CONTIENE,
  TIPO_TRAZAS,
  type AlergenoDeclaradoInput,
  type AlergenosValue,
  type InsumoCreatePayload,
  type InsumoFormValues,
} from "@/types/insumo";

/**
 * What the supply form starts from after a barcode lookup (HU13 / T13-05). The form takes it only
 * when it mounts, so every new `clave` mounts it again with the new data.
 */
export interface PrecargaInsumo {
  clave: number;
  valores: Partial<InsumoFormValues>;
  alergenos?: AlergenosValue;
  /** `fuente`, `fecha_recuperacion` and `ficha`, which travel with the payload but are not fields. */
  extra?: Partial<InsumoCreatePayload>;
  /** The allergens that were suggested, for presentation only. */
  sugerencias?: SugerenciasAlergenos;
  /**
   * The productor had typed things that this load keeps in the form: the form is "clean" against
   * its new starting point, but leaving the page must still warn.
   */
  heredaCambios: boolean;
}

export const PRECARGA_INICIAL: PrecargaInsumo = { clave: 0, valores: {}, heredaCambios: false };

export type DatosPrecarga = Omit<PrecargaInsumo, "clave" | "heredaCambios">;

/** The suggested allergens as the selector's value: the ones it contains, then the traces. */
export function alergenosDeConsulta(consulta: ConsultaCodigo): AlergenosValue {
  const items: AlergenoDeclaradoInput[] = [
    ...consulta.alergenos.contiene.map((a) => ({ alergeno_id: a.alergeno_id, tipo: TIPO_CONTIENE })),
    ...consulta.alergenos.trazas.map((a) => ({ alergeno_id: a.alergeno_id, tipo: TIPO_TRAZAS })),
  ];
  // Nothing suggested: the selector stays empty and the productor declares or confirms «no contiene».
  return { items, sinAlergenos: false };
}

/** Origins of the suggested allergens and the terms left for manual assignment; undefined if none. */
export function sugerenciasDeConsulta(consulta: ConsultaCodigo): SugerenciasAlergenos | undefined {
  const origenes: SugerenciasAlergenos["origenes"] = {};
  for (const alergeno of [...consulta.alergenos.contiene, ...consulta.alergenos.trazas]) {
    origenes[alergeno.alergeno_id] = alergeno.origen;
  }
  const sinReconocer = [...consulta.alergenos.sin_reconocer];
  if (Object.keys(origenes).length === 0 && sinReconocer.length === 0) return undefined;
  return { origenes, sinReconocer };
}

/**
 * A product that was found: its data, the suggested allergens and the retrieval record. The
 * ingredient the productor had already chosen stays (CA07); everything else comes from the source.
 */
export function precargaDeProducto(consulta: ConsultaCodigo, ingredienteId: string): DatosPrecarga {
  const producto = consulta.producto;
  return {
    valores: {
      ingrediente_id: ingredienteId,
      nombre: producto?.nombre ?? "",
      marca_origen: producto?.marca_origen ?? "",
      presentacion: producto?.presentacion ?? "",
      ingredientes_declarados: producto?.ingredientes_declarados ?? "",
      codigo_barras: consulta.codigo_barras,
    },
    alergenos: alergenosDeConsulta(consulta),
    extra: {
      fuente: consulta.fuente === "open_food_facts" ? "open_food_facts" : "manual",
      fecha_recuperacion: consulta.fecha_recuperacion,
      ficha: consulta.ficha,
    },
    sugerencias: sugerenciasDeConsulta(consulta),
  };
}

/**
 * Not found, or the source is not available: the form keeps what the productor typed and gets the
 * barcode written in. It is a manual record: no source, no date, no data record.
 */
export function precargaSoloCodigo(
  codigo: string,
  actuales: { values: InsumoFormValues; alergenos: AlergenosValue },
): DatosPrecarga {
  return {
    valores: { ...actuales.values, codigo_barras: codigo },
    alergenos: actuales.alergenos,
  };
}
