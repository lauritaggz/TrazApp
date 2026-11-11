export const MENSAJE_ELABORACION_NO_DISPONIBLE = "No encontramos información disponible para esa elaboración";

export interface TextosDeEstado {
  etiqueta: string;
  titulo: string;
  descripcion: string;
}

/** What a 404 means for the consumer: not published, deleted or unknown look the same. */
export const ESTADO_404_PUBLICO: TextosDeEstado = {
  etiqueta: "Ficha no disponible",
  titulo: "Información no disponible",
  descripcion: "No hay información para consultar con este código QR. Revisa el rotulado del envase.",
};
