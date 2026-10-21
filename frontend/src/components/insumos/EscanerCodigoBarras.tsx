import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import { LinternaApagadaIcon, LinternaEncendidaIcon } from "@/components/insumos/linternaIcons";
import { Input } from "@/components/ui/Input";
import { useEscanerCodigoBarras, type EstadoEscaner } from "@/hooks/useEscanerCodigoBarras";
import { validarEntradaManual } from "@/lib/entradaCodigoBarras";
import { clasificarErrorCamara, ERRORES_CAMARA } from "@/lib/errorCamara";

interface EscanerCodigoBarrasProps {
  /** Called with the code, read by the camera or typed by hand. The camera is already stopped. */
  onDetectado: (codigo: string) => void;
  /** Called after the camera has been stopped because the productor closed the scanner. */
  onCerrar: () => void;
}

const MENSAJES: Record<Exclude<EstadoEscaner, "error">, string> = {
  iniciando: "Iniciando la cámara…",
  escaneando:
    "Apunta al código de barras. Acércalo a unos 10 o 15 cm, con buena luz y sin reflejos.",
  reconocido: "Código reconocido.",
  detenido: "Cámara detenida.",
};

/**
 * Mount only while open: the camera starts on mount and is released on unmount. The field to type
 * the number of the code is always there, with the camera working and when it fails (CA04, CA05).
 */
export default function EscanerCodigoBarras({ onDetectado, onCerrar }: EscanerCodigoBarrasProps) {
  const titleId = useId();
  const estadoId = useId();
  const campoId = useId();
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);
  const [entrada, setEntrada] = useState("");
  const [errorEntrada, setErrorEntrada] = useState("");
  const {
    videoRef,
    estado,
    error,
    codigo,
    origenCodigo,
    linternaDisponible,
    linternaEncendida,
    alternarLinterna,
    cerrar,
    reiniciar,
    usarCodigoManual,
  } = useEscanerCodigoBarras({ onDetectado });

  function handleCerrar() {
    cerrar();
    onCerrar();
  }

  function handleBuscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resultado = validarEntradaManual(entrada);
    if (resultado.error !== null) {
      setErrorEntrada(resultado.error);
      campoRef.current?.focus();
      return;
    }
    setErrorEntrada("");
    usarCodigoManual(resultado.codigo);
  }

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    cerrarRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  // When the camera fails, the way forward is the field: the focus goes there.
  useEffect(() => {
    if (estado === "error") campoRef.current?.focus();
  }, [estado]);

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

  const presentacionError = estado === "error" ? ERRORES_CAMARA[clasificarErrorCamara(error)] : null;

  let mensaje: string;
  if (presentacionError) mensaje = presentacionError.mensaje;
  else if (estado === "reconocido" && codigo) {
    mensaje =
      origenCodigo === "manual" ? `Código ingresado: ${codigo}.` : `Código reconocido: ${codigo}.`;
  } else mensaje = MENSAJES[estado === "error" ? "iniciando" : estado];

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

        {/* Stays mounted while the camera fails: "Intentar de nuevo" starts it again on this element. */}
        <div
          className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black"
          hidden={estado === "error"}
        >
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
              className="pointer-events-none absolute left-1/2 top-[8%] aspect-[3/2] w-3/4 -translate-x-1/2 rounded-lg border-2 border-white/90"
              aria-hidden="true"
            />
          )}
          {/* On the video, centered under the guide frame, within reach of the thumb. */}
          {estado === "escaneando" && linternaDisponible && (
            <button
              type="button"
              aria-label={linternaEncendida ? "Apagar linterna" : "Encender linterna"}
              aria-pressed={linternaEncendida}
              onClick={() => void alternarLinterna()}
              className={`absolute bottom-1.5 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                linternaEncendida
                  ? "border-white bg-white text-black hover:bg-white/90"
                  : "border-white/50 bg-black/65 text-white hover:bg-black/80"
              }`}
            >
              {linternaEncendida ? <LinternaEncendidaIcon /> : <LinternaApagadaIcon />}
            </button>
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

        {presentacionError?.reintentable && (
          <Button type="button" variant="secondary" className="w-full" onClick={reiniciar}>
            Intentar de nuevo
          </Button>
        )}

        <form onSubmit={handleBuscar} noValidate className="space-y-3">
          <Input
            ref={campoRef}
            id={campoId}
            label="Número del código de barras"
            hint="8, 12 o 13 dígitos. Puedes escribirlo con espacios o guiones."
            error={errorEntrada || undefined}
            value={entrada}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) => {
              setEntrada(event.target.value);
              if (errorEntrada) setErrorEntrada("");
            }}
          />
          <Button type="submit" className="w-full">
            Buscar
          </Button>
        </form>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
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
