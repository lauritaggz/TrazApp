/**
 * Barcode normalization and validation. Mirrors the backend rules (app/core/codigo_barras.py)
 * so the form can tell the problem before sending; the backend remains the authority.
 *
 * Accepted: EAN-8, UPC-A (12 digits) and EAN-13, with a valid GS1 check digit.
 */

export const MENSAJE_CODIGO_FORMATO =
  "El código de barras debe tener 8, 12 o 13 dígitos numéricos.";
export const MENSAJE_CODIGO_DIGITO_VERIFICADOR =
  "El dígito verificador del código de barras no es válido.";

const LARGOS_VALIDOS = new Set([8, 12, 13]);

/** Removes every whitespace character; an empty result means "no barcode" (null). */
export function normalizarCodigoBarras(value: string): string | null {
  const normalizado = value.replace(/\s+/g, "");
  return normalizado === "" ? null : normalizado;
}

export function digitoVerificadorValido(codigo: string): boolean {
  const cuerpo = codigo.slice(0, -1);
  const digito = Number(codigo.slice(-1));
  let suma = 0;
  for (let i = 0; i < cuerpo.length; i += 1) {
    const d = Number(cuerpo[cuerpo.length - 1 - i]);
    suma += d * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (suma % 10)) % 10 === digito;
}

/** Error message for a raw input value, or null when it is empty or valid. */
export function validarCodigoBarras(value: string): string | null {
  const codigo = normalizarCodigoBarras(value);
  if (codigo === null) return null;
  if (!/^[0-9]+$/.test(codigo) || !LARGOS_VALIDOS.has(codigo.length)) {
    return MENSAJE_CODIGO_FORMATO;
  }
  if (!digitoVerificadorValido(codigo)) return MENSAJE_CODIGO_DIGITO_VERIFICADOR;
  return null;
}
