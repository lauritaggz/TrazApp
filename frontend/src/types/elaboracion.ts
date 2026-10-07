import type { AlergenoDeclarado } from "@/types/insumo";
import type { UnidadMedida } from "@/types/product";

export type EstadoElaboracion = "borrador" | "finalizada";

/** What is missing in a line of a borrador. */
export type FaltanteUso = "insumo" | "lote";

/** Why a line blocks the finalization (409 `problemas`). */
export type MotivoProblema =
  | "insumo"
  | "lote"
  | "insumo_desactivado"
  | "ingrediente_desactivado";

export interface InsumoUsado {
  id: number;
  nombre: string;
  marca_origen: string;
  presentacion: string | null;
  codigo_barras: string | null;
  ingredientes_declarados: string | null;
  advertencias: string | null;
  alergenos: AlergenoDeclarado[];
  /** Live flags: null in a finalizada, which shows the copy conserved when it was finalized. */
  activo: boolean | null;
  habitual: boolean | null;
}

export interface LoteUsado {
  id: number;
  codigo: string;
  fecha_vencimiento: string | null;
}

export interface UsoInsumo {
  ingrediente_id: number;
  ingrediente_nombre: string;
  orden: number | null;
  cantidad: string | null;
  unidad: UnidadMedida | null;
  insumo: InsumoUsado | null;
  lote: LoteUsado | null;
  sin_lote: boolean;
  pendiente: boolean;
  falta: FaltanteUso[];
  insumo_desactivado: boolean;
  ingrediente_desactivado: boolean;
}

export interface Elaboracion {
  id: number;
  producto: { id: number; nombre: string };
  version: { id: number; numero_version: number };
  codigo: string;
  fecha: string;
  estado: EstadoElaboracion;
  finalizada_at: string | null;
  created_at: string;
  updated_at: string;
  usos: UsoInsumo[];
}

export interface ElaboracionResumen {
  id: number;
  producto: { id: number; nombre: string };
  version: { id: number; numero_version: number };
  codigo: string;
  fecha: string;
  estado: EstadoElaboracion;
  finalizada_at: string | null;
  total_ingredientes: number;
  pendientes: number;
}

export interface LoteInsumo {
  id: number;
  insumo_id: number;
  codigo: string;
  fecha_vencimiento: string | null;
  created_at: string;
}

export interface ElaboracionCreatePayload {
  codigo?: string;
  fecha?: string;
}

export interface ElaboracionUpdatePayload {
  codigo?: string;
  fecha?: string;
}

export type LotePayload =
  | { tipo: "nuevo"; codigo: string; fecha_vencimiento: string | null }
  | { tipo: "existente"; lote_id: number }
  | { tipo: "sin_lote" };

export interface UsoPayload {
  ingrediente_id: number;
  insumo_id: number | null;
  lote?: LotePayload;
}

export interface ProblemaFinalizacion {
  ingrediente_id: number;
  ingrediente_nombre: string;
  falta: MotivoProblema;
}

/** How the productor handles the lot of a line. */
export type LoteModo = "" | "nuevo" | "existente" | "sin_lote";

/** Local, editable state of one ingredient line of the registro screen. */
export interface LineaRegistro {
  ingrediente_id: number;
  ingrediente_nombre: string;
  orden: number | null;
  cantidad: string | null;
  unidad: UnidadMedida | null;
  /** Selected supply id as a string (a select value); "" while pending. */
  insumoId: string;
  loteModo: LoteModo;
  loteCodigo: string;
  loteVence: string;
  /** Selected existing lot id as a string. */
  loteId: string;
  /** From the server, to warn before saving. */
  ingredienteDesactivado: boolean;
}

export interface RegistroEncabezado {
  codigo: string;
  fecha: string;
}
