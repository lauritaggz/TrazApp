import { normalizarCodigoBarras, validarCodigoBarras } from "@/lib/codigoBarras";
import { aTextoEditable, canonico, esVacio, validarContenido, validarPrecio } from "@/lib/costosInsumo";
import type {
  Insumo,
  InsumoCreatePayload,
  InsumoFormValues,
  InsumoUpdatePayload,
} from "@/types/insumo";

const MAX_NOMBRE = 255;
const MAX_MARCA = 255;
const MAX_PRESENTACION = 255;

export type InsumoFormFieldErrors = Partial<Record<keyof InsumoFormValues, string>>;

/** Orden visual del formulario: el foco tras un error sigue lo que el usuario ve. */
export const INSUMO_FORM_FIELD_ORDER: (keyof InsumoFormValues)[] = [
  "nombre",
  "marca_origen",
  "ingrediente_id",
  "presentacion",
  "codigo_barras",
  "precio",
  "contenido_cantidad",
  "contenido_unidad",
  "ingredientes_declarados",
  "advertencias",
  "habitual",
];

export function insumoToFormValues(insumo: Insumo): InsumoFormValues {
  return {
    nombre: insumo.nombre,
    marca_origen: insumo.marca_origen,
    ingrediente_id: String(insumo.ingrediente_id),
    presentacion: insumo.presentacion ?? "",
    codigo_barras: insumo.codigo_barras ?? "",
    ingredientes_declarados: insumo.ingredientes_declarados ?? "",
    advertencias: insumo.advertencias ?? "",
    habitual: insumo.habitual,
    precio: aTextoEditable(insumo.precio_referencia),
    contenido_cantidad: aTextoEditable(insumo.contenido_cantidad),
    contenido_unidad: insumo.contenido_unidad ?? "",
  };
}

export function validateInsumoForm(values: InsumoFormValues): InsumoFormFieldErrors {
  const errors: InsumoFormFieldErrors = {};

  const nombre = values.nombre.trim();
  if (!nombre) errors.nombre = "El nombre es obligatorio.";
  else if (nombre.length > MAX_NOMBRE) errors.nombre = `Máximo ${MAX_NOMBRE} caracteres.`;

  const marca = values.marca_origen.trim();
  if (!marca) errors.marca_origen = "La marca u origen es obligatoria.";
  else if (marca.length > MAX_MARCA) errors.marca_origen = `Máximo ${MAX_MARCA} caracteres.`;

  if (!values.ingrediente_id) {
    errors.ingrediente_id = "Selecciona el ingrediente que abastece este insumo.";
  }

  if (values.presentacion.trim().length > MAX_PRESENTACION) {
    errors.presentacion = `Máximo ${MAX_PRESENTACION} caracteres.`;
  }

  const codigoError = validarCodigoBarras(values.codigo_barras);
  if (codigoError) errors.codigo_barras = codigoError;

  const precioError = validarPrecio(values.precio);
  if (precioError) errors.precio = precioError;
  Object.assign(errors, validarContenido(values.contenido_cantidad, values.contenido_unidad));

  return errors;
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function toCreatePayload(
  values: InsumoFormValues,
  extra: Partial<InsumoCreatePayload> = {},
): InsumoCreatePayload {
  return {
    ...extra,
    ingrediente_id: Number(values.ingrediente_id),
    nombre: values.nombre.trim(),
    marca_origen: values.marca_origen.trim(),
    presentacion: textOrNull(values.presentacion),
    codigo_barras: normalizarCodigoBarras(values.codigo_barras),
    ingredientes_declarados: textOrNull(values.ingredientes_declarados),
    advertencias: textOrNull(values.advertencias),
    habitual: values.habitual,
  };
}

/** Only the fields that changed, so an untouched barcode is never re-sent. */
export function buildUpdatePayload(
  baseline: InsumoFormValues,
  values: InsumoFormValues,
): InsumoUpdatePayload {
  const payload: InsumoUpdatePayload = {};

  if (values.nombre.trim() !== baseline.nombre.trim()) payload.nombre = values.nombre.trim();
  if (values.marca_origen.trim() !== baseline.marca_origen.trim()) {
    payload.marca_origen = values.marca_origen.trim();
  }
  if (values.ingrediente_id !== baseline.ingrediente_id) {
    payload.ingrediente_id = Number(values.ingrediente_id);
  }
  if (textOrNull(values.presentacion) !== textOrNull(baseline.presentacion)) {
    payload.presentacion = textOrNull(values.presentacion);
  }
  if (
    normalizarCodigoBarras(values.codigo_barras) !==
    normalizarCodigoBarras(baseline.codigo_barras)
  ) {
    payload.codigo_barras = normalizarCodigoBarras(values.codigo_barras);
  }
  if (
    textOrNull(values.ingredientes_declarados) !== textOrNull(baseline.ingredientes_declarados)
  ) {
    payload.ingredientes_declarados = textOrNull(values.ingredientes_declarados);
  }
  if (textOrNull(values.advertencias) !== textOrNull(baseline.advertencias)) {
    payload.advertencias = textOrNull(values.advertencias);
  }
  if (values.habitual !== baseline.habitual) payload.habitual = values.habitual;

  // HU14: solo lo que cambió. Vaciar el precio manda null; el contenido viaja siempre como par.
  if (canonico(values.precio) !== canonico(baseline.precio)) {
    payload.precio_referencia = esVacio(values.precio) ? null : canonico(values.precio);
  }
  if (
    canonico(values.contenido_cantidad) !== canonico(baseline.contenido_cantidad) ||
    values.contenido_unidad !== baseline.contenido_unidad
  ) {
    const hayContenido = !esVacio(values.contenido_cantidad);
    payload.contenido_cantidad = hayContenido ? canonico(values.contenido_cantidad) : null;
    payload.contenido_unidad = hayContenido ? values.contenido_unidad : null;
  }

  return payload;
}

export function isInsumoFormDirty(values: InsumoFormValues): boolean {
  return (
    values.nombre.trim() !== "" ||
    values.marca_origen.trim() !== "" ||
    values.ingrediente_id !== "" ||
    values.presentacion.trim() !== "" ||
    values.codigo_barras.trim() !== "" ||
    values.ingredientes_declarados.trim() !== "" ||
    values.advertencias.trim() !== "" ||
    values.precio.trim() !== "" ||
    values.contenido_cantidad.trim() !== "" ||
    values.contenido_unidad !== "" ||
    values.habitual
  );
}

export function isInsumoFormDirtyComparedTo(
  values: InsumoFormValues,
  baseline: InsumoFormValues,
): boolean {
  return Object.keys(buildUpdatePayload(baseline, values)).length > 0;
}
