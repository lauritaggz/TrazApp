/** Public consultation (HU10): GET /publico/productos/{id_publico}. Mirrors the API whitelist. */

export type EstadoElaboracionPublica = "ok" | "no_disponible" | "varias" | "sin_elaboraciones";

export type TipoAlergenoPublico = "contiene" | "puede_contener";

export interface AlergenoDeInsumoPublico {
  codigo: string;
  nombre: string;
  tipo: TipoAlergenoPublico;
}

export interface AlergenoGrupoPublico {
  codigo: string;
  nombre: string;
}

export interface InsumoPublico {
  ingrediente: string;
  nombre: string;
  marca_origen: string;
  ingredientes_declarados: string | null;
  advertencias: string | null;
  alergenos: AlergenoDeInsumoPublico[];
}

export interface ElaboracionResumenPublica {
  codigo: string;
  /** ISO date, YYYY-MM-DD. */
  fecha: string;
}

export interface ElaboracionPublica extends ElaboracionResumenPublica {
  insumos: InsumoPublico[];
  alergenos: {
    contiene: AlergenoGrupoPublico[];
    puede_contener: AlergenoGrupoPublico[];
  };
  /** True when the recipe version of the elaboración is not the current one. */
  version_anterior: boolean;
}

export interface ProductoPublico {
  /** Null only in the productor's preview of a product never published. */
  id_publico: string | null;
  nombre: string;
  /** Decimal as text, e.g. "250.000". */
  contenido_neto: string | null;
  unidad_medida: string | null;
  presentacion: string | null;
  imagen_url: string | null;
  categorias: string[];
  elaborado_por: string | null;
}

export interface FichaPublica {
  producto: ProductoPublico;
  /** Visible elaboraciones, most recent first. */
  elaboraciones: ElaboracionResumenPublica[];
  elaboracion: ElaboracionPublica | null;
  estado_elaboracion: EstadoElaboracionPublica;
  /** Only filled with estado_elaboracion "varias". */
  coincidencias: ElaboracionResumenPublica[];
}

/** Which elaboración the consumer asks for: by code or by date (never both from the UI). */
export interface SeleccionElaboracion {
  codigo?: string;
  fecha?: string;
}
