import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import IngredientForm from "@/components/ingredients/IngredientForm";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAppShell } from "@/hooks/useAppShell";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  isIngredienteFormDirty,
  toCreatePayload,
  validateIngredienteForm,
  type IngredienteFormFieldErrors,
} from "@/lib/ingredientFormValidation";
import { createIngredient } from "@/services/ingredientService";
import { ApiError } from "@/types/auth";
import { EMPTY_INGREDIENTE_FORM_VALUES, type IngredienteFormValues } from "@/types/ingredient";

const DUPLICATE_CODE_MESSAGE =
  "Ya existe un ingrediente con este código interno.";
const SAVE_ERROR_MESSAGE =
  "No pudimos guardar el ingrediente. Inténtalo nuevamente.";

export default function IngredientNew() {
  const navigate = useNavigate();
  const { handleLogout, producerName, businessName } =
    useAppShell();

  const [values, setValues] = useState<IngredienteFormValues>(
    EMPTY_INGREDIENTE_FORM_VALUES,
  );
  const [errors, setErrors] = useState<IngredienteFormFieldErrors>({});
  const [errorFocusToken, setErrorFocusToken] = useState(0);
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  function setFieldErrors(next: IngredienteFormFieldErrors) {
    setErrors(next);
    setErrorFocusToken((token) => token + 1);
  }

  function handleChange(next: IngredienteFormValues) {
    setValues(next);
    if (globalError) setGlobalError("");
  }

  function handleCancel() {
    if (loading) return;
    if (isIngredienteFormDirty(values)) {
      setShowCancelConfirm(true);
      return;
    }
    navigate("/ingredientes");
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
    try {
      await createIngredient(toCreatePayload(values));
      navigate("/ingredientes", { state: { ingredientCreated: true } });
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
    } finally {
      setLoading(false);
    }
  }

  const { pendingHref, clearPending } = useUnsavedChangesGuard(
    (isIngredienteFormDirty(values)) && !loading,
  );

  return (
    <AppShell
      activePage="ingredientes"
      pageTitle="Nuevo ingrediente"
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="max-w-xl mx-auto space-y-6">
        <PageHeader
          title="Nuevo ingrediente"
          breadcrumbs={[{ label: "Ingredientes", to: "/ingredientes" }, { label: "Nuevo ingrediente" }]}
        />

        {globalError && <Alert type="error">{globalError}</Alert>}

        <IngredientForm
          mode="create"
          values={values}
          errors={errors}
          loading={loading}
          errorFocusToken={errorFocusToken}
          onChange={handleChange}
          onSubmit={() => void handleSubmit()}
          onCancel={handleCancel}
        />
      </div>

      <ConfirmDialog
        open={showCancelConfirm || pendingHref !== null}
        title="Salir sin guardar"
        description="Tienes cambios sin guardar. ¿Deseas salir sin guardar?"
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => {
          const href = pendingHref;
          clearPending();
          setShowCancelConfirm(false);
          if (href) {
            navigate(href);
            return;
          }
          navigate("/ingredientes");
          }}
        onCancel={() => {
          setShowCancelConfirm(false);
          clearPending();
        }}
      />
    </AppShell>
  );
}
