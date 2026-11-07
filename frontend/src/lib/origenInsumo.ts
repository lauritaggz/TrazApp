import type { ConsultaCodigo } from "@/types/consultaCodigo";
import {
  TIPO_CONTIENE,
  TIPO_TRAZAS,
  type AlergenoDeclaradoInput,
  type InsumoCreatePayload,
  type InsumoFormValues,
} from "@/types/insumo";

/**
 * Where the data of a retrieved supply came from, and what the productor changed before confirming
 * (HU07 / T07-06, CA15). It travels with the payload; the backend turns it into `ficha.fuentes` and
 * `ficha.fuentes_por_alergeno`.
 */

/** The sources the backend accepts for a field of the proposal. */
const FUENTES_DE_CAMPO = ["open_food_facts", "jumbo"];
/** The sources it accepts for an allergen (the ingredient text included). */
const FUENTES_DE_ALERGENO = ["open_food_facts", "jumbo", "ingredientes"];
/** The values of `fuente` that come from a source: a supply with one of them has an origin to record. */
const FUENTES_CON_ORIGEN = ["open_food_facts", "jumbo", "combinada"];

/** The fields of the form that a source fills in. */
export const CAMPOS_DEL_PRODUCTO = ["nombre", "marca_origen", "presentacion", "ingredientes_declarados"] as const;
export type CampoDelProducto = (typeof CAMPOS_DEL_PRODUCTO)[number];

export interface AlergenoPropuesto {
  alergeno_id: number;
  codigo: string;
  nombre?: string;
  tipo: typeof TIPO_CONTIENE | typeof TIPO_TRAZAS;
  fuentes: string[];
}

/** What the lookup proposed, kept to compare with what the productor confirms. */
export interface OrigenPropuesta {
  fuentesCampos: Record<string, string>;
  alergenos: AlergenoPropuesto[];
}

/** The origin of a proposal; undefined when it has none to record (manual, or a single unknown source). */
export function origenDeConsulta(consulta: ConsultaCodigo): OrigenPropuesta | undefined {
  if (!consulta.fuentes_campos || !FUENTES_CON_ORIGEN.includes(consulta.fuente)) return undefined;
  const alergenos: AlergenoPropuesto[] = [
    ...consulta.alergenos.contiene.map((a) => ({ ...a, tipo: TIPO_CONTIENE })),
    ...consulta.alergenos.trazas.map((a) => ({ ...a, tipo: TIPO_TRAZAS })),
  ].map((a) => ({
    alergeno_id: a.alergeno_id,
    codigo: a.codigo,
    tipo: a.tipo,
    fuentes: a.fuentes ?? [],
  }));
  const fuentesCampos = Object.fromEntries(
    Object.entries(consulta.fuentes_campos).filter(
      ([campo, fuente]) =>
        (CAMPOS_DEL_PRODUCTO as readonly string[]).includes(campo) && FUENTES_DE_CAMPO.includes(fuente),
    ),
  );
  return { fuentesCampos, alergenos };
}

const texto = (valor: string | null | undefined) => (valor ?? "").trim();

/** The fields of the proposal whose value the productor changed (compared after trimming). */
export function camposEditados(
  inicial: InsumoFormValues,
  actual: InsumoFormValues,
  alergenosCambiaron: boolean,
): string[] {
  const editados: string[] = CAMPOS_DEL_PRODUCTO.filter((campo) => texto(inicial[campo]) !== texto(actual[campo]));
  if (alergenosCambiaron) editados.push("alergenos");
  return editados;
}

type CamposDeOrigen = Pick<
  InsumoCreatePayload,
  "fuentes_campos" | "fuentes_alergenos" | "fuentes_por_alergeno" | "campos_editados"
>;

/**
 * The origin fields of the payload for what the productor is confirming.
 *
 * - `campos_editados`: the fields they changed.
 * - `fuentes_por_alergeno`: each confirmed allergen with its class and sources; one they added, or whose
 *   class they changed, is «manual».
 * - `fuentes_alergenos`: the sources of the suggested allergens that stayed as proposed.
 *
 * `codigoPorId` gives the code of an allergen that was not suggested; without it the detail is left out.
 */
export function origenParaEnviar(
  origen: OrigenPropuesta,
  inicial: InsumoFormValues,
  actual: InsumoFormValues,
  alergenos: AlergenoDeclaradoInput[],
  alergenosCambiaron: boolean,
  codigoPorId: Record<number, string> = {},
): CamposDeOrigen {
  const porAlergeno: NonNullable<InsumoCreatePayload["fuentes_por_alergeno"]> = {};
  const fuentesAlergenos = new Set<string>();
  let completo = true;

  for (const item of alergenos) {
    const propuesto = origen.alergenos.find((p) => p.alergeno_id === item.alergeno_id && p.tipo === item.tipo);
    const tipo = item.tipo === TIPO_TRAZAS ? "traza" : "contiene";
    if (propuesto) {
      const fuentes = propuesto.fuentes.filter((f) => FUENTES_DE_ALERGENO.includes(f));
      if (fuentes.length > 0) {
        porAlergeno[propuesto.codigo] = { tipo, fuentes };
        fuentes.forEach((f) => fuentesAlergenos.add(f));
        continue;
      }
    }
    const codigo = propuesto?.codigo ?? origen.alergenos.find((p) => p.alergeno_id === item.alergeno_id)?.codigo ?? codigoPorId[item.alergeno_id];
    if (!codigo) {
      completo = false;
      continue;
    }
    porAlergeno[codigo] = { tipo, fuentes: ["manual"] };
  }

  const datos: CamposDeOrigen = {
    fuentes_campos: origen.fuentesCampos,
    campos_editados: camposEditados(inicial, actual, alergenosCambiaron),
    fuentes_alergenos: [...fuentesAlergenos],
  };
  if (completo) datos.fuentes_por_alergeno = porAlergeno;
  return datos;
}
