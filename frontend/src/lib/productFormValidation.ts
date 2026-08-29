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
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

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

export function formatMoneyForForm(value: string | null): string {
  return formatContenidoForForm(value);
}

function normalizeMoneyInput(value: string): string {
  return value.trim().replace(",", ".");
}

function normalizeMoneyValue(value: string): string | null {
  const normalized = normalizeMoneyInput(value);
  return normalized || null;
}

function validateOptionalMoney(
  value: string,
  fieldLabel: string,
): string | undefined {
  const normalized = normalizeMoneyInput(value);
  if (!normalized) return undefined;

  if (/^-/.test(normalized) || Number(normalized) < 0) {
    return `El ${fieldLabel} debe ser mayor o igual que 0.`;
  }

  if (!MONEY_PATTERN.test(normalized)) {
    if (/\.\d{3,}/.test(normalized)) {
      return "Máximo 2 decimales.";
    }
    return "Ingresa un número válido (máximo 2 decimales).";
  }

  return undefined;
}

export function productToFormValues(product: Product): ProductFormValues {
  return {
    codigo_interno: product.codigo_interno ?? "",
    nombre: product.nombre,
    descripcion: product.descripcion ?? "",
    contenido_neto: formatContenidoForForm(product.contenido_neto),
    unidad_medida: product.unidad_medida ?? "",
    presentacion: product.presentacion ?? "",
    costo_produccion: formatMoneyForForm(product.costo_produccion),
    precio_venta: formatMoneyForForm(product.precio_venta),
    categoria_ids: product.categorias.map((categoria) => categoria.id),
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

  const costoError = validateOptionalMoney(
    values.costo_produccion,
    "costo de producción",
  );
  if (costoError) {
    errors.costo_produccion = costoError;
  }

  const precioError = validateOptionalMoney(
    values.precio_venta,
    "precio de venta",
  );
  if (precioError) {
    errors.precio_venta = precioError;
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
    values.presentacion.trim() !== "" ||
    values.costo_produccion.trim() !== "" ||
    values.precio_venta.trim() !== "" ||
    values.categoria_ids.length > 0
  );
}

function sameCategoryIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((left, right) => left - right);
  const sortedB = [...b].sort((left, right) => left - right);
  return sortedA.every((id, index) => id === sortedB[index]);
}

export function isProductFormDirtyComparedTo(
  values: ProductFormValues,
  baseline: ProductFormValues,
): boolean {
  const scalarDirty = PRODUCT_FORM_SCALAR_FIELDS.some(
    (field) =>
      normalizeComparable(values[field]) !== normalizeComparable(baseline[field]),
  );
  return scalarDirty || !sameCategoryIds(values.categoria_ids, baseline.categoria_ids);
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
    ...(normalizeMoneyValue(values.costo_produccion) !== null
      ? { costo_produccion: normalizeMoneyValue(values.costo_produccion) }
      : {}),
    ...(normalizeMoneyValue(values.precio_venta) !== null
      ? { precio_venta: normalizeMoneyValue(values.precio_venta) }
      : {}),
    ...(values.categoria_ids.length > 0
      ? { categoria_ids: [...values.categoria_ids] }
      : {}),
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

  const nextCosto = normalizeMoneyValue(current.costo_produccion);
  const prevCosto = normalizeMoneyValue(original.costo_produccion);
  if (nextCosto !== prevCosto) {
    payload.costo_produccion = nextCosto;
  }

  const nextPrecio = normalizeMoneyValue(current.precio_venta);
  const prevPrecio = normalizeMoneyValue(original.precio_venta);
  if (nextPrecio !== prevPrecio) {
    payload.precio_venta = nextPrecio;
  }

  if (!sameCategoryIds(current.categoria_ids, original.categoria_ids)) {
    payload.categoria_ids = [...current.categoria_ids];
  }

  return payload;
}

export const PRODUCT_FORM_SCALAR_FIELDS: (keyof Omit<
  ProductFormValues,
  "categoria_ids"
>)[] = [
  "codigo_interno",
  "nombre",
  "descripcion",
  "contenido_neto",
  "unidad_medida",
  "presentacion",
  "costo_produccion",
  "precio_venta",
];

export const PRODUCT_FORM_FIELD_ORDER: (keyof ProductFormValues)[] = [
  ...PRODUCT_FORM_SCALAR_FIELDS,
  "categoria_ids",
];
