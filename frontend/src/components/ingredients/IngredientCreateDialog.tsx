import { useEffect, useId, useRef } from "react";
import IngredientForm from "@/components/ingredients/IngredientForm";
import Alert from "@/components/ui/Alert";
import { useIngredientCreateForm } from "@/hooks/useIngredientCreateForm";
import type { Ingrediente } from "@/types/ingredient";

interface IngredientCreateDialogProps {
  description?: string;
  onCreated: (ingrediente: Ingrediente) => void;
  onCancel: () => void;
}

/** Mount only while open: each opening starts with an empty form. */
export default function IngredientCreateDialog({
  description,
  onCreated,
  onCancel,
}: IngredientCreateDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    values,
    errors,
    errorFocusToken,
    globalError,
    loading,
    handleChange,
    handleSubmit,
  } = useIngredientCreateForm(onCreated);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('[name="codigo_interno"]')?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loading, onCancel]);

  function handleCancel() {
    if (!loading) onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-xl sm:rounded-xl border border-border bg-card p-5 sm:p-6 shadow-lg space-y-4"
      >
        <div className="space-y-1">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">
            Nuevo ingrediente
          </h2>
          {description && (
            <p id={descriptionId} className="text-sm text-text-secondary leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {globalError && <Alert type="error">{globalError}</Alert>}

        <IngredientForm
          mode="create"
          embedded
          values={values}
          errors={errors}
          loading={loading}
          errorFocusToken={errorFocusToken}
          submitLabel="Crear ingrediente"
          loadingLabel="Creando…"
          onChange={handleChange}
          onSubmit={() => void handleSubmit()}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
