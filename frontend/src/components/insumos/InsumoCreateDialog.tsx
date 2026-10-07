import { useEffect, useId, useRef, useState } from "react";
import InsumoForm from "@/components/insumos/InsumoForm";
import Alert from "@/components/ui/Alert";
import { useInsumoForm } from "@/hooks/useInsumoForm";
import { getInsumo } from "@/services/insumoService";
import type { Insumo } from "@/types/insumo";

interface InsumoCreateDialogProps {
  /** The ingredient of the line the supply is registered for: preselected and locked. */
  ingrediente: { id: number; nombre: string };
  /** Called with the supply that ends up assigned: new, reactivated or an existing one. */
  onAssigned: (insumo: Insumo) => void;
  onCancel: () => void;
}

const LOOKUP_ERROR = "No pudimos comprobar el insumo existente. Inténtalo nuevamente.";

function otroIngrediente(nombre: string): string {
  return `Ese insumo está asociado a «${nombre}».`;
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
  const [aviso, setAviso] = useState("");
  const [comprobando, setComprobando] = useState(false);

  const form = useInsumoForm({
    mode: "create",
    initialValues: { ingrediente_id: String(ingrediente.id) },
    onSaved: onAssigned,
    onReactivated: onAssigned,
  });
  const { loading, reactivating } = form;
  const ocupado = loading || reactivating || comprobando;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('[name="nombre"]')?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !ocupado) onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [ocupado, onCancel]);

  function handleCancel() {
    if (!ocupado) onCancel();
  }

  /** The repeated barcode belongs to an active supply: use it, if it is for this ingredient. */
  async function handleUseExisting() {
    if (!form.duplicate || ocupado) return;
    setAviso("");
    setComprobando(true);
    try {
      const existente = await getInsumo(form.duplicate.insumoId);
      if (existente.ingrediente_id !== ingrediente.id) {
        setAviso(otroIngrediente(existente.ingrediente.nombre));
        return;
      }
      onAssigned(existente);
    } catch {
      setAviso(LOOKUP_ERROR);
    } finally {
      setComprobando(false);
    }
  }

  /**
   * Reactivating a deactivated supply also assigns it, so it must belong to this ingredient:
   * check before reactivating anything.
   */
  async function handleReactivate() {
    if (!form.duplicate || ocupado) return;
    setAviso("");
    setComprobando(true);
    try {
      const existente = await getInsumo(form.duplicate.insumoId);
      if (existente.ingrediente_id !== ingrediente.id) {
        setAviso(otroIngrediente(existente.ingrediente.nombre));
        return;
      }
    } catch {
      setAviso(LOOKUP_ERROR);
      return;
    } finally {
      setComprobando(false);
    }
    await form.handleReactivate();
  }

  const mensaje = aviso || form.globalError;

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
            Registrar insumo nuevo
          </h2>
          <p id={descriptionId} className="text-sm text-text-secondary leading-relaxed">
            Para el ingrediente {ingrediente.nombre}. Quedará asignado a esta línea; se guarda en
            la elaboración cuando guardes el borrador.
          </p>
        </div>

        {mensaje && <Alert type="error">{mensaje}</Alert>}

        <InsumoForm
          mode="create"
          embedded
          ingredienteFijo={{ id: ingrediente.id, nombre: ingrediente.nombre }}
          ingredientes={[]}
          values={form.values}
          errors={form.errors}
          loading={loading}
          errorFocusToken={form.errorFocusToken}
          duplicate={form.duplicate}
          reactivating={reactivating || comprobando}
          onReactivate={() => void handleReactivate()}
          onUseExisting={() => void handleUseExisting()}
          usingExisting={comprobando}
          submitLabel="Registrar insumo"
          loadingLabel="Registrando…"
          onChange={(values) => {
            if (aviso) setAviso("");
            form.handleChange(values);
          }}
          onSubmit={() => void form.handleSubmit()}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
