import type { ResumenEvaluacion } from "@/types/product";

export const TEXTO_SIN_RESPUESTAS = "Sin respuestas todavía";

export function textoRespuestas(total: number): string {
  return `${total} ${total === 1 ? "respuesta" : "respuestas"}`;
}

/** «75 %», or null while there are no answers: never «0 %» for a product nobody has answered. */
export function textoPorcentaje(resumen: Pick<ResumenEvaluacion, "porcentaje">): string | null {
  return resumen.porcentaje === null ? null : `${resumen.porcentaje} %`;
}

/** One line for the list: «Utilidad: 75 % · 4 respuestas» or «Sin respuestas todavía». */
export function textoUtilidad(resumen: ResumenEvaluacion | undefined): string {
  if (!resumen || resumen.total === 0 || resumen.porcentaje === null) return TEXTO_SIN_RESPUESTAS;
  return `Utilidad: ${textoPorcentaje(resumen)} · ${textoRespuestas(resumen.total)}`;
}
