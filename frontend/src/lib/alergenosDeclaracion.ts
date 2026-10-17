import type { AlergenoDeclaradoInput, AlergenosValue } from "@/types/insumo";

export const MENSAJE_ALERGENOS_INVALIDOS =
  "Declara los alérgenos del insumo o confirma que no contiene.";

/** Valid = at least one allergen declared, or the productor confirmed that there are none. */
export function alergenosValidos(value: AlergenosValue): boolean {
  return value.items.length > 0 || value.sinAlergenos;
}

/** What is sent to the API: the declared allergens, or [] when the productor confirmed none. */
export function alergenosParaEnviar(value: AlergenosValue): AlergenoDeclaradoInput[] {
  return value.sinAlergenos ? [] : value.items.map((item) => ({ ...item }));
}

function clave(value: AlergenosValue): string {
  const items = [...value.items]
    .sort((a, b) => a.alergeno_id - b.alergeno_id)
    .map((item) => `${item.alergeno_id}:${item.tipo}`);
  return `${value.sinAlergenos ? "1" : "0"}|${items.join(",")}`;
}

export function alergenosCambiaron(actual: AlergenosValue, base: AlergenosValue): boolean {
  return clave(actual) !== clave(base);
}
