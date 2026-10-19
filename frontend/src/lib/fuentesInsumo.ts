/**
 * The sources a supply's information can come from, and the name the productor sees for each.
 *
 * This is the ONLY file of src/ that names a source for the user (a static test enforces it): every
 * screen asks `nombreFuente`. A new source (HU07) is added here and nowhere else.
 */

export const FUENTE_MANUAL = "manual";

const NOMBRES: Record<string, string> = {
  [FUENTE_MANUAL]: "Registro manual",
  open_food_facts: "Open Food Facts",
};

/** The visible name of a source; an unknown value is shown as it came. */
export function nombreFuente(fuente: string): string {
  return NOMBRES[fuente] ?? fuente;
}

export function esFuenteManual(fuente: string): boolean {
  return fuente === FUENTE_MANUAL;
}

/**
 * The page of the product in its source, taken from the data record (`ficha.url`). It is a link the
 * productor opens, so only http(s) addresses are accepted: anything else (for example `javascript:`)
 * is dropped.
 */
export function urlDeLaFicha(ficha: Record<string, unknown> | null | undefined): string | null {
  const url = ficha?.url;
  if (typeof url !== "string") return null;
  try {
    const analizada = new URL(url);
    return analizada.protocol === "https:" || analizada.protocol === "http:" ? analizada.href : null;
  } catch {
    return null;
  }
}
