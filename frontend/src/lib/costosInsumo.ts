import { formatearFechaCorta } from "@/lib/dinero";
import { nombreFuente } from "@/lib/fuentesInsumo";

/**
 * Precio y contenido de un insumo (HU14, CA5): límites, validación, origen y destino de la edición.
 * Los valores son texto en todo momento; nunca se convierten a `number`.
 */

export const UNIDADES_CONTENIDO = ["g", "kg", "ml", "L", "unidad"] as const;
export type UnidadContenido = (typeof UNIDADES_CONTENIDO)[number];

// Límites del esquema del backend (backend/app/schemas/insumo.py, InsumoUpdate):
//   precio_referencia  → ge=0, max_digits=12, decimal_places=2  (hasta 10 enteros y 2 decimales)
//   contenido_cantidad → gt=0, max_digits=12, decimal_places=3  (hasta 9 enteros y 3 decimales)
//   contenido_unidad   → "g" | "kg" | "ml" | "L" | "unidad"; la cantidad y la unidad van juntas.
export const PRECIO_MAX_ENTEROS = 10;
export const PRECIO_MAX_DECIMALES = 2;
export const CONTENIDO_MAX_ENTEROS = 9;
export const CONTENIDO_MAX_DECIMALES = 3;

function patron(enteros: number, decimales: number): RegExp {
  return new RegExp(`^\\d{1,${enteros}}([.,]\\d{1,${decimales}})?$`);
}

const PATRON_PRECIO = patron(PRECIO_MAX_ENTEROS, PRECIO_MAX_DECIMALES);
const PATRON_CONTENIDO = patron(CONTENIDO_MAX_ENTEROS, CONTENIDO_MAX_DECIMALES);

/** Texto con punto decimal y sin ceros sobrantes ("1000,50" → "1000.5"); "" si está vacío. */
export function canonico(texto: string): string {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "") return "";
  const [entero, decimales = ""] = limpio.split(".");
  const e = entero.replace(/^0+(?=\d)/, "");
  const d = decimales.replace(/0+$/, "");
  return d === "" ? e : `${e}.${d}`;
}

/** El texto que se escribe en el campo a partir de lo que guardó el backend ("1000.00" → "1000"). */
export function aTextoEditable(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  return canonico(String(valor)).replace(".", ",");
}

export function esVacio(texto: string): boolean {
  return texto.trim() === "";
}

export function validarPrecio(texto: string): string | undefined {
  if (esVacio(texto)) return undefined;
  if (!PATRON_PRECIO.test(texto.trim())) {
    return `Indica un monto en pesos, de 0 en adelante, con hasta ${PRECIO_MAX_DECIMALES} decimales.`;
  }
  return undefined;
}

export interface ErroresContenido {
  contenido_cantidad?: string;
  contenido_unidad?: string;
}

export function validarContenido(cantidad: string, unidad: string): ErroresContenido {
  const errores: ErroresContenido = {};
  const hayCantidad = !esVacio(cantidad);
  const hayUnidad = unidad !== "";
  if (hayCantidad) {
    const texto = cantidad.trim();
    if (!PATRON_CONTENIDO.test(texto) || /^0+([.,]0+)?$/.test(texto)) {
      errores.contenido_cantidad = `Indica una cantidad mayor que 0, con hasta ${CONTENIDO_MAX_DECIMALES} decimales.`;
    }
  }
  if (hayUnidad && !(UNIDADES_CONTENIDO as readonly string[]).includes(unidad)) {
    errores.contenido_unidad = "Elige una unidad de la lista.";
  }
  if (hayCantidad && !hayUnidad && !errores.contenido_unidad) {
    errores.contenido_unidad = "Indica la unidad del contenido.";
  }
  if (hayUnidad && !hayCantidad && !errores.contenido_cantidad) {
    errores.contenido_cantidad = "Indica la cantidad del contenido.";
  }
  return errores;
}

/** "Jumbo · 12-11-2026", "Open Food Facts", "Manual · 14-11-2026". Null si no hay fuente. */
export function etiquetaDeOrigen(fuente: string | null | undefined, fechaIso?: string | null): string | null {
  if (!fuente) return null;
  const nombre = fuente === "manual" ? "Manual" : nombreFuente(fuente);
  const fecha = formatearFechaCorta(fechaIso);
  return fecha ? `${nombre} · ${fecha}` : nombre;
}

/** El slug de la ficha de Jumbo del insumo, con la misma regla del backend (`ficha.jumbo.slug` o `ficha.slug`). */
export function slugDeJumbo(ficha: Record<string, unknown> | null | undefined): string | null {
  if (!ficha || typeof ficha !== "object") return null;
  const deJumbo = ficha.jumbo;
  for (const origen of [deJumbo, ficha]) {
    const slug = origen && typeof origen === "object" ? (origen as Record<string, unknown>).slug : undefined;
    if (typeof slug === "string" && slug !== "") return slug;
  }
  return null;
}

/** Solo se vuelve a la calculadora (HU14): `/calculadora` o `/calculadora?producto=<id>`. Cualquier otro destino se ignora. */
const DESTINO_VALIDO = /^\/calculadora(\?producto=\d{1,9})?$/;

export function destinoDeRetorno(valor: string | null | undefined): string | null {
  return typeof valor === "string" && DESTINO_VALIDO.test(valor) ? valor : null;
}

export function enlaceDeEdicionDesdeCalculadora(insumoId: number, productoId: number): string {
  const volver = encodeURIComponent(`/calculadora?producto=${productoId}`);
  return `/insumos/${insumoId}/editar?volver=${volver}`;
}
