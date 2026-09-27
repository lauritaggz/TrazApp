import type {
  Ingrediente,
  IngredienteCreatePayload,
  IngredienteFormValues,
  IngredienteUpdatePayload,
} from "@/types/ingredient";

const MAX_CODIGO = 100;
const MAX_NOMBRE = 255;

export type IngredienteFormFieldErrors = Partial<
  Record<keyof IngredienteFormValues, string>
>;

export const INGREDIENTE_FORM_FIELD_ORDER: (keyof IngredienteFormValues)[] = [
  "codigo_interno",
  "nombre",
  "descripcion",
];

export function ingredienteToFormValues(
  ingrediente: Ingrediente,
): IngredienteFormValues {
  return {
    codigo_interno: ingrediente.codigo_interno ?? "",
    nombre: ingrediente.nombre,
    descripcion: ingrediente.descripcion ?? "",
  };
}

export function validateIngredienteForm(
  values: IngredienteFormValues,
): IngredienteFormFieldErrors {
  const errors: IngredienteFormFieldErrors = {};

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

  return errors;
}

export function toCreatePayload(
  values: IngredienteFormValues,
): IngredienteCreatePayload {
  const descripcion = values.descripcion.trim();
  return {
    codigo_interno: values.codigo_interno.trim(),
    nombre: values.nombre.trim(),
    descripcion: descripcion || null,
  };
}

export function buildUpdatePayload(
  baseline: IngredienteFormValues,
  values: IngredienteFormValues,
): IngredienteUpdatePayload {
  const payload: IngredienteUpdatePayload = {};

  const codigo = values.codigo_interno.trim();
  if (codigo !== baseline.codigo_interno.trim()) {
    payload.codigo_interno = codigo;
  }

  const nombre = values.nombre.trim();
  if (nombre !== baseline.nombre.trim()) {
    payload.nombre = nombre;
  }

  const descripcion = values.descripcion.trim();
  const baselineDescripcion = baseline.descripcion.trim();
  if (descripcion !== baselineDescripcion) {
    payload.descripcion = descripcion || null;
  }

  return payload;
}

export function isIngredienteFormDirty(values: IngredienteFormValues): boolean {
  return (
    values.codigo_interno.trim() !== "" ||
    values.nombre.trim() !== "" ||
    values.descripcion.trim() !== ""
  );
}

export function isIngredienteFormDirtyComparedTo(
  values: IngredienteFormValues,
  baseline: IngredienteFormValues,
): boolean {
  return (
    values.codigo_interno.trim() !== baseline.codigo_interno.trim() ||
    values.nombre.trim() !== baseline.nombre.trim() ||
    values.descripcion.trim() !== baseline.descripcion.trim()
  );
}
