import { nombreFuente } from "@/lib/fuentesInsumo";
import { CAMPOS_DEL_PRODUCTO, type AlergenoPropuesto } from "@/lib/origenInsumo";
import type { ConsultaCodigo } from "@/types/consultaCodigo";
import {
  TIPO_CONTIENE,
  TIPO_TRAZAS,
  type AlergenoDeclaradoInput,
  type AlergenosValue,
  type Insumo,
  type InsumoFormValues,
} from "@/types/insumo";

/**
 * What the review of a supply (HU07 / T07-07) needs to know about where the data came from. It exists only
 * when the data was retrieved from a source (or the saved supply keeps `ficha.fuentes`): a manual supply has
 * none and shows no sources.
 */
export interface DatosRevision {
  /** `fuente` of the proposal: «combinada», «jumbo» or «open_food_facts». */
  fuente: string;
  /** Source of each field of the form, as the lookup said (or `ficha.fuentes` of a saved supply). */
  fuentesCampos: Record<string, string>;
  /** Sources that name the barcode: both when it matched in both. */
  fuentesDelCodigo: string[];
  /** The date each source was retrieved. */
  fechas: Record<string, string>;
  /** Sources that were asked and did not answer in time. */
  sinRespuesta: string[];
  /** The first source answered but Jumbo had no product with the same barcode: nothing was combined. */
  jumboSinCoincidencia: boolean;
  /** The allergens the lookup proposed, each with the sources that name it. */
  alergenos: AlergenoPropuesto[];
  /** Terms the lookup could not tie to the catalog (CA5): the productor decides each one. */
  sinReconocer: string[];
  /** «Libre de…» claims: information only, they never remove an allergen (CA16). */
  libreDe: string[];
  /** The thumbnail and its source (attribution). */
  imagen?: { url: string | null; fuente: string };
}

export const FUENTE_INGREDIENTES = "ingredientes";

const CAMPOS_FUENTE = new Set<string>(CAMPOS_DEL_PRODUCTO);

function libreDeDe(ficha: Record<string, unknown> | null): string[] {
  const directas = ficha?.condiciones_alimentarias;
  const dentroDeJumbo = (ficha?.jumbo as Record<string, unknown> | undefined)?.condiciones_alimentarias;
  const lista = Array.isArray(directas) ? directas : Array.isArray(dentroDeJumbo) ? dentroDeJumbo : [];
  return lista.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

/** The review data of a proposal that came from a lookup (by barcode or by name). */
export function revisionDeConsulta(consulta: ConsultaCodigo): DatosRevision {
  const fuentesCampos = Object.fromEntries(
    Object.entries(consulta.fuentes_campos ?? {}).filter(([campo]) => CAMPOS_FUENTE.has(campo)),
  );
  const alergenos: AlergenoPropuesto[] = [
    ...consulta.alergenos.contiene.map((a) => ({ ...a, tipo: TIPO_CONTIENE })),
    ...consulta.alergenos.trazas.map((a) => ({ ...a, tipo: TIPO_TRAZAS })),
  ].map((a) => ({
    alergeno_id: a.alergeno_id,
    codigo: a.codigo,
    nombre: a.nombre,
    tipo: a.tipo,
    // A lookup of a single source does not list sources by allergen: its origin says it (label or text).
    fuentes: a.fuentes?.length ? a.fuentes : [a.origen === "texto" ? FUENTE_INGREDIENTES : consulta.fuente],
  }));
  const sinRespuesta = consulta.fuentes_sin_respuesta ?? [];
  const combinada = consulta.fuente === "combinada";
  const fuentesDelCodigo = combinada ? ["open_food_facts", "jumbo"] : [consulta.fuente];
  const fuentes = combinada ? ["open_food_facts", "jumbo"] : [consulta.fuente];
  return {
    fuente: consulta.fuente,
    fuentesCampos,
    fuentesDelCodigo,
    fechas: Object.fromEntries(fuentes.map((fuente) => [fuente, consulta.fecha_recuperacion])),
    sinRespuesta,
    jumboSinCoincidencia: consulta.fuente === "open_food_facts" && !sinRespuesta.includes("jumbo"),
    alergenos,
    sinReconocer: consulta.alergenos.sin_reconocer,
    libreDe: libreDeDe(consulta.ficha),
    imagen: { url: consulta.imagen_url ?? null, fuente: consulta.imagen_fuente ?? consulta.fuente },
  };
}

/** The review data of a saved supply that keeps its origin (`ficha.fuentes`); undefined for a manual one. */
export function revisionDeInsumo(insumo: Insumo): DatosRevision | undefined {
  const entradas = (insumo.ficha as { fuentes?: unknown } | null)?.fuentes;
  if (!Array.isArray(entradas)) return undefined;
  const fuentesCampos: Record<string, string> = {};
  const fechas: Record<string, string> = {};
  for (const entrada of entradas as { fuente?: string; fecha?: string; campos?: string[] }[]) {
    if (!entrada.fuente || entrada.fuente === "manual") continue;
    if (entrada.fecha) fechas[entrada.fuente] = entrada.fecha;
    for (const campo of entrada.campos ?? []) {
      if (CAMPOS_FUENTE.has(campo)) fuentesCampos[campo] = entrada.fuente;
    }
  }
  if (Object.keys(fechas).length === 0) return undefined;
  return {
    fuente: insumo.fuente,
    fuentesCampos,
    fuentesDelCodigo: Object.keys(fechas),
    fechas,
    sinRespuesta: [],
    jumboSinCoincidencia: false,
    alergenos: [],
    sinReconocer: [],
    libreDe: [],
  };
}

/** The visible name of a source of a field or an allergen. */
export function nombreDeOrigen(fuente: string): string {
  if (fuente === FUENTE_INGREDIENTES) return "Detectado en los ingredientes";
  return nombreFuente(fuente);
}

export const ETIQUETA_AGREGADO = "Agregado por ti";
export const ETIQUETA_MODIFICADO = "Modificado por ti";

const texto = (valor: string | null | undefined) => (valor ?? "").trim();

/**
 * The source line of a field: the source that supplied it while it is as it came; «Modificado por ti» if the
 * productor changed it; «Agregado por ti» if it was empty and they wrote it. Nothing for a field with no source
 * and no value, and nothing at all without a retrieval (manual: no sources).
 */
export function fuenteDelCampo(
  revision: DatosRevision | undefined,
  campo: keyof InsumoFormValues,
  inicial: InsumoFormValues,
  actual: InsumoFormValues,
): string | null {
  if (!revision) return null;
  const valorInicial = texto(inicial[campo] as string);
  const valorActual = texto(actual[campo] as string);
  if (valorInicial === valorActual) {
    if (!valorActual) return null;
    if (campo === "codigo_barras") return revision.fuentesDelCodigo.map(nombreDeOrigen).join(" · ");
    const fuente = revision.fuentesCampos[campo];
    return fuente ? nombreDeOrigen(fuente) : null;
  }
  return valorInicial ? ETIQUETA_MODIFICADO : ETIQUETA_AGREGADO;
}

/**
 * The sources of an allergen in the current declaration: the lookup's own while the allergen is as it was
 * proposed; «Modificado por ti» if the productor moved it to the other class; «Agregado por ti» if they added it.
 * Null without a retrieval.
 */
export function fuentesDelAlergeno(
  revision: DatosRevision | undefined,
  item: AlergenoDeclaradoInput,
): string[] | null {
  if (!revision) return null;
  const propuesto = revision.alergenos.find((a) => a.alergeno_id === item.alergeno_id);
  if (!propuesto) return [ETIQUETA_AGREGADO];
  if (propuesto.tipo !== item.tipo) return [ETIQUETA_MODIFICADO];
  const nombres = propuesto.fuentes.map(nombreDeOrigen);
  return nombres.length > 0 ? nombres : [ETIQUETA_AGREGADO];
}

/** What the productor answered about «puede contener» when no source (or the allergens) said anything. */
export type RespuestaTrazas = "" | "no_indica" | "indica";

/** The decision about a term the lookup could not tie to the catalog. */
export type DecisionTermino = { tipo: "asignado"; nombre: string } | { tipo: "no_alergeno" };

/** «Trazas verificadas»: some trace is declared (a source's or the productor's) or the productor answered. */
export function trazasVerificadas(alergenos: AlergenosValue, respuesta: RespuestaTrazas): boolean {
  const hayTrazas = alergenos.items.some((item) => item.tipo === TIPO_TRAZAS);
  return hayTrazas || respuesta === "no_indica";
}

/** «Alérgenos revisados» (HT06): allergens in «Contiene» or «no contiene» confirmed, and every term decided. */
export function alergenosRevisados(
  alergenos: AlergenosValue,
  terminos: string[],
  decisiones: Record<string, DecisionTermino>,
): boolean {
  const hayContiene = alergenos.items.some((item) => item.tipo === TIPO_CONTIENE);
  const declarados = hayContiene || alergenos.sinAlergenos;
  return declarados && terminos.every((termino) => decisiones[termino] !== undefined);
}

/** «Información comercial revisada»: every field the backend requires is filled in. */
export function informacionComercialCompleta(values: InsumoFormValues): boolean {
  return texto(values.nombre) !== "" && texto(values.marca_origen) !== "";
}
