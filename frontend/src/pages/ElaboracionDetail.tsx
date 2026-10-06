import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/toastContext";
import { useAppShell } from "@/hooks/useAppShell";
import { describirLote, formatFecha, formatFechaHora } from "@/lib/elaboracionUtils";
import { getElaboracion } from "@/services/elaboracionService";
import type { Elaboracion } from "@/types/elaboracion";

function parseId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Minimal read-only view of an elaboración (T05-06). The full detail, with the allergens of the
 * conserved information, is T05-07. A finalizada shows what was conserved, never the live supply.
 */
export default function ElaboracionDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useToast();
  const { id: rawId } = useParams();
  const elaboracionId = parseId(rawId);
  const { handleLogout, producerName, businessName } = useAppShell();

  const [elaboracion, setElaboracion] = useState<Elaboracion | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setUnavailable(false);
    try {
      setElaboracion(await getElaboracion(id));
    } catch {
      setElaboracion(null);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (elaboracionId == null) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    void load(elaboracionId);
  }, [elaboracionId, load]);

  useEffect(() => {
    const state = location.state as { elaboracionFinalizada?: boolean } | null;
    if (!state?.elaboracionFinalizada) return;
    notify("Elaboración finalizada correctamente.");
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, notify]);

  const finalizada = elaboracion?.estado === "finalizada";

  return (
    <AppShell
      activePage="productos"
      pageTitle={elaboracion ? `Elaboración ${elaboracion.codigo}` : "Elaboración"}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {loading && <p className="text-sm text-text-secondary">Cargando elaboración...</p>}

        {!loading && unavailable && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <h1 className="text-lg font-semibold text-text-primary">Elaboración no disponible</h1>
            <p className="text-sm text-text-secondary">
              No encontramos esta elaboración. Puede haber sido eliminada o no pertenecer a tu cuenta.
            </p>
            <Button type="button" variant="secondary" onClick={() => navigate("/productos")}>
              Volver a productos
            </Button>
          </div>
        )}

        {!loading && elaboracion && (
          <>
            <PageHeader
              title={`Elaboración ${elaboracion.codigo}`}
              description={`${elaboracion.producto.nombre} · versión ${elaboracion.version.numero_version}`}
              titleSuffix={
                finalizada ? (
                  <Badge variant="success">Finalizada</Badge>
                ) : (
                  <Badge variant="warning">Borrador</Badge>
                )
              }
              breadcrumbs={[
                { label: "Productos", to: "/productos" },
                { label: elaboracion.producto.nombre, to: `/productos/${elaboracion.producto.id}` },
                { label: `Elaboración ${elaboracion.codigo}` },
              ]}
              actions={
                !finalizada ? (
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={() => navigate(`/elaboraciones/${elaboracion.id}/registro`)}
                  >
                    Continuar registro
                  </Button>
                ) : undefined
              }
            />

            <dl className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 sm:p-5">
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                  Fecha de elaboración
                </dt>
                <dd className="text-sm text-text-primary">{formatFecha(elaboracion.fecha)}</dd>
              </div>
              {finalizada && (
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                    Finalizada el
                  </dt>
                  <dd className="text-sm text-text-primary">
                    {formatFechaHora(elaboracion.finalizada_at)}
                  </dd>
                </div>
              )}
            </dl>

            <section aria-labelledby="elaboracion-usos" className="space-y-3">
              <h2 id="elaboracion-usos" className="text-sm font-semibold text-text-primary">
                Insumos utilizados
              </h2>
              <ul className="space-y-3">
                {elaboracion.usos.map((uso) => (
                  <li
                    key={uso.ingrediente_id}
                    className="space-y-1 rounded-xl border border-border bg-card p-4"
                  >
                    <p className="text-sm font-semibold text-text-primary">{uso.ingrediente_nombre}</p>
                    {uso.insumo ? (
                      <p className="text-sm text-text-primary">
                        {uso.insumo.nombre} · {uso.insumo.marca_origen}
                      </p>
                    ) : (
                      <p className="text-sm text-text-secondary">Sin insumo asignado</p>
                    )}
                    <p className="text-sm text-text-secondary">
                      {uso.lote
                        ? `Lote ${describirLote(uso.lote.codigo, uso.lote.fecha_vencimiento)}`
                        : uso.sin_lote
                          ? "Sin lote"
                          : "Lote pendiente"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
