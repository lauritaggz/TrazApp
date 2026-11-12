import type { EstadoElaboracion } from "@/types/elaboracion";

/** Where the data of an elaboración comes from: a finalizada keeps its copy, a borrador shows today's data. */
export type OrigenDatos = "conservada" | "vigente";
/** `pendiente` only happens in a borrador whose lot is not defined yet. */
export type LoteEstado = "con_lote" | "sin_lote" | "pendiente";

export interface UsoRelacionado {
  ingrediente: { id: number | null; nombre: string | null };
  insumo_nombre: string | null;
  lote: { id: number | null; codigo: string | null; fecha_vencimiento: string | null } | null;
  lote_estado: LoteEstado;
}

export interface ElaboracionRelacionada {
  id: number;
  codigo: string;
  fecha: string;
  estado: EstadoElaboracion;
  finalizada_at: string | null;
  producto: { id: number; nombre: string; publicado: boolean };
  oculta: boolean;
  visible_publicamente: boolean;
  origen_datos: OrigenDatos;
  usos: UsoRelacionado[];
}

export interface ResumenLote {
  total_elaboraciones: number;
  total_productos: number;
  finalizadas: number;
  borradores: number;
  visibles_publicamente: number;
}

export interface ResumenInsumo extends ResumenLote {
  elaboraciones_sin_lote: number;
}

export interface InsumoEncabezado {
  id: number;
  nombre: string;
  activo: boolean;
}

/** GET /gestion/insumos/{id}/elaboraciones (HU08, T08-01). */
export interface ElaboracionesDeInsumo {
  insumo: InsumoEncabezado;
  resumen: ResumenInsumo;
  elaboraciones: ElaboracionRelacionada[];
}

/** Elaboraciones of the same supply that are NOT in the result and cannot be ruled out (only numbers). */
export interface OtrasSinLote {
  sin_lote: number;
  lote_pendiente: number;
}

/** GET /gestion/insumos/{id}/lotes/{lote}/elaboraciones (HU08, T08-02). */
export interface ElaboracionesDeLote {
  insumo: InsumoEncabezado;
  lote: { id: number; codigo: string };
  resumen: ResumenLote;
  otras_sin_lote: OtrasSinLote;
  elaboraciones: ElaboracionRelacionada[];
}

/** What the screens work with: the result of either query. */
export type ResultadoRelacionadas = ElaboracionesDeInsumo | ElaboracionesDeLote;
