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
