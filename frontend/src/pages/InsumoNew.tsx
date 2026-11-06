import { useState, type MutableRefObject } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import BuscarPorNombre from "@/components/insumos/BuscarPorNombre";
import EncabezadoNuevoInsumo from "@/components/insumos/EncabezadoNuevoInsumo";
import ConfirmarReemplazoDatos from "@/components/insumos/ConfirmarReemplazoDatos";
import InicioNuevoInsumo, { esMetodoNuevoInsumo } from "@/components/insumos/InicioNuevoInsumo";
import InsumoForm from "@/components/insumos/InsumoForm";
import PasoBusquedaCodigo from "@/components/insumos/PasoBusquedaCodigo";
import ResumenProductoEncontrado from "@/components/insumos/ResumenProductoEncontrado";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
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

/** The title and the help line of each screen, as in the design. */
const ENCABEZADOS: Record<string, { paso?: string; titulo: string; descripcion: string }> = {
  inicio: {
    titulo: "¿Cómo quieres registrar el insumo?",
    descripcion:
      "Puedes recuperar información pública o completar la ficha manualmente. Nada se guardará sin tu confirmación.",
  },
  codigo: {
    paso: "Búsqueda",
    titulo: "Buscar producto comercial",
    descripcion: "Recupera información pública para evitar transcribir la ficha manualmente.",
  },
  nombre: {
    paso: "Búsqueda",
    titulo: "Buscar producto comercial",
    descripcion: "Recupera información pública para evitar transcribir la ficha manualmente.",
  },
  manual: {
    paso: "Revisión final",
    titulo: "Completar ficha manual",
    descripcion: "Nada se guardará hasta que confirmes el registro.",
  },
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
      <div className="mx-auto max-w-5xl">
        <EncabezadoNuevoInsumo
          volver={
            metodo === undefined
              ? { to: "/insumos", texto: "Volver a Insumos" }
              : { to: "/insumos/nuevo", texto: "Volver al inicio" }
          }
          {...ENCABEZADOS[metodo ?? "inicio"]}
        />

        {metodo === undefined ? (
          <InicioNuevoInsumo />
        ) : (
          <div className="space-y-6">
            {metodo === "codigo" && <PasoBusquedaCodigo busqueda={busqueda} existente={accionesExistente} />}
            {metodo === "nombre" && <BuscarPorNombre busqueda={busquedaNombre} existente={accionesExistente} />}

            <FormularioNuevoInsumo
              key={precarga.clave}
              precarga={precarga}
              ingredientes={ingredientes}
              formularioRef={formularioRef}
            />
          </div>
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
