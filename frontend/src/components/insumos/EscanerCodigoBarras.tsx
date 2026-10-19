import { useEffect, useId, useRef } from "react";
import Button from "@/components/ui/Button";
import { useEscanerCodigoBarras, type EstadoEscaner } from "@/hooks/useEscanerCodigoBarras";

interface EscanerCodigoBarrasProps {
  /** Called with the recognized code. The camera is already stopped. */
  onDetectado: (codigo: string) => void;
  /** Called after the camera has been stopped because the productor closed the scanner. */
  onCerrar: () => void;
}

const MENSAJES: Record<EstadoEscaner, string> = {
  iniciando: "Iniciando la cámara…",
  escaneando:
    "Apunta al código de barras. Acércalo a unos 10 o 15 cm, con buena luz y sin reflejos.",
  reconocido: "Código reconocido.",
  error: "No pudimos usar la cámara.",
  detenido: "Cámara detenida.",
};

/** Mount only while open: the camera starts on mount and is released on unmount. */
export default function EscanerCodigoBarras({ onDetectado, onCerrar }: EscanerCodigoBarrasProps) {
  const titleId = useId();
  const estadoId = useId();
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const {
    videoRef,
    estado,
    codigo,
    linternaDisponible,
    linternaEncendida,
    alternarLinterna,
    cerrar,
  } = useEscanerCodigoBarras({ onDetectado });

  function handleCerrar() {
    cerrar();
    onCerrar();
  }

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    cerrarRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        cerrar();
        onCerrar();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cerrar, onCerrar]);

  const mensaje = estado === "reconocido" && codigo ? `Código reconocido: ${codigo}.` : MENSAJES[estado];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={estadoId}
        className="relative w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-xl sm:rounded-xl border border-border bg-card p-5 sm:p-6 shadow-lg space-y-4"
      >
        <h2 id={titleId} className="text-lg font-semibold text-text-primary">
          Escanear código de barras
        </h2>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            autoPlay
            aria-label="Vista de la cámara"
          />
          {estado === "escaneando" && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 aspect-[3/2] w-4/5 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-white/90"
              aria-hidden="true"
            />
          )}
        </div>

        <p
          id={estadoId}
          role="status"
          aria-live="polite"
          className="text-sm text-text-secondary leading-relaxed"
        >
          {mensaje}
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          {linternaDisponible && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              aria-pressed={linternaEncendida}
              onClick={() => void alternarLinterna()}
            >
              Linterna
            </Button>
          )}
          <Button
            ref={cerrarRef}
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={handleCerrar}
          >
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
