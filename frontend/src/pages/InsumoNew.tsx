import { useState } from "react";
import { useNavigate } from "react-router-dom";
import InsumoForm from "@/components/insumos/InsumoForm";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import { useAppShell } from "@/hooks/useAppShell";
import { useIngredientesActivos } from "@/hooks/useIngredientesActivos";
import { useInsumoForm } from "@/hooks/useInsumoForm";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

export default function InsumoNew() {
  const navigate = useNavigate();
  const { handleLogout, producerName, businessName } = useAppShell();
  const ingredientes = useIngredientesActivos();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const form = useInsumoForm({
    mode: "create",
    onSaved: (insumo) =>
      navigate("/insumos", { state: { insumoCreated: true, insumoId: insumo?.id } }),
    onReactivated: (insumo) =>
      navigate(`/insumos/${insumo.id}`, { state: { insumoReactivated: true } }),
  });

  function handleCancel() {
    if (form.loading) return;
    if (form.dirty) {
      setShowCancelConfirm(true);
      return;
    }
    navigate("/insumos");
  }

  const { pendingHref, clearPending } = useUnsavedChangesGuard(form.dirty && !form.loading);

  return (
    <AppShell
      activePage="insumos"
      pageTitle="Nuevo insumo"
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Nuevo insumo"
          description="Registra un producto comercial que usas como insumo."
          breadcrumbs={[{ label: "Insumos", to: "/insumos" }, { label: "Nuevo insumo" }]}
        />

        {form.globalError && <Alert type="error">{form.globalError}</Alert>}

        <InsumoForm
          mode="create"
          values={form.values}
          errors={form.errors}
          ingredientes={ingredientes.ingredientes}
          ingredientesLoading={ingredientes.loading}
          ingredientesError={ingredientes.error}
          onIngredientesRetry={() => void ingredientes.reload()}
          loading={form.loading}
          errorFocusToken={form.errorFocusToken}
          duplicate={form.duplicate}
          reactivating={form.reactivating}
          onReactivate={() => void form.handleReactivate()}
          onChange={form.handleChange}
          onSubmit={() => void form.handleSubmit()}
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
          navigate(href ?? "/insumos");
        }}
        onCancel={() => {
          setShowCancelConfirm(false);
          clearPending();
        }}
      />
    </AppShell>
  );
}
