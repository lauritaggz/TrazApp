export type UnidadMedida = "g" | "kg" | "ml" | "L" | "unidad";

export interface Product {
  id: number;
  productor_id: number | null;
  codigo_interno: string | null;
  nombre: string;
  descripcion: string | null;
  contenido_neto: string | null;
  unidad_medida: UnidadMedida | null;
  presentacion: string | null;
  activo: boolean;
  created_at: string | null;
}

/** Payload for POST /gestion/productos. Ownership comes from JWT. */
export interface ProductCreatePayload {
  codigo_interno: string;
  nombre: string;
  descripcion: string;
  /** Decimal string to avoid unnecessary precision loss. */
  contenido_neto: string;
  unidad_medida: UnidadMedida;
  presentacion?: string | null;
}

export interface ProductFormValues {
  codigo_interno: string;
  nombre: string;
  descripcion: string;
  contenido_neto: string;
  unidad_medida: "" | UnidadMedida;
  presentacion: string;
}

export const EMPTY_PRODUCT_FORM_VALUES: ProductFormValues = {
  codigo_interno: "",
  nombre: "",
  descripcion: "",
  contenido_neto: "",
  unidad_medida: "",
  presentacion: "",
};

export const PRODUCT_FORM_UNIT_OPTIONS: {
  value: UnidadMedida;
  label: string;
}[] = [
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "L", label: "L" },
  { value: "unidad", label: "unidad" },
];

export type ProductSortOption = "recent" | "code" | "name";

export type ProductUnitFilter = "all" | UnidadMedida;

export interface ProductListFilters {
  search: string;
  unit: ProductUnitFilter;
  sort: ProductSortOption;
}

export const DEFAULT_PRODUCT_LIST_FILTERS: ProductListFilters = {
  search: "",
  unit: "all",
  sort: "recent",
};

export const PRODUCT_UNIT_OPTIONS: { value: ProductUnitFilter; label: string }[] =
  [
    { value: "all", label: "Todas" },
    { value: "g", label: "g" },
    { value: "kg", label: "kg" },
    { value: "ml", label: "ml" },
    { value: "L", label: "L" },
    { value: "unidad", label: "unidad" },
  ];

export const PRODUCT_SORT_OPTIONS: { value: ProductSortOption; label: string }[] =
  [
    { value: "recent", label: "Más recientes" },
    { value: "code", label: "Código A–Z" },
    { value: "name", label: "Nombre A–Z" },
  ];
