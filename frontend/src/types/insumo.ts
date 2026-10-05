export type InsumoFuente = "manual" | "open_food_facts";
export type TipoDeclaracion = "contiene" | "trazas";

export const TIPO_CONTIENE: TipoDeclaracion = "contiene";
export const TIPO_TRAZAS: TipoDeclaracion = "trazas";

export const TIPO_DECLARACION_LABELS: Record<TipoDeclaracion, string> = {
  contiene: "Contiene",
  trazas: "Puede contener (trazas)",
};

export const FUENTE_LABELS: Record<string, string> = {
  manual: "Registro manual",
  open_food_facts: "Open Food Facts",
};

export interface IngredienteResumen {
  id: number;
  nombre: string;
}

/** Allergen declared by a supply, with its declaration type (GET /gestion/insumos). */
export interface AlergenoDeclarado {
  alergeno_id: number;
  codigo: string;
  nombre: string;
  obligatorio_chile: boolean;
  tipo: TipoDeclaracion;
}

export interface Insumo {
  id: number;
  productor_id: number;
  ingrediente_id: number;
  ingrediente: IngredienteResumen;
  nombre: string;
  marca_origen: string;
  presentacion: string | null;
  codigo_barras: string | null;
  ingredientes_declarados: string | null;
  advertencias: string | null;
  ficha: Record<string, unknown> | null;
  fuente: InsumoFuente | string;
  fecha_recuperacion: string | null;
  habitual: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
  alergenos_declarados: AlergenoDeclarado[];
}

/** `fuente`, `ficha` and `fecha_recuperacion` are filled by HU13 when a supply is retrieved. */
export interface InsumoCreatePayload {
  ingrediente_id: number;
  nombre: string;
  marca_origen: string;
  presentacion?: string | null;
  codigo_barras?: string | null;
  ingredientes_declarados?: string | null;
  advertencias?: string | null;
  ficha?: Record<string, unknown> | null;
  fuente?: InsumoFuente;
  fecha_recuperacion?: string | null;
  habitual?: boolean;
}

export interface InsumoUpdatePayload {
  ingrediente_id?: number;
  nombre?: string;
  marca_origen?: string;
  presentacion?: string | null;
  codigo_barras?: string | null;
  ingredientes_declarados?: string | null;
  advertencias?: string | null;
  habitual?: boolean;
  activo?: boolean;
}

export type InsumoFormMode = "create" | "edit";

export interface InsumoFormValues {
  nombre: string;
  marca_origen: string;
  /** Select value: the id as text, "" while nothing is chosen. */
  ingrediente_id: string;
  presentacion: string;
  codigo_barras: string;
  ingredientes_declarados: string;
  advertencias: string;
  habitual: boolean;
}

export const EMPTY_INSUMO_FORM_VALUES: InsumoFormValues = {
  nombre: "",
  marca_origen: "",
  ingrediente_id: "",
  presentacion: "",
  codigo_barras: "",
  ingredientes_declarados: "",
  advertencias: "",
  habitual: false,
};

export type InsumoEstadoFilter = "activos" | "inactivos";

export interface InsumoListFilters {
  search: string;
  /** "all" or the ingredient id as text. */
  ingredienteId: string;
  estado: InsumoEstadoFilter;
}

export const DEFAULT_INSUMO_LIST_FILTERS: InsumoListFilters = {
  search: "",
  ingredienteId: "all",
  estado: "activos",
};

export const INSUMO_ESTADO_OPTIONS: { value: InsumoEstadoFilter; label: string }[] = [
  { value: "activos", label: "Activos" },
  { value: "inactivos", label: "Inactivos" },
];

/** A barcode that already belongs to another supply of the productor (409). */
export interface InsumoDuplicateInfo {
  insumoId: number;
  activo: boolean;
  mensaje: string;
}
