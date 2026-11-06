import { useState, type MutableRefObject } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import BuscarPorCodigo from "@/components/insumos/BuscarPorCodigo";
import BuscarPorNombre from "@/components/insumos/BuscarPorNombre";
import ConfirmarReemplazoDatos from "@/components/insumos/ConfirmarReemplazoDatos";
import InicioNuevoInsumo, { esMetodoNuevoInsumo } from "@/components/insumos/InicioNuevoInsumo";
import InsumoForm from "@/components/insumos/InsumoForm";
import ResumenProductoEncontrado from "@/components/insumos/ResumenProductoEncontrado";
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

const DESCRIPCION_INICIO = "Crea un insumo: un producto que compras y usas en tus elaboraciones.";
const DESCRIPCIONES: Record<string, string> = {
  codigo: "Escanea el código del envase y revisa los datos antes de crear el insumo.",
  nombre: "Busca el producto por nombre o marca y revisa los datos antes de crear el insumo.",
  manual: "Completa la ficha mirando el envase del producto.",
};

/**
 * A new supply (HU07): first how to start it (scan, search by name or enter by hand), then the supply form
 * with the block of that method. The method is the last segment of the address, so it can be left and
 * come back to with the browser.
 */
export default function InsumoNew() {
  const { metodo } = useParams();
  if (metodo !== undefined && !esMetodoNuevoInsumo(metodo)) return <Navigate to="/insumos/nuevo" replace />;
  return <PaginaNuevoInsumo metodo={metodo} />;
}

function PaginaNuevoInsumo({ metodo }: { metodo: string | undefined }) {
  const navigate = useNavigate();
  const { handleLogout, producerName, businessName } = useAppShell();
  const ingredientes = useIngredientesActivos();
  const { busqueda, busquedaNombre, precarga, formularioRef, porConfirmar, reemplazar, conservar } =
    useFormularioDesdeCodigo();
  // The supply that already has the scanned code: here it is viewed or, if inactive, reactivated.
  const existente = useInsumoExistente({
    onReactivado: (insumo) => navigate(`/insumos/${insumo.id}`, { state: { insumoReactivated: true } }),
  });

  const accionesExistente = {
    hrefVer: (duplicado: { insumoId: number }) => `/insumos/${duplicado.insumoId}`,
    onReactivar: (duplicado: { insumoId: number }) => void existente.reactivar(duplicado.insumoId),
    ocupado: existente.ocupado,
    aviso: existente.aviso,
  };

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
          description={metodo ? DESCRIPCIONES[metodo] : DESCRIPCION_INICIO}
          breadcrumbs={[{ label: "Insumos", to: "/insumos" }, { label: "Nuevo insumo" }]}
        />

        {metodo === undefined ? (
          <InicioNuevoInsumo />
        ) : (
          <>
            <Link
              to="/insumos/nuevo"
              className="inline-flex min-h-11 items-center text-sm font-medium text-accent-strong hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              ← Volver al inicio
            </Link>

            {metodo === "codigo" && (
              <BuscarPorCodigo busqueda={busqueda} existente={accionesExistente} />
            )}
            {metodo === "nombre" && (
              <BuscarPorNombre busqueda={busquedaNombre} existente={accionesExistente} />
            )}

            <FormularioNuevoInsumo
              key={precarga.clave}
              precarga={precarga}
              ingredientes={ingredientes}
              formularioRef={formularioRef}
            />
          </>
        )}
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
    origenPropuesta: precarga.origen,
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

      <ResumenProductoEncontrado
        resumen={precarga.resumen}
        imagen={precarga.imagen}
        nombreProducto={precarga.valores.nombre}
      />

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
