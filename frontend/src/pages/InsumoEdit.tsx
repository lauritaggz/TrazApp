import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import InsumoForm from "@/components/insumos/InsumoForm";
import InsumoUnavailable from "@/components/insumos/InsumoUnavailable";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import { useAppShell } from "@/hooks/useAppShell";
import { useIngredientesActivos } from "@/hooks/useIngredientesActivos";
import { insumoToFormValues, useInsumoForm } from "@/hooks/useInsumoForm";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { getInsumo } from "@/services/insumoService";
import type { Insumo } from "@/types/insumo";

function parseInsumoId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export default function InsumoEdit() {
  const navigate = useNavigate();
  const { id: rawId } = useParams();
  const insumoId = parseInsumoId(rawId);
  const { handleLogout, producerName, businessName } = useAppShell();

  const [insumo, setInsumo] = useState<Insumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const loadInsumo = useCallback(async (id: number) => {
    setLoading(true);
    setUnavailable(false);
    try {
      setInsumo(await getInsumo(id));
    } catch {
      setInsumo(null);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (insumoId == null) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    void loadInsumo(insumoId);
  }, [insumoId, loadInsumo]);

  return (
    <AppShell
      activePage="insumos"
      pageTitle="Editar insumo"
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {loading && <p className="text-sm text-text-secondary">Cargando insumo...</p>}

        {!loading && unavailable && <InsumoUnavailable onBack={() => navigate("/insumos")} />}

        {!loading && insumo && (
          <InsumoEditor
            key={insumo.id}
            insumo={insumo}
            onBack={() => navigate(`/insumos/${insumo.id}`)}
          />
        )}
      </div>
    </AppShell>
  );
}

/** Mounted after the supply is loaded, so the form starts from the saved values. */
function InsumoEditor({ insumo, onBack }: { insumo: Insumo; onBack: () => void }) {
  const navigate = useNavigate();
  const ingredientes = useIngredientesActivos();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const form = useInsumoForm({
    mode: "edit",
    insumoId: insumo.id,
    initialValues: insumoToFormValues(insumo),
    onSaved: () => navigate(`/insumos/${insumo.id}`, { state: { insumoUpdated: true } }),
    onNoChanges: onBack,
    onReactivated: (reactivated) =>
      navigate(`/insumos/${reactivated.id}`, { state: { insumoReactivated: true } }),
  });

  function handleCancel() {
    if (form.loading) return;
    if (form.dirty) {
      setShowCancelConfirm(true);
      return;
    }
    onBack();
  }

  const { pendingHref, clearPending } = useUnsavedChangesGuard(form.dirty && !form.loading);

  return (
    <>
      <PageHeader
        title="Editar insumo"
        description="Actualiza la información del insumo."
        breadcrumbs={[
          { label: "Insumos", to: "/insumos" },
          { label: insumo.nombre, to: `/insumos/${insumo.id}` },
          { label: "Editar" },
        ]}
      />

      {form.globalError && <Alert type="error">{form.globalError}</Alert>}

      <InsumoForm
        mode="edit"
        values={form.values}
        errors={form.errors}
        ingredientes={ingredientes.ingredientes}
        ingredientesLoading={ingredientes.loading}
        ingredientesError={ingredientes.error}
        onIngredientesRetry={() => void ingredientes.reload()}
        ingredienteActual={insumo.ingrediente}
        loading={form.loading}
        errorFocusToken={form.errorFocusToken}
        duplicate={form.duplicate}
        reactivating={form.reactivating}
        onReactivate={() => void form.handleReactivate()}
        onChange={form.handleChange}
        onSubmit={() => void form.handleSubmit()}
        onCancel={handleCancel}
      />

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
          if (href) navigate(href);
          else onBack();
        }}
        onCancel={() => {
          setShowCancelConfirm(false);
          clearPending();
        }}
      />
    </>
  );
}
