import type { UnidadMedida } from "@/types/product";

export interface FormulacionLinea {
  id: number;
  ingrediente_id: number;
  ingrediente_nombre: string;
  ingrediente_codigo_interno: string | null;
  ingrediente_tipo: string | null;
  porcentaje: string | null;
  cantidad: string | null;
  unidad: UnidadMedida | null;
  orden: number | null;
  notas: string | null;
  ingrediente_desactivado: boolean;
}

export interface FormulacionVersion {
  id: number;
  producto_id: number;
  numero_version: number;
  descripcion: string;
  fecha_creacion: string;
  vigente: boolean;
  usada_en_elaboracion: boolean;
  lineas: FormulacionLinea[];
}

/** GET /gestion/productos/{id}/formulacion: `existe` is false while there is none. */
export interface FormulacionVigente {
  existe: boolean;
  version: FormulacionVersion | null;
}

/** GET /gestion/productos/{id}/versiones item, newest first. */
export interface VersionProductoHistorial {
  id: number;
  numero_version: number;
  descripcion: string;
  fecha_creacion: string;
  vigente: boolean;
  usada_en_elaboracion: boolean;
  cantidad_lineas: number;
}

export type ResultadoGuardadoFormulacion =
  | "version_creada"
  | "modificada_en_lugar"
  | "nueva_version"
  | "sin_cambios";

export interface FormulacionGuardada {
  resultado: ResultadoGuardadoFormulacion;
  version: FormulacionVersion;
}

/** `cantidad` and `unidad` are sent together or not at all. */
export interface FormulacionLineaPayload {
  ingrediente_id: number;
  cantidad?: string;
  unidad?: UnidadMedida;
  notas?: string;
}

/** PUT /gestion/productos/{id}/formulacion: the full list; its order defines `orden`. */
export interface FormulacionReemplazoPayload {
  lineas: FormulacionLineaPayload[];
}

export interface FormulacionDraftLine {
  ingrediente_id: number;
  nombre: string;
  codigo_interno: string | null;
  cantidad: string;
  unidad: "" | UnidadMedida;
  notas: string | null;
  desactivado: boolean;
}
