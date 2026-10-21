import { useEffect, useId, useRef, type MutableRefObject } from "react";
import BuscarPorCodigo from "@/components/insumos/BuscarPorCodigo";
import ConfirmarReemplazoDatos from "@/components/insumos/ConfirmarReemplazoDatos";
import InsumoForm from "@/components/insumos/InsumoForm";
import ResumenProductoEncontrado from "@/components/insumos/ResumenProductoEncontrado";
import Alert from "@/components/ui/Alert";
import {
  useFormularioDesdeCodigo,
  usePublicarFormulario,
  type EstadoDelFormulario,
} from "@/hooks/useFormularioDesdeCodigo";
import { useInsumoExistente } from "@/hooks/useInsumoExistente";
import { useInsumoForm } from "@/hooks/useInsumoForm";
import type { PrecargaInsumo } from "@/lib/precargaInsumo";
import type { Insumo } from "@/types/insumo";

interface InsumoCreateDialogProps {
  /** The ingredient of the line the supply is registered for: preselected and locked. */
  ingrediente: { id: number; nombre: string };
  /** Called with the supply that ends up assigned: new, reactivated or an existing one. */
  onAssigned: (insumo: Insumo) => void;
  onCancel: () => void;
}

/** Mount only while open: each opening starts with an empty form. */
export default function InsumoCreateDialog({
  ingrediente,
  onAssigned,
  onCancel,
}: InsumoCreateDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const { busqueda, precarga, formularioRef, porConfirmar, reemplazar, conservar } =
    useFormularioDesdeCodigo({ ingrediente_id: String(ingrediente.id) });
  // The supply that already has the scanned code: it can be used (or reactivated) only for this line's ingredient.
  const existenteDeLaBusqueda = useInsumoExistente({
    ingredienteId: ingrediente.id,
    duplicadoId: busqueda.duplicado?.insumoId ?? null,
    onUsar: onAssigned,
    onReactivado: onAssigned,
  });

  // The initial focus stays on «Nombre»: the lookup block below the title does not take it.
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('[name="nombre"]')?.focus();
    return () => previousFocus?.focus();
  }, []);

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
        aria-describedby={descriptionId}
        className="relative w-full sm:max-w-xl max-h-[90dvh] overflow-y-auto rounded-t-xl sm:rounded-xl border border-border bg-card p-5 sm:p-6 shadow-lg space-y-4"
      >
        <div className="space-y-1">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">
            Crear insumo
          </h2>
          <p id={descriptionId} className="text-sm text-text-secondary leading-relaxed">
            Para el ingrediente {ingrediente.nombre}. El insumo se crea al instante; su asignación a
            esta línea se guarda con el borrador.
          </p>
        </div>

        <BuscarPorCodigo
          embedded
          busqueda={busqueda}
          existente={{
            onUsar: (duplicado) => void existenteDeLaBusqueda.usar(duplicado.insumoId),
            onReactivar: (duplicado) => void existenteDeLaBusqueda.reactivar(duplicado.insumoId),
            ocupado: existenteDeLaBusqueda.ocupado,
            aviso: existenteDeLaBusqueda.aviso,
            veredicto: existenteDeLaBusqueda.veredicto,
          }}
        />

        <FormularioEnDialogo
          key={precarga.clave}
          ingrediente={ingrediente}
          precarga={precarga}
          formularioRef={formularioRef}
          onAssigned={onAssigned}
          onCancel={onCancel}
          // Escape belongs to the scanner or to the confirmation while one of them is open.
          escapeParaOtro={busqueda.escanerAbierto || porConfirmar !== null}
          ocupadoPorFuera={existenteDeLaBusqueda.ocupado}
        />
      </div>

      <ConfirmarReemplazoDatos
        open={porConfirmar !== null}
        onConfirm={reemplazar}
        onCancel={conservar}
      />
    </div>
  );
}

interface FormularioEnDialogoProps {
  ingrediente: { id: number; nombre: string };
  precarga: PrecargaInsumo;
  formularioRef: MutableRefObject<EstadoDelFormulario>;
  onAssigned: (insumo: Insumo) => void;
  onCancel: () => void;
  escapeParaOtro: boolean;
  ocupadoPorFuera: boolean;
}

/** The form of the dialog. Mounted with `key`, so each lookup starts it again from its new data. */
function FormularioEnDialogo({
  ingrediente,
  precarga,
  formularioRef,
  onAssigned,
  onCancel,
  escapeParaOtro,
  ocupadoPorFuera,
}: FormularioEnDialogoProps) {
  const form = useInsumoForm({
    mode: "create",
    initialValues: precarga.valores,
    initialAlergenos: precarga.alergenos,
    extraPayload: precarga.extra,
    onSaved: onAssigned,
  });
  usePublicarFormulario(form, precarga, formularioRef);

  // The repeated barcode that the save found (409): use it or reactivate it, for this ingredient only.
  const existente = useInsumoExistente({
    ingredienteId: ingrediente.id,
    onUsar: onAssigned,
    onReactivado: onAssigned,
  });
  const ocupado = form.loading || existente.ocupado || ocupadoPorFuera;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !ocupado && !escapeParaOtro) onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [ocupado, escapeParaOtro, onCancel]);

  const mensaje = existente.aviso || form.globalError;

  return (
    <>
      {mensaje && <Alert type="error">{mensaje}</Alert>}

      <ResumenProductoEncontrado resumen={precarga.resumen} />

      <InsumoForm
        mode="create"
        embedded
        ingredienteFijo={{ id: ingrediente.id, nombre: ingrediente.nombre }}
        ingredientes={[]}
        values={form.values}
        errors={form.errors}
        loading={form.loading}
        errorFocusToken={form.errorFocusToken}
        duplicate={form.duplicate}
        reactivating={existente.ocupado}
        onReactivate={() => form.duplicate && void existente.reactivar(form.duplicate.insumoId)}
        onUseExisting={() => form.duplicate && void existente.usar(form.duplicate.insumoId)}
        usingExisting={existente.ocupado}
        alergenos={form.alergenos}
        onAlergenosChange={form.handleAlergenosChange}
        mostrarErrorAlergenos={form.mostrarErrorAlergenos}
        sugerencias={precarga.sugerencias}
        submitLabel="Crear insumo"
        loadingLabel="Creando…"
        onChange={(values) => {
          existente.limpiarAviso();
          form.handleChange(values);
        }}
        onSubmit={() => void form.handleSubmit()}
        onCancel={() => {
          if (!ocupado) onCancel();
        }}
      />
    </>
  );
}
