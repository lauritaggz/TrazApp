/**
 * Calculadora de costos (HU14). Contrato de GET/PUT /gestion/productos/{id}/costos.
 *
 * Todos los Decimal llegan como TEXTO con decimales fijos y nunca se convierten a `number`:
 * costos y totales con 4 decimales ("250.0000"), precios y montos con 2 ("1000.00"),
 * cantidades y contenidos con 3 ("250.000"). `rendimiento`, `orden` y los ids son enteros.
 * Las fechas son marcas de tiempo ISO 8601.
 */

export type UnidadCosto = "g" | "kg" | "ml" | "L" | "unidad";

export interface InsumoCosto {
  id: number;
  nombre: string;
  marca_origen: string;
  presentacion: string | null;
  habitual: boolean;
  precio_referencia: string | null;
  precio_fuente: string | null;
  precio_fecha: string | null;
  contenido_cantidad: string | null;
  contenido_unidad: string | null;
  contenido_fuente: string | null;
}

export interface FaltanteCosto {
  codigo: string;
  mensaje: string;
}

export type OrigenInsumo = "ultima_elaboracion" | "habitual" | "elegido";

export interface LineaCosto {
  ingrediente_id: number;
  ingrediente_nombre: string;
  orden: number | null;
  cantidad: string | null;
  unidad: string | null;
  insumo: InsumoCosto | null;
  origen_insumo: OrigenInsumo | null;
  /** "ultimo_inactivo": el insumo de la última elaboración ya no está activo. */
  aviso_insumo: string | null;
  insumos_disponibles: InsumoCosto[];
  costo: string | null;
  faltantes: FaltanteCosto[];
}

export interface OtroCosto {
  id: number;
  nombre: string;
  monto: string;
  orden: number;
}

export interface ResumenCosto {
  completo: boolean;
  lineas_incompletas: number;
  total_ingredientes: string | null;
  total_otros_costos: string;
  costo_tanda: string | null;
  costo_unidad: string | null;
  precio_mas_antiguo: string | null;
}

export interface CostosProducto {
  producto_id: number;
  producto_nombre: string;
  tiene_formulacion: boolean;
  version_id: number | null;
  rendimiento: number | null;
  lineas: LineaCosto[];
  otros_costos: OtroCosto[];
  resumen: ResumenCosto;
}

/** Cuerpo del PUT: un campo omitido no se toca. `cantidad` y `unidad` van juntas o ambas en null. */
export interface CantidadIngredientePayload {
  ingrediente_id: number;
  cantidad: string | null;
  unidad: UnidadCosto | null;
}

export interface CostosUpdatePayload {
  rendimiento?: number | null;
  cantidades?: CantidadIngredientePayload[];
  otros_costos?: { nombre: string; monto: string }[];
}

/** Insumo elegido "solo por ahora": ingrediente_id → insumo_id. No se guarda. */
export type Alternativas = Record<number, number>;
