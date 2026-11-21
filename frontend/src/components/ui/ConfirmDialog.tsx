import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [loading, onCancel, open]);

  if (!open) return null;

  // En un portal sobre <body>: si el diálogo nace dentro del encabezado (menú de usuario),
  // su `backdrop-filter` lo volvía el marco de referencia de `fixed` y el diálogo quedaba cortado.
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="dialogo-fondo absolute inset-0 bg-black/35 backdrop-blur-[6px]"
        aria-label="Cerrar diálogo"
        disabled={loading}
        onClick={() => {
          if (!loading) onCancel();
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="dialogo-panel relative w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-lift sm:p-6"
      >
        <div className="space-y-2">
          <h2 id={titleId} className="text-xl font-bold text-text-primary">
            {title}
          </h2>
          <p
            id={descriptionId}
            className="text-sm text-text-secondary leading-relaxed whitespace-pre-line"
          >
            {description}
          </p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={loading}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className={`w-full sm:w-auto ${
              destructive
                ? "bg-error text-white hover:bg-error/90 focus-visible:ring-error"
                : ""
            }`}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
