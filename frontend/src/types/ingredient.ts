export type IngredienteTipo = "simple" | "compuesto";

export interface Ingrediente {
  id: number;
  productor_id: number | null;
  codigo_interno: string | null;
  nombre: string;
  descripcion: string | null;
  tipo: IngredienteTipo | null;
  activo: boolean;
  created_at: string | null;
}

export interface IngredienteCreatePayload {
  codigo_interno: string;
  nombre: string;
  descripcion?: string | null;
  tipo: IngredienteTipo;
}

export interface IngredienteUpdatePayload {
  codigo_interno?: string;
  nombre?: string;
  descripcion?: string | null;
  tipo?: IngredienteTipo;
}

export type IngredienteFormMode = "create" | "edit";

export interface IngredienteFormValues {
  codigo_interno: string;
  nombre: string;
  descripcion: string;
  tipo: "" | IngredienteTipo;
}

export const EMPTY_INGREDIENTE_FORM_VALUES: IngredienteFormValues = {
  codigo_interno: "",
  nombre: "",
  descripcion: "",
  tipo: "",
};

export const INGREDIENTE_TIPO_OPTIONS: {
  value: IngredienteTipo;
  label: string;
}[] = [
  { value: "simple", label: "Simple" },
  { value: "compuesto", label: "Compuesto" },
];

export type IngredienteSortOption = "recent" | "code" | "name";
export type IngredienteTipoFilter = "all" | IngredienteTipo;

export interface IngredienteListFilters {
  search: string;
  tipo: IngredienteTipoFilter;
  sort: IngredienteSortOption;
}

export const DEFAULT_INGREDIENTE_LIST_FILTERS: IngredienteListFilters = {
  search: "",
  tipo: "all",
  sort: "recent",
};

export const INGREDIENTE_TIPO_FILTER_OPTIONS: {
  value: IngredienteTipoFilter;
  label: string;
}[] = [
  { value: "all", label: "Todos" },
  { value: "simple", label: "Simple" },
  { value: "compuesto", label: "Compuesto" },
];

export const INGREDIENTE_SORT_OPTIONS: {
  value: IngredienteSortOption;
  label: string;
}[] = [
  { value: "recent", label: "Más recientes" },
  { value: "code", label: "Código A–Z" },
  { value: "name", label: "Nombre A–Z" },
];

export interface Alergeno {
  id: number;
  codigo: string;
  nombre: string;
}

export interface ComposicionComponente {
  id: number;
  ingrediente_componente_id: number;
  codigo_interno: string | null;
  nombre: string;
  tipo: IngredienteTipo | null;
  porcentaje: string;
  orden: number | null;
}

export interface ComposicionComponenteCreatePayload {
  ingrediente_componente_id: number;
  porcentaje: string;
  orden?: number | null;
}

export interface ComposicionComponenteUpdatePayload {
  porcentaje?: string;
  orden?: number | null;
}
