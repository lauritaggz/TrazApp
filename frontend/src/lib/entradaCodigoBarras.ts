/**
 * Manual entry of a barcode (HU13 / T13-02): what the productor types when the camera is not
 * available or cannot read the code. The backend remains the authority; this only tells the problem
 * before sending.
 */
import { validarCodigoBarras } from "@/lib/codigoBarras";

export const MENSAJE_CODIGO_VACIO = "Ingresa el número del código de barras.";

// Codes are printed and copied with spaces and hyphens («780 291 0000971», «7802910-000971»),
// including the typographic hyphens that a copy from a web page or a PDF brings along.
const SEPARADORES = /[\s\-\u2010\u2011\u2012\u2013\u2014\u2212]/g;

/** Removes spaces and hyphens. Leading zeros are kept: they belong to the code. */
export function limpiarEntradaManual(valor: string): string {
  return valor.replace(SEPARADORES, "");
}

export type ResultadoEntradaManual =
  | { codigo: string; error: null }
  | { codigo: null; error: string };

/** The code to deliver, or the message to show next to the field. */
export function validarEntradaManual(valor: string): ResultadoEntradaManual {
  const codigo = limpiarEntradaManual(valor);
  if (codigo === "") return { codigo: null, error: MENSAJE_CODIGO_VACIO };
  const error = validarCodigoBarras(codigo);
  return error === null ? { codigo, error: null } : { codigo: null, error };
}
