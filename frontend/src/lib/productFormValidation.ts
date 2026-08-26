import type {
  Product,
  ProductFormValues,
  ProductUpdatePayload,
  UnidadMedida,
} from "@/types/product";

const MAX_CODIGO = 100;
const MAX_NOMBRE = 255;
const MAX_PRESENTACION = 255;
const DECIMAL_PATTERN = /^\d+(\.\d{1,3})?$/;

export type ProductFormFieldErrors = Partial<
  Record<keyof ProductFormValues, string>
>;

export function formatContenidoForForm(value: string | null): string {
  if (!value) return "";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  if (Number.isInteger(numeric)) return numeric.toString();
  return numeric.toString().replace(/\.?0+$/, "");
}

export function productToFormValues(product: Product): ProductFormValues {
  return {
    codigo_interno: product.codigo_interno ?? "",
    nombre: product.nombre,
    descripcion: product.descripcion ?? "",
    contenido_neto: formatContenidoForForm(product.contenido_neto),
    unidad_medida: product.unidad_medida ?? "",
    presentacion: product.presentacion ?? "",
  };
}

export function validateProductForm(
  values: ProductFormValues,
): ProductFormFieldErrors {
  const errors: ProductFormFieldErrors = {};

  const codigo = values.codigo_interno.trim();
  if (!codigo) {
    errors.codigo_interno = "El código interno es obligatorio.";
  } else if (codigo.length > MAX_CODIGO) {
    errors.codigo_interno = `Máximo ${MAX_CODIGO} caracteres.`;
  }

  const nombre = values.nombre.trim();
  if (!nombre) {
    errors.nombre = "El nombre es obligatorio.";
  } else if (nombre.length > MAX_NOMBRE) {
    errors.nombre = `Máximo ${MAX_NOMBRE} caracteres.`;
  }

  const descripcion = values.descripcion.trim();
  if (!descripcion) {
    errors.descripcion = "La descripción es obligatoria.";
  }

  const contenido = values.contenido_neto.trim().replace(",", ".");
  if (!contenido) {
    errors.contenido_neto = "El contenido neto es obligatorio.";
  } else if (!DECIMAL_PATTERN.test(contenido)) {
    if (/^-/.test(contenido) || Number(contenido) < 0) {
      errors.contenido_neto = "El contenido neto debe ser mayor que 0.";
    } else if (/\.\d{4,}/.test(contenido)) {
      errors.contenido_neto = "Máximo 3 decimales.";
    } else {
      errors.contenido_neto = "Ingresa un número válido (máximo 3 decimales).";
    }
  } else {
    const numeric = Number(contenido);
    if (!(numeric > 0)) {
      errors.contenido_neto = "El contenido neto debe ser mayor que 0.";
    }
  }

  if (!values.unidad_medida) {
    errors.unidad_medida = "La unidad de medida es obligatoria.";
  }

  const presentacion = values.presentacion.trim();
  if (presentacion.length > MAX_PRESENTACION) {
    errors.presentacion = `Máximo ${MAX_PRESENTACION} caracteres.`;
  }

  return errors;
}

export function isProductFormDirty(values: ProductFormValues): boolean {
  return (
    values.codigo_interno.trim() !== "" ||
    values.nombre.trim() !== "" ||
    values.descripcion.trim() !== "" ||
    values.contenido_neto.trim() !== "" ||
    values.unidad_medida !== "" ||
    values.presentacion.trim() !== ""
  );
}

export function isProductFormDirtyComparedTo(
  values: ProductFormValues,
  baseline: ProductFormValues,
): boolean {
  return PRODUCT_FORM_FIELD_ORDER.some(
    (field) => normalizeComparable(values[field]) !== normalizeComparable(baseline[field]),
  );
}

function normalizeComparable(value: string): string {
  return value.trim();
}

function normalizePresentacion(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeContenido(value: string): string {
  return value.trim().replace(",", ".");
}

export function toCreatePayload(values: ProductFormValues) {
  return {
    codigo_interno: values.codigo_interno.trim(),
    nombre: values.nombre.trim(),
    descripcion: values.descripcion.trim(),
    contenido_neto: normalizeContenido(values.contenido_neto),
    unidad_medida: values.unidad_medida as UnidadMedida,
    presentacion: normalizePresentacion(values.presentacion),
  };
}

/** Builds a partial PATCH body with only fields that changed. */
export function buildUpdatePayload(
  original: ProductFormValues,
  current: ProductFormValues,
): ProductUpdatePayload {
  const payload: ProductUpdatePayload = {};

  const nextCodigo = current.codigo_interno.trim();
  if (nextCodigo !== original.codigo_interno.trim()) {
    payload.codigo_interno = nextCodigo;
  }

  const nextNombre = current.nombre.trim();
  if (nextNombre !== original.nombre.trim()) {
    payload.nombre = nextNombre;
  }

  const nextDescripcion = current.descripcion.trim();
  if (nextDescripcion !== original.descripcion.trim()) {
    payload.descripcion = nextDescripcion;
  }

  const nextContenido = normalizeContenido(current.contenido_neto);
  const prevContenido = normalizeContenido(original.contenido_neto);
  if (nextContenido !== prevContenido) {
    payload.contenido_neto = nextContenido;
  }

  if (current.unidad_medida !== original.unidad_medida) {
    payload.unidad_medida = current.unidad_medida as UnidadMedida;
  }

  const nextPresentacion = normalizePresentacion(current.presentacion);
  const prevPresentacion = normalizePresentacion(original.presentacion);
  if (nextPresentacion !== prevPresentacion) {
    payload.presentacion = nextPresentacion;
  }

  return payload;
}

export const PRODUCT_FORM_FIELD_ORDER: (keyof ProductFormValues)[] = [
  "codigo_interno",
  "nombre",
  "descripcion",
  "contenido_neto",
  "unidad_medida",
  "presentacion",
];
