import type { TipoDeclaracion } from "@/types/insumo";

/** Where an allergen suggestion comes from: the source's label or the ingredient text. */
export type OrigenAlergeno = "etiqueta" | "texto";

export const ORIGEN_ALERGENO_LABELS: Record<OrigenAlergeno, string> = {
  etiqueta: "según la etiqueta de la fuente",
  texto: "según el texto de ingredientes",
};

export interface AlergenoSugerido {
  alergeno_id: number;
  codigo: string;
  nombre: string;
  origen: OrigenAlergeno;
  /** HU07: every source that names it («jumbo», «open_food_facts», «ingredientes»). Absent for one source. */
  fuentes?: string[];
}

export interface AlergenosSugeridos {
  contiene: AlergenoSugerido[];
  trazas: AlergenoSugerido[];
  /** Labels or words that could not be tied to the catalog: the productor assigns them by hand. */
  sin_reconocer: string[];
}

export interface ProductoPropuesto {
  nombre: string | null;
  marca_origen: string | null;
  presentacion: string | null;
  ingredientes_declarados: string | null;
}

/**
 * GET /gestion/insumos/consulta-codigo/{codigo} (T13-03 / T13-04): a proposal for the supply form.
 * Nothing is registered by asking for it; the productor confirms by saving the form.
 */
export interface ConsultaCodigo {
  codigo_barras: string;
  encontrado: boolean;
  fuente: string;
  fecha_recuperacion: string;
  producto: ProductoPropuesto | null;
  alergenos: AlergenosSugeridos;
  ficha: Record<string, unknown> | null;
  /** HU07: which source supplied each field of `producto`. Absent when there is a single source. */
  fuentes_campos?: Record<string, string>;
  /** HU07: the sources that did not answer in time (the answer is the rest's alone). */
  fuentes_sin_respuesta?: string[];
  /** HU07: address of the product's thumbnail and its source (attribution). Never saved with the supply. */
  imagen_url?: string;
  imagen_fuente?: string;
}

/** One hit of the search by name (HU07 / CA3): GET /gestion/insumos/busqueda?texto=. */
export interface ResultadoBusquedaNombre {
  id: string;
  nombre: string;
  marca: string | null;
  presentacion: string | null;
  url: string | null;
  /** Address of the thumbnail (Jumbo); absent or null if the hit has none. */
  imagen_url?: string | null;
}

/** Presentation of the allergens that were suggested (HU13): where each one comes from, and what is left. */
export interface SugerenciasAlergenos {
  /** allergen id -> origin, for the allergens that were suggested. */
  origenes: Record<number, OrigenAlergeno>;
  /** Terms that could not be tied to the catalog, for manual assignment (CA06). */
  sinReconocer: string[];
}

export type { TipoDeclaracion };
