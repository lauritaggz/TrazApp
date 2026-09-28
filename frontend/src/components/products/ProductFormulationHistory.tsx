import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import {
  formatFechaVersion,
  formatFormulacionCantidad,
  ingredientCountLabel,
} from "@/lib/formulationUtils";
import { getVersionFormulation, listProductVersions } from "@/services/formulationService";
import type { FormulacionLinea, VersionProductoHistorial } from "@/types/formulation";

interface ProductFormulationHistoryProps {
  productoId: number;
  /** Changes after each save so the history is fetched again. */
  refreshKey: number;
}

export default function ProductFormulationHistory({
  productoId,
  refreshKey,
}: ProductFormulationHistoryProps) {
  const [versiones, setVersiones] = useState<VersionProductoHistorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<FormulacionLinea[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalleError, setDetalleError] = useState("");

  const loadVersiones = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setVersiones(await listProductVersions(productoId));
    } catch {
      setVersiones([]);
      setError("No pudimos cargar el historial de versiones.");
    } finally {
      setLoading(false);
    }
  }, [productoId]);

  const detalleRequest = useRef(0);

  const loadDetalle = useCallback(
    async (versionId: number) => {
      const request = ++detalleRequest.current;
      setSelectedId(versionId);
      setDetalle([]);
      setDetalleLoading(true);
      setDetalleError("");
      try {
        const lineas = await getVersionFormulation(productoId, versionId);
        if (request === detalleRequest.current) setDetalle(lineas);
      } catch {
        if (request === detalleRequest.current) {
          setDetalleError("No pudimos cargar los ingredientes de esta versión.");
        }
      } finally {
        if (request === detalleRequest.current) setDetalleLoading(false);
      }
    },
    [productoId],
  );

  useEffect(() => {
    setSelectedId(null);
    void loadVersiones();
  }, [loadVersiones, refreshKey]);

  if (loading) {
    return (
      <p className="text-xs text-text-secondary" aria-live="polite">
        Cargando historial de versiones...
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Alert type="error">{error}</Alert>
        <Button type="button" variant="secondary" onClick={() => void loadVersiones()}>
          Reintentar historial
        </Button>
      </div>
    );
  }

  if (versiones.length <= 1) return null;

  const seleccionada = versiones.find((version) => version.id === selectedId) ?? null;

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-text-primary">Historial de versiones</h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          Se crea una nueva versión cuando se modifica la receta de un producto que ya
          se utilizó en una elaboración.
        </p>
      </div>

      <Button
        type="button"
        variant="ghost"
        className="w-full sm:w-auto px-2"
        aria-expanded={open}
        aria-controls="formulacion-historial"
        onClick={() => setOpen((value) => !value)}
      >
        {open
          ? "Ocultar historial de versiones"
          : `Ver historial de versiones (${versiones.length})`}
      </Button>

      {open && (
        <div id="formulacion-historial" className="space-y-3">
          <ul className="space-y-2" aria-label="Versiones de la formulación">
            {versiones.map((version) => (
              <li
                key={version.id}
                className={`border rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
                  version.id === selectedId ? "border-brand-600 bg-brand-50" : "border-border"
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      Versión {version.numero_version}
                    </span>
                    {version.vigente && (
                      <span className="rounded-full bg-brand-50 text-brand-700 border border-brand-100 px-2 py-0.5 text-[11px] font-semibold">
                        Vigente
                      </span>
                    )}
                    {version.usada_en_elaboracion && (
                      <span className="rounded-full border border-border bg-surface text-text-secondary px-2 py-0.5 text-[11px] font-semibold">
                        Usada en elaboraciones
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary">
                    {formatFechaVersion(version.fecha_creacion)} ·{" "}
                    {ingredientCountLabel(version.cantidad_lineas)}
                  </p>
                </div>
                {!version.vigente && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto shrink-0"
                    aria-pressed={version.id === selectedId}
                    onClick={() => void loadDetalle(version.id)}
                  >
                    Ver ingredientes de la versión {version.numero_version}
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {seleccionada && (
            <VersionDetalle
              numeroVersion={seleccionada.numero_version}
              lineas={detalle}
              loading={detalleLoading}
              error={detalleError}
              onRetry={() => void loadDetalle(seleccionada.id)}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function VersionDetalle({
  numeroVersion,
  lineas,
  loading,
  error,
  onRetry,
  onClose,
}: {
  numeroVersion: number;
  lineas: FormulacionLinea[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <section
      aria-label={`Ingredientes de la versión ${numeroVersion}`}
      className="rounded-lg bg-surface border border-border p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-text-primary">
          Versión {numeroVersion} (solo lectura)
        </h4>
        <Button type="button" variant="ghost" className="px-2 py-1" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary" aria-live="polite">
          Cargando ingredientes de la versión...
        </p>
      ) : error ? (
        <div className="space-y-3">
          <Alert type="error">{error}</Alert>
          <Button type="button" variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      ) : lineas.length === 0 ? (
        <p className="text-sm text-text-secondary">Esta versión no tiene ingredientes.</p>
      ) : (
        <ul className="divide-y divide-border">
          {lineas.map((linea) => (
            <li
              key={linea.id}
              className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2"
            >
              <span className="text-sm text-text-primary break-words">
                {linea.ingrediente_nombre}
                {linea.ingrediente_codigo_interno && (
                  <span className="ml-2 text-xs text-text-secondary">
                    {linea.ingrediente_codigo_interno}
                  </span>
                )}
              </span>
              <span className="text-sm text-text-secondary">
                {formatFormulacionCantidad(linea.cantidad, linea.unidad) ?? "Sin cantidad"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
