import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import IngredientForm from "@/components/ingredients/IngredientForm";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAppShell } from "@/hooks/useAppShell";
import { useIngredientCreateForm } from "@/hooks/useIngredientCreateForm";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { isIngredienteFormDirty } from "@/lib/ingredientFormValidation";

export default function IngredientNew() {
  const navigate = useNavigate();
  const { handleLogout, producerName, businessName } =
    useAppShell();

  const {
    values,
    errors,
    errorFocusToken,
    globalError,
    loading,
    handleChange,
    handleSubmit,
  } = useIngredientCreateForm((created) =>
    navigate("/ingredientes", {
      state: { ingredientCreated: true, ingredientId: created?.id },
    }),
  );
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  function handleCancel() {
    if (loading) return;
    if (isIngredienteFormDirty(values)) {
      setShowCancelConfirm(true);
      return;
    }
    navigate("/ingredientes");
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
      <div className="max-w-5xl mx-auto space-y-6">
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
