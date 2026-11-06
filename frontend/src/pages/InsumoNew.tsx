import { useState, type MutableRefObject } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import BuscarPorNombre from "@/components/insumos/BuscarPorNombre";
import ConfirmarReemplazoDatos from "@/components/insumos/ConfirmarReemplazoDatos";
import EncabezadoNuevoInsumo from "@/components/insumos/EncabezadoNuevoInsumo";
import InicioNuevoInsumo, { esMetodoNuevoInsumo } from "@/components/insumos/InicioNuevoInsumo";
import PasoBusquedaCodigo from "@/components/insumos/PasoBusquedaCodigo";
import RevisionInsumo from "@/components/insumos/RevisionInsumo";
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
import { nombreDeOrigen } from "@/lib/revisionInsumo";

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
 * A new supply (HU07): first how to start it (scan, search by name or enter by hand), then the search and, once a
 * product is loaded (or for a manual entry), the review. The method is the last segment of the address, so it can be
 * left and come back to with the browser.
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
  const {
    busqueda,
    busquedaNombre,
    descartar,
    precarga,
    formularioRef,
    porConfirmar,
    reemplazar,
    conservar,
  } = useFormularioDesdeCodigo();
  const [confirmarVolver, setConfirmarVolver] = useState(false);
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

  const manual = metodo === "manual";
  const recuperado = metodo !== undefined && !manual && precarga.revision !== undefined;
  const enRevision = manual || recuperado;
  const revision = precarga.revision;

  function volverALaBusqueda() {
    if (formularioRef.current.dirty) {
      setConfirmarVolver(true);
      return;
    }
    descartar();
  }

  let encabezado: Parameters<typeof EncabezadoNuevoInsumo>[0];
  if (metodo === undefined) {
    encabezado = { volver: { to: "/insumos", texto: "Volver a Insumos" }, ...ENCABEZADOS.inicio };
  } else if (manual) {
    encabezado = { volver: { to: "/insumos/nuevo", texto: "Volver al inicio" }, ...ENCABEZADOS.manual };
  } else if (recuperado) {
    encabezado = {
      volver: {
        onClick: volverALaBusqueda,
        texto: metodo === "nombre" ? "Volver a resultados" : "Volver a la búsqueda",
      },
      paso: "Revisión final",
      titulo: revision?.fuente === "combinada" ? "Revisar información combinada" : "Revisar información recuperada",
      descripcion: "Nada se guardará hasta que confirmes el registro.",
      derecha: revision ? <MarcasDeFuente fuentes={Object.keys(revision.fechas)} /> : undefined,
    };
  } else {
    encabezado = { volver: { to: "/insumos/nuevo", texto: "Volver al inicio" }, ...ENCABEZADOS[metodo] };
  }

  return (
    <AppShell
      activePage="insumos"
      pageTitle="Nuevo insumo"
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className={`mx-auto ${enRevision ? "max-w-6xl" : "max-w-5xl"}`}>
        <EncabezadoNuevoInsumo {...encabezado} />

        {metodo === undefined && <InicioNuevoInsumo />}

        {metodo !== undefined && !enRevision && (
          <>
            {metodo === "codigo" && <PasoBusquedaCodigo busqueda={busqueda} existente={accionesExistente} />}
            {metodo === "nombre" && <BuscarPorNombre busqueda={busquedaNombre} existente={accionesExistente} />}
          </>
        )}

        {enRevision && (
          <FormularioNuevoInsumo
            key={precarga.clave}
            precarga={precarga}
            ingredientes={ingredientes}
            formularioRef={formularioRef}
          />
        )}
      </div>

      <ConfirmarReemplazoDatos open={porConfirmar !== null} onConfirm={reemplazar} onCancel={conservar} />

      <ConfirmDialog
        open={confirmarVolver}
        title="Salir sin guardar"
        description="Tienes cambios sin guardar. ¿Deseas salir sin guardar?"
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => {
          setConfirmarVolver(false);
          descartar();
        }}
        onCancel={() => setConfirmarVolver(false)}
      />
    </AppShell>
  );
}

/** The sources the data came from, top right of the review (CA15). */
function MarcasDeFuente({ fuentes }: { fuentes: string[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-2 text-xs" aria-label="Fuentes de la ficha">
      {["jumbo", "open_food_facts"].map((fuente) => {
        const activa = fuentes.includes(fuente);
        return (
          <li
            key={fuente}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              activa
                ? "border-brand-200 bg-brand-50 text-brand-700"
                : "border-border bg-surface text-text-secondary"
            }`}
          >
            {nombreDeOrigen(fuente)}
            <span className="sr-only">{activa ? " (usada)" : " (no usada)"}</span>
          </li>
        );
      })}
    </ul>
  );
}

interface FormularioNuevoInsumoProps {
  precarga: PrecargaInsumo;
  ingredientes: ReturnType<typeof useIngredientesActivos>;
  formularioRef: MutableRefObject<EstadoDelFormulario>;
}

/** The review of a new supply. Mounted with `key`, so each lookup starts it again from its new data. */
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

      <RevisionInsumo
        modo="crear"
        values={form.values}
        inicial={form.baseline}
        errors={form.errors}
        onChange={form.handleChange}
        onSubmit={() => void form.handleSubmit()}
        onCancel={handleCancel}
        loading={form.loading}
        errorFocusToken={form.errorFocusToken}
        ingredientes={ingredientes.ingredientes}
        ingredientesLoading={ingredientes.loading}
        ingredientesError={ingredientes.error}
        onIngredientesRetry={() => void ingredientes.reload()}
        onIngredienteCreado={ingredientes.agregar}
        duplicate={form.duplicate}
        reactivating={form.reactivating}
        onReactivate={() => void form.handleReactivate()}
        alergenos={form.alergenos}
        onAlergenosChange={form.handleAlergenosChange}
        mostrarErrorAlergenos={form.mostrarErrorAlergenos}
        revision={precarga.revision}
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
