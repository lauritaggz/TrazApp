import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import IngredientForm from "@/components/ingredients/IngredientForm";
import IngredientUnavailable from "@/components/ingredients/IngredientUnavailable";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAppShell } from "@/hooks/useAppShell";
import {
  buildUpdatePayload,
  ingredienteToFormValues,
  isIngredienteFormDirtyComparedTo,
  validateIngredienteForm,
  type IngredienteFormFieldErrors,
} from "@/lib/ingredientFormValidation";
import { getIngredient, updateIngredient } from "@/services/ingredientService";
import { ApiError } from "@/types/auth";
import {
  EMPTY_INGREDIENTE_FORM_VALUES,
  type IngredienteFormValues,
} from "@/types/ingredient";

const DUPLICATE_CODE_MESSAGE =
  "Ya existe un ingrediente con este código interno.";
const SAVE_ERROR_MESSAGE =
  "No pudimos guardar los cambios. Inténtalo nuevamente.";

function parseIngredientId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export default function IngredientEdit() {
  const navigate = useNavigate();
  const { id: rawId } = useParams();
  const ingredientId = parseIngredientId(rawId);
  const { handleLogout, handleNavigate, producerName, businessName } =
    useAppShell();

  const [baseline, setBaseline] = useState<IngredienteFormValues>(
    EMPTY_INGREDIENTE_FORM_VALUES,
  );
  const [values, setValues] = useState<IngredienteFormValues>(
    EMPTY_INGREDIENTE_FORM_VALUES,
  );
  const [ingredientName, setIngredientName] = useState("");
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<IngredienteFormFieldErrors>({});
  const [errorFocusToken, setErrorFocusToken] = useState(0);
  const [globalError, setGlobalError] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const loadIngredient = useCallback(async (id: number) => {
    setLoadingProduct(true);
    setUnavailable(false);
    try {
      const ingredient = await getIngredient(id);
      const formValues = ingredienteToFormValues(ingredient);
      setBaseline(formValues);
      setValues(formValues);
      setIngredientName(ingredient.nombre);
    } catch {
      setUnavailable(true);
    } finally {
      setLoadingProduct(false);
    }
  }, []);

  useEffect(() => {
    if (ingredientId == null) {
      setUnavailable(true);
      setLoadingProduct(false);
      return;
    }
    void loadIngredient(ingredientId);
  }, [ingredientId, loadIngredient]);

  function setFieldErrors(next: IngredienteFormFieldErrors) {
    setErrors(next);
    setErrorFocusToken((token) => token + 1);
  }

  function handleChange(next: IngredienteFormValues) {
    setValues(next);
    if (globalError) setGlobalError("");
  }

  function goToDetail(options?: { ingredientUpdated?: boolean }) {
    if (ingredientId == null) {
      navigate("/ingredientes");
      return;
    }
    navigate(`/ingredientes/${ingredientId}`, {
      state: options?.ingredientUpdated ? { ingredientUpdated: true } : undefined,
    });
  }

  function handleCancel() {
    if (saving) return;
    if (isIngredienteFormDirtyComparedTo(values, baseline)) {
      setShowCancelConfirm(true);
      return;
    }
    goToDetail();
  }

  async function handleSubmit() {
    if (ingredientId == null) return;
    setGlobalError("");

    const validationErrors = validateIngredienteForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    const payload = buildUpdatePayload(baseline, values);
    if (Object.keys(payload).length === 0) {
      goToDetail({ ingredientUpdated: true });
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      await updateIngredient(ingredientId, payload);
      goToDetail({ ingredientUpdated: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setUnavailable(true);
          return;
        }
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      activePage="ingredientes"
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="max-w-xl mx-auto space-y-6">
        {loadingProduct && (
          <p className="text-sm text-text-secondary">Cargando ingrediente...</p>
        )}

        {!loadingProduct && unavailable && (
          <IngredientUnavailable onBack={() => navigate("/ingredientes")} />
        )}

        {!loadingProduct && !unavailable && (
          <>
            <header>
              <p className="text-sm text-brand-600 font-medium mb-1">
                Ingredientes / {ingredientName || "Editar"} / Editar
              </p>
              <h1 className="text-2xl font-semibold text-text-primary">
                Editar ingrediente
              </h1>
            </header>

            {globalError && <Alert type="error">{globalError}</Alert>}

            <IngredientForm
              mode="edit"
              values={values}
              errors={errors}
              loading={saving}
              errorFocusToken={errorFocusToken}
              onChange={handleChange}
              onSubmit={() => void handleSubmit()}
              onCancel={handleCancel}
            />
          </>
        )}
      </div>

      <ConfirmDialog
        open={showCancelConfirm}
        title="Salir sin guardar"
        description="Tienes cambios sin guardar. ¿Deseas salir sin guardar?"
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => {
          setShowCancelConfirm(false);
          goToDetail();
        }}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </AppShell>
  );
}
