import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import AlergenosAgrupados from "@/components/elaboraciones/AlergenosAgrupados";
import AppShell from "@/components/layout/AppShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/toastContext";
import { useAppShell } from "@/hooks/useAppShell";
import { consolidarAlergenos } from "@/lib/alergenosResumen";
import {
  describirLote,
  formatFecha,
  textoInformacionConservada,
} from "@/lib/elaboracionUtils";
import { formatFormulacionCantidad } from "@/lib/formulationUtils";
import { getElaboracion } from "@/services/elaboracionService";
import { ApiError } from "@/types/auth";
import type { Elaboracion, UsoInsumo } from "@/types/elaboracion";

function parseId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Read-only detail of an elaboración (HU05, CA15). A finalizada shows ONLY what the backend
 * returns from the information conserved when it was finalized: this screen never asks for the
 * current supply. A borrador has no detail: it goes to the registro screen.
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
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setNotFound(false);
    setLoadError(false);
    try {
      setElaboracion(await getElaboracion(id));
    } catch (err) {
      setElaboracion(null);
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (elaboracionId == null) {
      setNotFound(true);
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

  const resumen = useMemo(
    () =>
      consolidarAlergenos(
        (elaboracion?.usos ?? []).flatMap((uso) => uso.insumo?.alergenos ?? []),
      ),
    [elaboracion],
  );

  // A borrador is edited, not read.
  if (elaboracion?.estado === "borrador") {
    return <Navigate to={`/elaboraciones/${elaboracion.id}/registro`} replace />;
  }

  return (
    <AppShell
      activePage="productos"
      pageTitle={elaboracion ? `Elaboración ${elaboracion.codigo}` : "Elaboración"}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {loading && (
          <div className="space-y-4" aria-live="polite" aria-busy="true">
            <p className="text-sm text-text-secondary">Cargando elaboración...</p>
            <div className="h-8 w-2/3 animate-pulse rounded-lg border border-border bg-card" />
            <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />
          </div>
        )}

        {!loading && notFound && (
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

        {!loading && loadError && (
          <div role="alert" className="space-y-4 rounded-xl border border-error-border bg-error-bg p-6">
            <p className="text-sm font-medium text-error">No pudimos cargar la elaboración.</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => elaboracionId !== null && void load(elaboracionId)}
            >
              Reintentar
            </Button>
          </div>
        )}

        {!loading && elaboracion && (
          <>
            <PageHeader
              title={`Elaboración ${elaboracion.codigo}`}
              description={elaboracion.producto.nombre}
              titleSuffix={<Badge variant="success">Finalizada</Badge>}
              breadcrumbs={[
                { label: "Productos", to: "/productos" },
                { label: elaboracion.producto.nombre, to: `/productos/${elaboracion.producto.id}` },
                { label: `Elaboración ${elaboracion.codigo}` },
              ]}
              actions={
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => navigate(`/productos/${elaboracion.producto.id}`)}
                >
                  Volver al producto
                </Button>
              }
            />

            <section
              aria-labelledby="elaboracion-datos"
              className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
            >
              <h2 id="elaboracion-datos" className="sr-only">
                Datos de la elaboración
              </h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Dato titulo="Producto">
                  <Link
                    to={`/productos/${elaboracion.producto.id}`}
                    className="font-medium text-accent-strong underline-offset-2 hover:underline"
                  >
                    {elaboracion.producto.nombre}
                  </Link>
                </Dato>
                <Dato titulo="Código">{elaboracion.codigo}</Dato>
                <Dato titulo="Fecha de elaboración">{formatFecha(elaboracion.fecha)}</Dato>
                <Dato titulo="Versión de la formulación">
                  Versión {elaboracion.version.numero_version}
                </Dato>
              </dl>
              {textoInformacionConservada(elaboracion.finalizada_at) && (
                <p className="border-t border-border pt-3 text-sm text-text-secondary">
                  {textoInformacionConservada(elaboracion.finalizada_at)}
                </p>
              )}
            </section>

            <section
              aria-labelledby="elaboracion-resumen-alergenos"
              className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5"
            >
              <h2
                id="elaboracion-resumen-alergenos"
                className="text-sm font-semibold uppercase tracking-wide text-text-primary"
              >
                Alérgenos de la elaboración
              </h2>
              <AlergenosAgrupados
                contiene={resumen.contiene}
                puedeContener={resumen.puedeContener}
                vacio="No hay alérgenos declarados en los insumos de esta elaboración."
                mostrarGruposVacios
                etiqueta="resumen"
              />
            </section>

            <section aria-labelledby="elaboracion-usos" className="space-y-3">
              <h2
                id="elaboracion-usos"
                className="text-sm font-semibold uppercase tracking-wide text-text-primary"
              >
                Insumos utilizados
              </h2>
              <ul className="space-y-4">
                {elaboracion.usos.map((uso) => (
                  <li key={uso.ingrediente_id}>
                    <UsoDetalle uso={uso} />
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

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">{titulo}</dt>
      <dd className="text-sm text-text-primary">{children}</dd>
    </div>
  );
}

function UsoDetalle({ uso }: { uso: UsoInsumo }) {
  const titulo = `uso-${uso.ingrediente_id}`;
  const insumo = uso.insumo;
  const cantidad = formatFormulacionCantidad(uso.cantidad, uso.unidad);
  const alergenos = consolidarAlergenos(insumo?.alergenos ?? []);

  return (
    <section
      aria-labelledby={titulo}
      className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <div>
        <h3 id={titulo} className="text-base font-semibold text-text-primary">
          {uso.ingrediente_nombre}
        </h3>
        {cantidad && <p className="text-sm text-text-secondary">{cantidad}</p>}
      </div>

      {insumo && (
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato titulo="Insumo">{insumo.nombre}</Dato>
          <Dato titulo="Marca u origen">{insumo.marca_origen}</Dato>
          {insumo.presentacion && <Dato titulo="Presentación">{insumo.presentacion}</Dato>}
          {insumo.codigo_barras && <Dato titulo="Código de barras">{insumo.codigo_barras}</Dato>}
          <Dato titulo="Lote">
            {uso.lote ? describirLote(uso.lote.codigo, uso.lote.fecha_vencimiento) : "Sin lote"}
          </Dato>
        </dl>
      )}

      {insumo?.ingredientes_declarados && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Ingredientes declarados
          </h4>
          <p className="whitespace-pre-wrap text-sm text-text-primary">
            {insumo.ingredientes_declarados}
          </p>
        </div>
      )}

      {insumo?.advertencias && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Advertencias
          </h4>
          <p className="whitespace-pre-wrap text-sm text-text-primary">{insumo.advertencias}</p>
        </div>
      )}

      {insumo && (
        <AlergenosAgrupados
          contiene={alergenos.contiene}
          puedeContener={alergenos.puedeContener}
          vacio="Sin alérgenos declarados."
          etiqueta={uso.ingrediente_nombre}
        />
      )}
    </section>
  );
}
