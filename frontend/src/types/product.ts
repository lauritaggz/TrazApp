export type UnidadMedida = "g" | "kg" | "ml" | "L" | "unidad";

export interface Categoria {
  id: number;
  nombre: string;
}

export interface Product {
  id: number;
  productor_id: number | null;
  codigo_interno: string | null;
  nombre: string;
  descripcion: string | null;
  contenido_neto: string | null;
  unidad_medida: UnidadMedida | null;
  presentacion: string | null;
  costo_produccion: string | null;
  precio_venta: string | null;
  imagen_url: string | null;
  categorias: Categoria[];
  activo: boolean;
  created_at: string | null;
  /** HT06-07: the current version has at least one ingredient, so an elaboración can be registered. */
  tiene_formulacion: boolean;
  /**
   * HU09: publication state. Optional only so older mocks keep compiling; the API always sends them.
   * `id_publico` and `url_publica` stay once the product was published, even if it is not now.
   */
  publicado?: boolean;
  id_publico?: string | null;
  publicado_en?: string | null;
  url_publica?: string | null;
  /** HU09: finalized elaboraciones, and of those the ones not hidden from the public (borradores never count). */
  elaboraciones_finalizadas?: number;
  elaboraciones_visibles?: number;
}

/** Answer of POST / DELETE /gestion/productos/{id}/publicacion (HU09). */
export interface Publicacion {
  producto_id: number;
  publicado: boolean;
  id_publico: string | null;
  publicado_en: string | null;
  url_publica: string | null;
}

/** What the 409 of enabling the publication says is missing. */
export type RequisitoPublicacion = "sin_formulacion" | "sin_elaboracion_finalizada";

/** Payload for POST /gestion/productos. Ownership comes from JWT. */
export interface ProductCreatePayload {
  codigo_interno: string;
  nombre: string;
  descripcion: string;
  /** Decimal string to avoid unnecessary precision loss. */
  contenido_neto: string;
  unidad_medida: UnidadMedida;
  presentacion?: string | null;
  costo_produccion?: string | null;
  precio_venta?: string | null;
  imagen_url?: string | null;
  categoria_ids?: number[];
}

/** Partial payload for PATCH /gestion/productos/{id}. */
export interface ProductUpdatePayload {
  codigo_interno?: string;
  nombre?: string;
  descripcion?: string;
  contenido_neto?: string;
  unidad_medida?: UnidadMedida;
  presentacion?: string | null;
  costo_produccion?: string | null;
  precio_venta?: string | null;
  imagen_url?: string | null;
  categoria_ids?: number[];
}

export type ProductFormMode = "create" | "edit";

export interface ProductFormValues {
  codigo_interno: string;
  nombre: string;
  descripcion: string;
  contenido_neto: string;
  unidad_medida: "" | UnidadMedida;
  presentacion: string;
  costo_produccion: string;
  precio_venta: string;
  categoria_ids: number[];
}

export const EMPTY_PRODUCT_FORM_VALUES: ProductFormValues = {
  codigo_interno: "",
  nombre: "",
  descripcion: "",
  contenido_neto: "",
  unidad_medida: "",
  presentacion: "",
  costo_produccion: "",
  precio_venta: "",
  categoria_ids: [],
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
