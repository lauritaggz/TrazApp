/**
 * Formato de pesos y cantidades a partir del TEXTO que manda el backend (HU14).
 *
 * Los Decimal llegan como texto con decimales fijos ("250.0000"). Aquí nunca se convierten a `number`
 * ni se opera con float: el frontend solo muestra lo que calcula el backend. El redondeo a pesos
 * enteros usa la misma regla que el backend (ROUND_HALF_UP, el empate se aleja del cero) y se hace
 * sobre los dígitos del texto.
 */

const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;

interface PartesDecimal {
  negativo: boolean;
  entero: string;
  decimales: string;
}

function partes(texto: string | null | undefined): PartesDecimal | null {
  if (typeof texto !== "string") return null;
  const m = DECIMAL.exec(texto.trim());
  if (!m) return null;
  // Sin ceros a la izquierda ("007" → "7"), pero conserva un único "0".
  const entero = m[2].replace(/^0+(?=\d)/, "");
  return { negativo: m[1] === "-", entero, decimales: m[3] ?? "" };
}

/** Suma 1 a un entero escrito en dígitos, con acarreo, sin pasar por `number`. */
function sumarUno(entero: string): string {
  const dígitos = entero.split("");
  let i = dígitos.length - 1;
  while (i >= 0) {
    if (dígitos[i] === "9") {
      dígitos[i] = "0";
      i -= 1;
    } else {
      dígitos[i] = String(Number(dígitos[i]) + 1);
      return dígitos.join("");
    }
  }
  return `1${dígitos.join("")}`;
}

function agruparMiles(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Pesos enteros (ROUND_HALF_UP) como texto de dígitos: "1249.5000" → "1250". Null si no es un decimal. */
export function redondearPesos(texto: string | null | undefined): string | null {
  const p = partes(texto);
  if (!p) return null;
  const sube = p.decimales !== "" && p.decimales[0] >= "5";
  const entero = sube ? sumarUno(p.entero) : p.entero;
  return p.negativo && entero !== "0" ? `-${entero}` : entero;
}

/** "$1.250" (redondeado a pesos). Un valor ausente o inválido se muestra como "—". */
export function formatearPesos(texto: string | null | undefined): string {
  const redondeado = redondearPesos(texto);
  if (redondeado === null) return "—";
  const negativo = redondeado.startsWith("-");
  const digitos = negativo ? redondeado.slice(1) : redondeado;
  return `${negativo ? "-" : ""}$${agruparMiles(digitos)}`;
}

/** Quita los ceros finales de la parte decimal: "250.500" → { entero: "250", decimales: "5" }. */
function sinCerosFinales(p: PartesDecimal): PartesDecimal {
  return { ...p, decimales: p.decimales.replace(/0+$/, "") };
}

/**
 * Precio de un insumo: "$1.000" y, solo si trae centavos distintos de cero, "$1.000,50".
 * No se redondea: es el precio tal como se guardó.
 */
export function formatearPrecio(texto: string | null | undefined): string {
  const p = partes(texto);
  if (!p) return "—";
  const limpio = sinCerosFinales(p);
  const signo = limpio.negativo ? "-" : "";
  const base = `${signo}$${agruparMiles(limpio.entero)}`;
  if (limpio.decimales === "") return base;
  return `${base},${limpio.decimales.padEnd(2, "0")}`;
}

/** Cantidad sin ceros sobrantes y con coma decimal: "250.000" → "250"; "1.500" → "1,5". */
export function formatearCantidad(texto: string | null | undefined): string {
  const p = partes(texto);
  if (!p) return "—";
  const limpio = sinCerosFinales(p);
  const signo = limpio.negativo ? "-" : "";
  const entero = agruparMiles(limpio.entero);
  return limpio.decimales === "" ? `${signo}${entero}` : `${signo}${entero},${limpio.decimales}`;
}

/** Fecha "12-11-2026" tomada del texto ISO, sin pasar por `Date` (evita el desfase por zona horaria). */
export function formatearFechaCorta(iso: string | null | undefined): string | null {
  if (typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
