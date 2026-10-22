import { useEffect, useId, useRef, useState } from "react";
import AlergenosSelector from "@/components/insumos/AlergenosSelector";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { alergenosParaEnviar, alergenosValidos } from "@/lib/alergenosDeclaracion";
import { replaceInsumoAlergenos } from "@/services/insumoService";
import { ApiError } from "@/types/auth";
import type { AlergenosValue, Insumo } from "@/types/insumo";

interface RevisarAlergenosDialogProps {
  /** The supply whose allergens are reviewed (the one selected in the line). */
  insumo: Insumo;
  /** The saved supply, already reviewed. The registro replaces it in every line that uses it. */
  onGuardado: (insumo: Insumo) => void;
  onCancel: () => void;
}

const SAVE_ERROR = "No pudimos guardar los alérgenos. Revisa tu conexión e inténtalo de nuevo.";

/**
 * Review of the allergens of a supply from a line of the registro (HT06). It starts from the
 * allergens the supply has now (normally none), saves them with PUT /gestion/insumos/{id}/alergenos
 * (which records the review) and closes. It does not navigate and it does not touch the assignment
 * the productor has not saved yet. Mount only while open.
 */
export default function RevisarAlergenosDialog({
  insumo,
  onGuardado,
  onCancel,
}: RevisarAlergenosDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<AlergenosValue>({
    items: insumo.alergenos_declarados.map((item) => ({
      alergeno_id: item.alergeno_id,
      tipo: item.tipo,
    })),
    sinAlergenos: false,
  });
  const [mostrarError, setMostrarError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('[name="sin_alergenos"], button')?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [saving, onCancel]);

  async function handleGuardar() {
    setError("");
    if (!alergenosValidos(value)) {
      setMostrarError(true);
      panelRef.current?.querySelector<HTMLElement>('[name="sin_alergenos"]')?.focus();
      return;
    }
    setSaving(true);
    try {
      onGuardado(await replaceInsumoAlergenos(insumo.id, alergenosParaEnviar(value)));
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 500 ? err.message : SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative max-h-[90dvh] w-full space-y-4 overflow-y-auto rounded-t-xl border border-border bg-card p-5 shadow-lg sm:max-w-xl sm:rounded-xl sm:p-6"
      >
        <div className="space-y-1">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">
            Revisar alérgenos
          </h2>
          <p id={descriptionId} className="text-sm leading-relaxed text-text-secondary">
            Insumo: {insumo.nombre}. Declara los alérgenos del envase o confirma que no contiene
            ninguno. Se guardan en el insumo; las asignaciones que aún no guardaste no se pierden.
          </p>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        <AlergenosSelector
          value={value}
          onChange={(next) => {
            setError("");
            setValue(next);
          }}
          disabled={saving}
          mostrarError={mostrarError}
        />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => {
              if (!saving) onCancel();
            }}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => void handleGuardar()}
            loading={saving}
          >
            Guardar alérgenos
          </Button>
        </div>
      </div>
    </div>
  );
}
