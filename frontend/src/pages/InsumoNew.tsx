import { useState, type MutableRefObject } from "react";
import { useNavigate } from "react-router-dom";
import BuscarPorCodigo from "@/components/insumos/BuscarPorCodigo";
import ConfirmarReemplazoDatos from "@/components/insumos/ConfirmarReemplazoDatos";
import InsumoForm from "@/components/insumos/InsumoForm";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import { useAppShell } from "@/hooks/useAppShell";
import {
  useFormularioDesdeCodigo,
  usePublicarFormulario,
  type EstadoDelFormulario,
} from "@/hooks/useFormularioDesdeCodigo";
import { useIngredientesActivos } from "@/hooks/useIngredientesActivos";
import { useInsumoExistente } from "@/hooks/useInsumoExistente";
import { useInsumoForm } from "@/hooks/useInsumoForm";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type { PrecargaInsumo } from "@/lib/precargaInsumo";

export default function InsumoNew() {
  const navigate = useNavigate();
  const { handleLogout, producerName, businessName } = useAppShell();
  const ingredientes = useIngredientesActivos();
  const { busqueda, precarga, formularioRef, porConfirmar, reemplazar, conservar } =
    useFormularioDesdeCodigo();
  // The supply that already has the scanned code: here it is viewed or, if inactive, reactivated.
  const existente = useInsumoExistente({
    onReactivado: (insumo) => navigate(`/insumos/${insumo.id}`, { state: { insumoReactivated: true } }),
  });

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

        <BuscarPorCodigo
          busqueda={busqueda}
          existente={{
            hrefVer: (duplicado) => `/insumos/${duplicado.insumoId}`,
            onReactivar: (duplicado) => void existente.reactivar(duplicado.insumoId),
            ocupado: existente.ocupado,
            aviso: existente.aviso,
          }}
        />

        <FormularioNuevoInsumo
          key={precarga.clave}
          precarga={precarga}
          ingredientes={ingredientes}
          formularioRef={formularioRef}
        />
      </div>

      <ConfirmarReemplazoDatos
        open={porConfirmar !== null}
        onConfirm={reemplazar}
        onCancel={conservar}
      />
    </AppShell>
  );
}

interface FormularioNuevoInsumoProps {
  precarga: PrecargaInsumo;
  ingredientes: ReturnType<typeof useIngredientesActivos>;
  formularioRef: MutableRefObject<EstadoDelFormulario>;
}

/** The form of a new supply. Mounted with `key`, so each lookup starts it again from its new data. */
function FormularioNuevoInsumo({ precarga, ingredientes, formularioRef }: FormularioNuevoInsumoProps) {
  const navigate = useNavigate();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const form = useInsumoForm({
    mode: "create",
    initialValues: precarga.valores,
    initialAlergenos: precarga.alergenos,
    extraPayload: precarga.extra,
    onSaved: () => navigate("/insumos", { state: { insumoCreated: true } }),
    onReactivated: (insumo) =>
      navigate(`/insumos/${insumo.id}`, { state: { insumoReactivated: true } }),
  });
  const { dirty } = usePublicarFormulario(form, precarga, formularioRef);

  function handleCancel() {
    if (form.loading) return;
    if (dirty) {
      setShowCancelConfirm(true);
      return;
    }
    navigate("/insumos");
  }

  const { pendingHref, clearPending } = useUnsavedChangesGuard(dirty && !form.loading);

  return (
    <>
      {form.globalError && <Alert type="error">{form.globalError}</Alert>}

      <InsumoForm
        mode="create"
        values={form.values}
        errors={form.errors}
        ingredientes={ingredientes.ingredientes}
        ingredientesLoading={ingredientes.loading}
        ingredientesError={ingredientes.error}
        onIngredientesRetry={() => void ingredientes.reload()}
        onIngredienteCreado={ingredientes.agregar}
        loading={form.loading}
        errorFocusToken={form.errorFocusToken}
        duplicate={form.duplicate}
        reactivating={form.reactivating}
        onReactivate={() => void form.handleReactivate()}
        alergenos={form.alergenos}
        onAlergenosChange={form.handleAlergenosChange}
        mostrarErrorAlergenos={form.mostrarErrorAlergenos}
        sugerencias={precarga.sugerencias}
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
          navigate(href ?? "/insumos");
        }}
        onCancel={() => {
          setShowCancelConfirm(false);
          clearPending();
        }}
      />
    </>
  );
}
