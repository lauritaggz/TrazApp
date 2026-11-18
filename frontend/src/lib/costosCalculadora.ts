import { aTextoEditable, canonico, esVacio, UNIDADES_CONTENIDO } from "@/lib/costosInsumo";
import type { CantidadIngredientePayload, CostosProducto, CostosUpdatePayload, UnidadCosto } from "@/types/costos";

/**
 * Edición de la calculadora de costos (HU14): borrador, validación y cuerpo del PUT.
 * Todo es texto; ningún valor se convierte a `number` (el rendimiento, que es un entero, solo se compara).
 */

// Límites del esquema del backend (backend/app/schemas/costos.py):
//   rendimiento       → entero, 1 a RENDIMIENTO_MAXIMO (1.000.000)
//   cantidad          → > 0, max_digits=12, decimal_places=3  (hasta 9 enteros y 3 decimales)
//   monto otro costo  → ≥ 0, max_digits=12, decimal_places=2  (hasta 10 enteros y 2 decimales)
//   nombre otro costo → 1 a 100 caracteres (sin espacios en los extremos)
//   MAX_OTROS_COSTOS=50
export const RENDIMIENTO_MAXIMO = 1_000_000;
export const CANTIDAD_MAX_ENTEROS = 9;
export const CANTIDAD_MAX_DECIMALES = 3;
export const MONTO_MAX_ENTEROS = 10;
export const MONTO_MAX_DECIMALES = 2;
export const NOMBRE_OTRO_COSTO_MAX = 100;
export const MAX_OTROS_COSTOS = 50;

/** Unidades en las que se puede expresar la cantidad de un ingrediente (las mismas del contenido del insumo). */
export const UNIDADES_CANTIDAD = UNIDADES_CONTENIDO;

const PATRON_CANTIDAD = new RegExp(`^\\d{1,${CANTIDAD_MAX_ENTEROS}}([.,]\\d{1,${CANTIDAD_MAX_DECIMALES}})?$`);
const PATRON_MONTO = new RegExp(`^\\d{1,${MONTO_MAX_ENTEROS}}([.,]\\d{1,${MONTO_MAX_DECIMALES}})?$`);
const PATRON_ENTERO = /^\d{1,7}$/;

export interface BorradorLinea {
  cantidad: string;
  unidad: string;
}

export interface BorradorOtroCosto {
  /** Identidad de la fila en pantalla; no viaja al servidor. */
  clave: number;
  nombre: string;
  monto: string;
}

export interface Borrador {
  rendimiento: string;
  lineas: Record<number, BorradorLinea>;
  otros: BorradorOtroCosto[];
}

/** Lo que muestra el borrador cuando no se ha editado nada: lo guardado, escrito como se edita. */
export function borradorDesde(datos: CostosProducto): Borrador {
  const lineas: Record<number, BorradorLinea> = {};
  for (const linea of datos.lineas) {
    lineas[linea.ingrediente_id] = { cantidad: aTextoEditable(linea.cantidad), unidad: linea.unidad ?? "" };
  }
  return {
    rendimiento: datos.rendimiento === null ? "" : String(datos.rendimiento),
    lineas,
    otros: datos.otros_costos.map((o) => ({ clave: o.id, nombre: o.nombre, monto: aTextoEditable(o.monto) })),
  };
}

export interface ErroresBorrador {
  rendimiento?: string;
  lineas: Record<number, { cantidad?: string; unidad?: string }>;
  otros: Record<number, { nombre?: string; monto?: string }>;
  /** Hay más filas de las que acepta el servidor. */
  otrosExceso?: string;
}

export function validarRendimiento(texto: string): string | undefined {
  if (esVacio(texto)) return undefined;
  const t = texto.trim();
  if (!PATRON_ENTERO.test(t) || t.replace(/^0+/, "") === "" || Number.parseInt(t, 10) > RENDIMIENTO_MAXIMO) {
    return "Indica un número entero de 1 a 1.000.000.";
  }
  return undefined;
}

export function validarCantidad(cantidad: string, unidad: string): { cantidad?: string; unidad?: string } {
  if (esVacio(cantidad)) return {};
  const errores: { cantidad?: string; unidad?: string } = {};
  const t = cantidad.trim();
  if (!PATRON_CANTIDAD.test(t) || /^0+([.,]0+)?$/.test(t)) {
    errores.cantidad = `Indica una cantidad mayor que 0, con hasta ${CANTIDAD_MAX_DECIMALES} decimales.`;
  }
  if (!(UNIDADES_CANTIDAD as readonly string[]).includes(unidad)) errores.unidad = "Elige la unidad.";
  return errores;
}

export function validarMonto(texto: string): string | undefined {
  if (esVacio(texto)) return "Indica el monto.";
  if (!PATRON_MONTO.test(texto.trim())) {
    return `Indica un monto de 0 en adelante, con hasta ${MONTO_MAX_DECIMALES} decimales.`;
  }
  return undefined;
}

export function validarNombreOtroCosto(texto: string): string | undefined {
  const t = texto.trim();
  if (t === "") return "Indica el nombre del costo.";
  if (t.length > NOMBRE_OTRO_COSTO_MAX) return `El nombre admite hasta ${NOMBRE_OTRO_COSTO_MAX} caracteres.`;
  return undefined;
}

export function validarBorrador(borrador: Borrador): ErroresBorrador {
  const errores: ErroresBorrador = { lineas: {}, otros: {} };
  errores.rendimiento = validarRendimiento(borrador.rendimiento);
  for (const [id, linea] of Object.entries(borrador.lineas)) {
    const e = validarCantidad(linea.cantidad, linea.unidad);
    if (e.cantidad || e.unidad) errores.lineas[Number(id)] = e;
  }
  for (const otro of borrador.otros) {
    const nombre = validarNombreOtroCosto(otro.nombre);
    const monto = validarMonto(otro.monto);
    if (nombre || monto) errores.otros[otro.clave] = { nombre, monto };
  }
  if (borrador.otros.length > MAX_OTROS_COSTOS) {
    errores.otrosExceso = `Puedes agregar hasta ${MAX_OTROS_COSTOS} otros costos.`;
  }
  return errores;
}

export function hayErrores(errores: ErroresBorrador): boolean {
  return (
    errores.rendimiento !== undefined ||
    errores.otrosExceso !== undefined ||
    Object.keys(errores.lineas).length > 0 ||
    Object.keys(errores.otros).length > 0
  );
}

function cantidadEfectiva(linea: BorradorLinea | undefined): { cantidad: string; unidad: string } {
  if (!linea || esVacio(linea.cantidad)) return { cantidad: "", unidad: "" };
  return { cantidad: canonico(linea.cantidad), unidad: linea.unidad };
}

function huellaOtro(o: { nombre: string; monto: string }): string {
  return `${o.nombre.trim()}|${canonico(o.monto)}`;
}

/**
 * Lo que cambió respecto de lo guardado, listo para el PUT: solo las líneas cuya cantidad o unidad cambió,
 * y la lista COMPLETA de otros costos si esa lista cambió. Sin cambios devuelve un objeto vacío.
 * Se asume un borrador ya validado.
 */
export function construirPayload(datos: CostosProducto, borrador: Borrador): CostosUpdatePayload {
  const payload: CostosUpdatePayload = {};

  const rendimiento = borrador.rendimiento.trim() === "" ? null : Number.parseInt(borrador.rendimiento.trim(), 10);
  if (rendimiento !== datos.rendimiento) payload.rendimiento = rendimiento;

  const cantidades: CantidadIngredientePayload[] = [];
  for (const linea of datos.lineas) {
    const antes = cantidadEfectiva({ cantidad: aTextoEditable(linea.cantidad), unidad: linea.unidad ?? "" });
    const ahora = cantidadEfectiva(borrador.lineas[linea.ingrediente_id]);
    if (antes.cantidad === ahora.cantidad && antes.unidad === ahora.unidad) continue;
    cantidades.push(
      ahora.cantidad === ""
        ? { ingrediente_id: linea.ingrediente_id, cantidad: null, unidad: null }
        : { ingrediente_id: linea.ingrediente_id, cantidad: ahora.cantidad, unidad: ahora.unidad as UnidadCosto },
    );
  }
  if (cantidades.length > 0) payload.cantidades = cantidades;

  const antes = datos.otros_costos.map(huellaOtro);
  const ahora = borrador.otros.map(huellaOtro);
  if (antes.length !== ahora.length || antes.some((v, i) => v !== ahora[i])) {
    payload.otros_costos = borrador.otros.map((o) => ({ nombre: o.nombre.trim(), monto: canonico(o.monto) }));
  }
  return payload;
}

export function hayCambios(datos: CostosProducto, borrador: Borrador): boolean {
  return Object.keys(construirPayload(datos, borrador)).length > 0;
}

// --- textos ----------------------------------------------------------------------------------------

export const ETIQUETA_ORIGEN: Record<string, string> = {
  ultima_elaboracion: "Última elaboración",
  habitual: "Insumo habitual",
  elegido: "Elegido ahora (no se guarda)",
};

export const AVISO_ULTIMO_INACTIVO = "ultimo_inactivo";
export const TEXTO_ULTIMO_INACTIVO = "El insumo de la última elaboración ya no está activo";
