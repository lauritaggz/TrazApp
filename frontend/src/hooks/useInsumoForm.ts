import { useState } from "react";
import {
  buildUpdatePayload,
  insumoToFormValues,
  isInsumoFormDirtyComparedTo,
  toCreatePayload,
  validateInsumoForm,
  type InsumoFormFieldErrors,
} from "@/lib/insumoFormValidation";
import {
  createInsumo,
  reactivateInsumo,
  updateInsumo,
} from "@/services/insumoService";
import { ApiError } from "@/types/auth";
import {
  EMPTY_INSUMO_FORM_VALUES,
  type Insumo,
  type InsumoCreatePayload,
  type InsumoDuplicateInfo,
  type InsumoFormMode,
  type InsumoFormValues,
} from "@/types/insumo";

const SAVE_ERROR_MESSAGE = "No pudimos guardar el insumo. Inténtalo nuevamente.";
const REACTIVATE_ERROR_MESSAGE =
  "No pudimos reactivar el insumo. Inténtalo nuevamente.";
const INGREDIENTE_NO_VALIDO = "Ingrediente no válido";

interface UseInsumoFormOptions {
  mode: InsumoFormMode;
  /** Edit: the saved supply as form values. Create: an optional prefill (HU13). */
  initialValues?: Partial<InsumoFormValues>;
  /** Edit mode: id of the supply being modified. */
  insumoId?: number;
  /**
   * Create mode: fields that live outside the visible form and travel with the payload.
   * HU13 uses it for `fuente`, `ficha` and `fecha_recuperacion` of a retrieved supply.
   */
  extraPayload?: Partial<InsumoCreatePayload>;
  onSaved: (insumo: Insumo) => void;
  /** Edit mode: nothing changed, so nothing is sent. */
  onNoChanges?: () => void;
  /** The barcode belonged to a deactivated supply and the productor reactivated it. */
  onReactivated?: (insumo: Insumo) => void;
}

function duplicateFrom(error: ApiError): InsumoDuplicateInfo | null {
  const detail = error.detail as { insumo_id?: unknown; activo?: unknown } | undefined;
  if (!detail || typeof detail.insumo_id !== "number") return null;
  return {
    insumoId: detail.insumo_id,
    activo: detail.activo !== false,
    mensaje: error.message,
  };
}

/** State, validation and saving of the supply form, for creating and for editing. */
export function useInsumoForm({
  mode,
  initialValues,
  insumoId,
  extraPayload,
  onSaved,
  onNoChanges,
  onReactivated,
}: UseInsumoFormOptions) {
  const [baseline] = useState<InsumoFormValues>({
    ...EMPTY_INSUMO_FORM_VALUES,
    ...initialValues,
  });
  const [values, setValues] = useState<InsumoFormValues>(baseline);
  const [errors, setErrors] = useState<InsumoFormFieldErrors>({});
  const [errorFocusToken, setErrorFocusToken] = useState(0);
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [duplicate, setDuplicate] = useState<InsumoDuplicateInfo | null>(null);
  const [reactivating, setReactivating] = useState(false);

  function setFieldErrors(next: InsumoFormFieldErrors) {
    setErrors(next);
    setErrorFocusToken((token) => token + 1);
  }

  function handleChange(next: InsumoFormValues) {
    if (duplicate && next.codigo_barras !== values.codigo_barras) {
      setDuplicate(null);
      setErrors((current) => ({ ...current, codigo_barras: undefined }));
    }
    setValues(next);
    if (globalError) setGlobalError("");
  }

  function handleSaveError(err: unknown) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        const info = duplicateFrom(err);
        if (info) {
          setDuplicate(info);
          setFieldErrors({ codigo_barras: info.mensaje });
          return;
        }
        setGlobalError(err.message);
        return;
      }
      if (err.status === 422) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors);
          setGlobalError(err.message);
          return;
        }
        if (err.message === INGREDIENTE_NO_VALIDO) {
          setFieldErrors({ ingrediente_id: err.message });
          return;
        }
        setGlobalError(err.message);
        return;
      }
    }
    setGlobalError(SAVE_ERROR_MESSAGE);
  }

  async function handleSubmit() {
    setGlobalError("");
    setDuplicate(null);
    const validationErrors = validateInsumoForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setErrors({});
    let saved: Insumo;
    if (mode === "edit") {
      if (insumoId == null) return;
      const payload = buildUpdatePayload(baseline, values);
      if (Object.keys(payload).length === 0) {
        onNoChanges?.();
        return;
      }
      setLoading(true);
      try {
        saved = await updateInsumo(insumoId, payload);
      } catch (err) {
        handleSaveError(err);
        return;
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        saved = await createInsumo(toCreatePayload(values, extraPayload));
      } catch (err) {
        handleSaveError(err);
        return;
      } finally {
        setLoading(false);
      }
    }
    onSaved(saved);
  }

  /** The repeated barcode belongs to a deactivated supply: reactivate it instead of duplicating. */
  async function handleReactivate() {
    if (!duplicate || duplicate.activo) return;
    setGlobalError("");
    setReactivating(true);
    try {
      const reactivated = await reactivateInsumo(duplicate.insumoId);
      onReactivated?.(reactivated);
    } catch {
      setGlobalError(REACTIVATE_ERROR_MESSAGE);
    } finally {
      setReactivating(false);
    }
  }

  return {
    values,
    baseline,
    errors,
    errorFocusToken,
    globalError,
    loading,
    duplicate,
    reactivating,
    dirty: isInsumoFormDirtyComparedTo(values, baseline),
    handleChange,
    handleSubmit,
    handleReactivate,
  };
}

export { insumoToFormValues };
