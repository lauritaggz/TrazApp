/**
 * Propone un código interno a partir del nombre: tres letras en mayúscula y un
 * correlativo (p. ej. "Galleta de chocolate" -> "GAL-001"). Es solo una ayuda de
 * escritura: el productor puede editarlo y el servidor valida que no se repita.
 */
export function suggestInternalCode(name: string): string | null {
  const letters = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  if (letters.length < 2) return null;
  return `${letters.slice(0, 3)}-001`;
}
