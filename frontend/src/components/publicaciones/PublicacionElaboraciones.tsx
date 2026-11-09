import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PublicacionSwitch from "@/components/publicaciones/PublicacionSwitch";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toastContext";
import { formatFecha } from "@/lib/elaboracionUtils";
import { listElaboraciones } from "@/services/elaboracionService";
import { mostrarElaboracion, ocultarElaboracion } from "@/services/visibilidadService";
import { ApiError } from "@/types/auth";
import type { ElaboracionResumen } from "@/types/elaboracion";

const POR_PAGINA = 20;
const MENSAJE_ERROR = "No pudimos cambiar la visibilidad. Revisa tu conexión e inténtalo de nuevo.";

/**
 * The finalized elaboraciones of a product with a Visible / Oculta switch each (HU09, CA6). The list
 * is the history of HU06 filtered by product and state, so its order is the history's: the most
 * recent elaboration date first. «Predeterminada» is the first visible one of that order.
 */
export default function PublicacionElaboraciones({ productoId }: { productoId: number }) {
  const { notify } = useToast();
  const [items, setItems] = useState<ElaboracionResumen[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMas, setLoadingMas] = useState(false);
  const [error, setError] = useState(false);
  const [errorFila, setErrorFila] = useState<Record<number, string>>({});
  const [enCurso, setEnCurso] = useState<Set<number>>(new Set());
  const [aOcultar, setAOcultar] = useState<ElaboracionResumen | null>(null);
  const bloqueadas = useRef(new Set<number>());

  const cargar = useCallback(
    async (offset: number) => {
      const pagina = await listElaboraciones({ productoId, estado: "finalizada", limit: POR_PAGINA, offset });
      return pagina;
    },
    [productoId],
  );

  const cargarPrimera = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const pagina = await cargar(0);
      setItems(pagina.items);
      setTotal(pagina.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [cargar]);

  useEffect(() => {
    void cargarPrimera();
  }, [cargarPrimera]);

  async function cargarMas() {
    setLoadingMas(true);
    setError(false);
    try {
      const pagina = await cargar(items.length);
      setItems((actual) => [...actual, ...pagina.items.filter((n) => !actual.some((a) => a.id === n.id))]);
      setTotal(pagina.total);
    } catch {
      setError(true);
    } finally {
      setLoadingMas(false);
    }
  }

  async function cambiar(elaboracion: ElaboracionResumen, ocultar: boolean) {
    if (bloqueadas.current.has(elaboracion.id)) return;
    bloqueadas.current.add(elaboracion.id);
    setEnCurso(new Set(bloqueadas.current));
    setErrorFila((actual) => ({ ...actual, [elaboracion.id]: "" }));
    try {
      const estado = await (ocultar ? ocultarElaboracion : mostrarElaboracion)(elaboracion.id);
      setItems((actual) => actual.map((i) => (i.id === elaboracion.id ? { ...i, oculta: estado.oculta } : i)));
      notify(ocultar ? "Elaboración oculta al público." : "Elaboración visible al público.");
    } catch (err) {
      const mensaje =
        err instanceof ApiError && err.status === 404
          ? "Esta elaboración ya no existe."
          : err instanceof ApiError && err.status === 409
            ? err.message
            : MENSAJE_ERROR;
      setErrorFila((actual) => ({ ...actual, [elaboracion.id]: mensaje }));
    } finally {
      bloqueadas.current.delete(elaboracion.id);
      setEnCurso(new Set(bloqueadas.current));
      setAOcultar(null);
    }
  }

  const predeterminada = items.find((i) => i.oculta !== true)?.id;

  return (
    <section aria-labelledby="publicacion-elaboraciones" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 id="publicacion-elaboraciones" className="text-sm font-semibold text-text-primary">
          Elaboraciones finalizadas
        </h2>
        <p className="mt-0.5 text-[13px] text-text-secondary">
          La elaboración visible más reciente se muestra por defecto. Ocultar una no modifica su información conservada.
        </p>
      </div>

      {loading && <p className="p-4 text-sm text-text-secondary sm:p-5" aria-live="polite">Cargando elaboraciones...</p>}

      {error && !loadingMas && items.length === 0 && !loading && (
        <div className="p-4 sm:p-5">
          <Alert type="error">
            <p>No pudimos cargar las elaboraciones. Revisa tu conexión e inténtalo de nuevo.</p>
            <Button type="button" variant="secondary" className="mt-3" onClick={() => void cargarPrimera()}>
              Reintentar
            </Button>
          </Alert>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="p-4 text-sm text-text-secondary sm:p-5">Este producto aún no tiene elaboraciones finalizadas.</p>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const oculta = item.oculta === true;
            return (
              <li key={item.id} className="space-y-2 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/elaboraciones/${item.id}`}
                        className="inline-flex min-h-11 items-center font-mono text-sm font-semibold text-text-primary underline-offset-2 hover:underline"
                      >
                        {item.codigo}
                      </Link>
                      <Badge variant={oculta ? "neutral" : "success"}>{oculta ? "Oculta" : "Visible"}</Badge>
                      {item.id === predeterminada && <Badge variant="brand">Predeterminada</Badge>}
                    </div>
                    <p className="text-[13px] text-text-secondary">{formatFecha(item.fecha)}</p>
                  </div>
                  <PublicacionSwitch
                    checked={!oculta}
                    disabled={enCurso.has(item.id)}
                    label={oculta ? `Mostrar ${item.codigo}` : `Ocultar ${item.codigo}`}
                    onChange={(visible) => (visible ? void cambiar(item, false) : setAOcultar(item))}
                  />
                </div>
                {errorFila[item.id] && (
                  <Alert type="error">
                    <p>{errorFila[item.id]}</p>
                  </Alert>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && items.length > 0 && (
        <div className="px-4 pb-4 sm:px-5">
          <Alert type="error">
            <p>No pudimos cargar más elaboraciones. Inténtalo de nuevo.</p>
          </Alert>
        </div>
      )}

      {items.length > 0 && items.length < total && (
        <div className="border-t border-border p-4 sm:px-5">
          <Button type="button" variant="secondary" loading={loadingMas} onClick={() => void cargarMas()}>
            {loadingMas ? "Cargando…" : "Cargar más"}
          </Button>
          <p className="mt-2 text-[13px] text-text-secondary">
            Mostrando {items.length} de {total} elaboraciones.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={aOcultar !== null}
        title={aOcultar ? `Ocultar elaboración ${aOcultar.codigo}` : "Ocultar elaboración"}
        description="El consumidor no verá esta elaboración. Si es la única visible del producto, la consulta pública mostrará «información no disponible»."
        confirmLabel="Ocultar elaboración"
        cancelLabel="Cancelar"
        loading={aOcultar !== null && enCurso.has(aOcultar.id)}
        onConfirm={() => aOcultar && void cambiar(aOcultar, true)}
        onCancel={() => {
          if (aOcultar === null || !enCurso.has(aOcultar.id)) setAOcultar(null);
        }}
      />
    </section>
  );
}
