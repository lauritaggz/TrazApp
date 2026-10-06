import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { hoyChile, validarEncabezado, type EncabezadoErrors } from "@/lib/elaboracionUtils";
import { createElaboracion, getCodigoSugerido } from "@/services/elaboracionService";
import { ApiError } from "@/types/auth";
import type { Elaboracion } from "@/types/elaboracion";

interface ElaboracionCreateDialogProps {
  productoId: number;
  onCreated: (elaboracion: Elaboracion) => void;
  onCancel: () => void;
}

const CREATE_ERROR = "No pudimos crear la elaboración. Inténtalo nuevamente.";

function detalleObjeto(error: ApiError): Record<string, unknown> | null {
  const detail = error.detail;
  return detail && typeof detail === "object" && !Array.isArray(detail)
    ? (detail as Record<string, unknown>)
    : null;
}

/**
 * Asks for the code and the date before creating the borrador. Creating one marks the version
 * of the formulation as used and takes a code, so nothing is created until the productor
 * confirms. Mount only while open: each opening asks for a fresh suggestion.
 */
export default function ElaboracionCreateDialog({
  productoId,
  onCreated,
  onCancel,
}: ElaboracionCreateDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const codigoTocado = useRef(false);

  const [codigo, setCodigo] = useState("");
  const [fecha, setFecha] = useState(() => hoyChile());
  const [errors, setErrors] = useState<EncabezadoErrors>({});
  const [globalError, setGlobalError] = useState("");
  const [ingredientesDesactivados, setIngredientesDesactivados] = useState<string[]>([]);
  const [sugerenciaCargando, setSugerenciaCargando] = useState(true);
  const [sugerenciaError, setSugerenciaError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setSugerenciaCargando(true);
    setSugerenciaError(false);
    getCodigoSugerido(productoId)
      .then(({ codigo: sugerido }) => {
        // A code typed meanwhile is never overwritten.
        if (!cancelado && !codigoTocado.current) setCodigo(sugerido);
      })
      .catch(() => {
        if (!cancelado) setSugerenciaError(true);
      })
      .finally(() => {
        if (!cancelado) setSugerenciaCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [productoId]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('[name="codigo"]')?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loading, onCancel]);

  function handleCancel() {
    if (!loading) onCancel();
  }

  function mostrarError(err: unknown) {
    if (err instanceof ApiError) {
      const detalle = detalleObjeto(err);
      if (err.status === 409 && detalle) {
        if (typeof detalle.codigo_sugerido === "string") {
          setErrors({ codigo: `${err.message} Prueba con ${detalle.codigo_sugerido}.` });
          return;
        }
        if (Array.isArray(detalle.ingredientes)) {
          setIngredientesDesactivados(
            (detalle.ingredientes as { nombre?: unknown }[])
              .map((item) => (typeof item.nombre === "string" ? item.nombre : ""))
              .filter(Boolean),
          );
          setGlobalError(err.message);
          return;
        }
      }
      if (err.status === 422 && (err.fieldErrors.codigo || err.fieldErrors.fecha)) {
        setErrors({ codigo: err.fieldErrors.codigo, fecha: err.fieldErrors.fecha });
        return;
      }
      if (err.status === 422 && /fecha/i.test(err.message)) {
        setErrors({ fecha: err.message });
        return;
      }
      if (err.status === 409 || err.status === 422) {
        setGlobalError(err.message);
        return;
      }
    }
    setGlobalError(CREATE_ERROR);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setGlobalError("");
    setIngredientesDesactivados([]);
    const encontrados = validarEncabezado({ codigo, fecha });
    setErrors(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    setLoading(true);
    try {
      onCreated(await createElaboracion(productoId, { codigo: codigo.trim(), fecha }));
    } catch (err) {
      mostrarError(err);
      setLoading(false);
    }
  }

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
        className="relative w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-xl sm:rounded-xl border border-border bg-card p-5 sm:p-6 shadow-lg space-y-4"
      >
        <div className="space-y-1">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">
            Registrar elaboración
          </h2>
          <p id={descriptionId} className="text-sm text-text-secondary leading-relaxed">
            Se creará un borrador con los ingredientes de la formulación vigente. Después podrás
            indicar el insumo y el lote de cada uno.
          </p>
        </div>

        {globalError && (
          <Alert type="error">
            <p>{globalError}</p>
            {ingredientesDesactivados.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {ingredientesDesactivados.map((nombre) => (
                  <li key={nombre}>{nombre}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <Input
            id="elaboracion-nueva-codigo"
            name="codigo"
            label="Código de la elaboración"
            value={codigo}
            onChange={(event) => {
              codigoTocado.current = true;
              setCodigo(event.target.value);
              setErrors((actual) => ({ ...actual, codigo: undefined }));
            }}
            error={errors.codigo}
            hint={
              sugerenciaError
                ? "No pudimos obtener un código sugerido. Escribe el que imprimirás en el envase."
                : sugerenciaCargando
                  ? "Buscando un código sugerido..."
                  : "Es el código que imprimes en el envase. Debe ser único en este producto."
            }
            maxLength={100}
            autoComplete="off"
            disabled={loading}
          />
          <Input
            id="elaboracion-nueva-fecha"
            name="fecha"
            label="Fecha de elaboración"
            type="date"
            max={hoyChile()}
            value={fecha}
            onChange={(event) => {
              setFecha(event.target.value);
              setErrors((actual) => ({ ...actual, fecha: undefined }));
            }}
            error={errors.fecha}
            disabled={loading}
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full min-h-11 sm:w-auto"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" className="w-full min-h-11 sm:w-auto" loading={loading}>
              {loading ? "Creando…" : "Crear borrador"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
