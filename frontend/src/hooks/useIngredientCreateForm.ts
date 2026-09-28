import { useState } from "react";
import {
  toCreatePayload,
  validateIngredienteForm,
  type IngredienteFormFieldErrors,
} from "@/lib/ingredientFormValidation";
import { createIngredient } from "@/services/ingredientService";
import { ApiError } from "@/types/auth";
import {
  EMPTY_INGREDIENTE_FORM_VALUES,
  type Ingrediente,
  type IngredienteFormValues,
} from "@/types/ingredient";

const DUPLICATE_CODE_MESSAGE =
  "Ya existe un ingrediente con este código interno.";
const SAVE_ERROR_MESSAGE =
  "No pudimos guardar el ingrediente. Inténtalo nuevamente.";

export function useIngredientCreateForm(onCreated: (ingrediente: Ingrediente) => void) {
  const [values, setValues] = useState<IngredienteFormValues>(
    EMPTY_INGREDIENTE_FORM_VALUES,
  );
  const [errors, setErrors] = useState<IngredienteFormFieldErrors>({});
  const [errorFocusToken, setErrorFocusToken] = useState(0);
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);

  function setFieldErrors(next: IngredienteFormFieldErrors) {
    setErrors(next);
    setErrorFocusToken((token) => token + 1);
  }

  function handleChange(next: IngredienteFormValues) {
    setValues(next);
    if (globalError) setGlobalError("");
  }

  async function handleSubmit() {
    setGlobalError("");
    const validationErrors = validateIngredienteForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    let created: Ingrediente;
    try {
      created = await createIngredient(toCreatePayload(values));
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setFieldErrors({ codigo_interno: DUPLICATE_CODE_MESSAGE });
          return;
        }
        if (err.status === 422 && Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors);
          setGlobalError(err.message);
          return;
        }
      }
      setGlobalError(SAVE_ERROR_MESSAGE);
      return;
    } finally {
      setLoading(false);
    }
    onCreated(created);
  }

  return {
    values,
    errors,
    errorFocusToken,
    globalError,
    loading,
    handleChange,
    handleSubmit,
  };
}
