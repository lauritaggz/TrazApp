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
}

/** Presentation of the allergens that were suggested (HU13): where each one comes from, and what is left. */
export interface SugerenciasAlergenos {
  /** allergen id -> origin, for the allergens that were suggested. */
  origenes: Record<number, OrigenAlergeno>;
  /** Terms that could not be tied to the catalog, for manual assignment (CA06). */
  sinReconocer: string[];
}

export type { TipoDeclaracion };
