import type { ProductFormValues } from "@/types/product";

const MAX_CODIGO = 100;
const MAX_NOMBRE = 255;
const MAX_PRESENTACION = 255;
const DECIMAL_PATTERN = /^\d+(\.\d{1,3})?$/;

export type ProductFormFieldErrors = Partial<
  Record<keyof ProductFormValues, string>
>;

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

export function toCreatePayload(values: ProductFormValues) {
  const presentacion = values.presentacion.trim();
  return {
    codigo_interno: values.codigo_interno.trim(),
    nombre: values.nombre.trim(),
    descripcion: values.descripcion.trim(),
    contenido_neto: values.contenido_neto.trim().replace(",", "."),
    unidad_medida: values.unidad_medida as Exclude<
      ProductFormValues["unidad_medida"],
      ""
    >,
    presentacion: presentacion || null,
  };
}

export const PRODUCT_FORM_FIELD_ORDER: (keyof ProductFormValues)[] = [
  "codigo_interno",
  "nombre",
  "descripcion",
  "contenido_neto",
  "unidad_medida",
  "presentacion",
];
