import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import InsumoAllergensSection from "@/components/insumos/InsumoAllergensSection";
import OrigenInformacion from "@/components/insumos/OrigenInformacion";
import InsumoUnavailable from "@/components/insumos/InsumoUnavailable";
import AppShell from "@/components/layout/AppShell";
import ProductDetailSection from "@/components/products/ProductDetailSection";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ComingSoonCard from "@/components/detail/ComingSoonCard";
import DetailHero from "@/components/detail/DetailHero";
import FactTile from "@/components/detail/FactTile";
import { HistorialIcon, InsumoIcon } from "@/components/detail/icons";
import { Breadcrumbs } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/toastContext";
import { useAppShell } from "@/hooks/useAppShell";
import { deactivateInsumo, getInsumo, reactivateInsumo } from "@/services/insumoService";
import type { Insumo } from "@/types/insumo";

function parseInsumoId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export default function InsumoDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: rawId } = useParams();
  const insumoId = parseInsumoId(rawId);
  const { handleLogout, producerName, businessName } = useAppShell();
  const { notify } = useToast();

  const [insumo, setInsumo] = useState<Insumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [actionError, setActionError] = useState("");
  const [working, setWorking] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  const loadInsumo = useCallback(async (id: number) => {
    setLoading(true);
    setUnavailable(false);
    try {
      setInsumo(await getInsumo(id));
    } catch {
      setInsumo(null);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (insumoId == null) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    void loadInsumo(insumoId);
  }, [insumoId, loadInsumo]);

  useEffect(() => {
    const state = location.state as {
      insumoUpdated?: boolean;
      insumoReactivated?: boolean;
    } | null;
    if (state?.insumoUpdated) notify("Cambios guardados.");
    else if (state?.insumoReactivated) notify("Insumo reactivado.");
    else return;
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, notify]);

  async function handleDeactivate() {
    if (!insumo) return;
    setActionError("");
    setWorking(true);
    try {
      await deactivateInsumo(insumo.id);
      setInsumo(await getInsumo(insumo.id));
      notify("Insumo desactivado.");
    } catch {
      setActionError("No pudimos desactivar el insumo. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setWorking(false);
      setShowDeactivateConfirm(false);
    }
  }

  async function handleReactivate() {
    if (!insumo) return;
    setActionError("");
    setWorking(true);
    try {
      setInsumo(await reactivateInsumo(insumo.id));
      notify("Insumo reactivado.");
    } catch {
      setActionError("No pudimos reactivar el insumo. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <AppShell
      activePage="insumos"
      pageTitle={insumo?.nombre ?? "Detalle del insumo"}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="max-w-6xl space-y-6">
        {loading && <p className="text-sm text-text-secondary">Cargando insumo...</p>}

        {!loading && unavailable && <InsumoUnavailable onBack={() => navigate("/insumos")} />}

        {!loading && insumo && (
          <>
            <Breadcrumbs items={[{ label: "Insumos", to: "/insumos" }, { label: insumo.nombre }]} />
            <DetailHero
              kind="Insumo"
              icon={<InsumoIcon size={30} />}
              title={insumo.nombre}
              subtitle={insumo.marca_origen}
              badges={
                <>
                  <Badge variant={insumo.activo ? "success" : "neutral"}>
                    {insumo.activo ? "Activo" : "Inactivo"}
                  </Badge>
                  {insumo.habitual && <Badge variant="brand">Habitual</Badge>}
                </>
              }
              actions={
                insumo.activo ? (
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={() => navigate(`/insumos/${insumo.id}/editar`)}
                  >
                    Editar insumo
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={() => void handleReactivate()}
                    loading={working}
                  >
                    Reactivar insumo
                  </Button>
                )
              }
            />

            {actionError && <Alert type="error">{actionError}</Alert>}

            {!insumo.activo && (
              <p
                role="status"
                className="rounded-xl border border-warning-border bg-warning-bg px-4 py-3 text-sm font-medium text-warning"
              >
                Este insumo está desactivado y no se ofrecerá en nuevas elaboraciones.
              </p>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
              <div className="min-w-0 space-y-6">
                <ProductDetailSection id="insumo-detail-general" title="Información general">
                  <dl className="grid grid-cols-2 gap-3">
                    <FactTile label="Marca u origen">{insumo.marca_origen}</FactTile>
                    <FactTile label="Presentación">{insumo.presentacion ?? "—"}</FactTile>
                    <FactTile label="Código de barras">
                      <span className="tabular-nums">{insumo.codigo_barras ?? "—"}</span>
                    </FactTile>
                    <FactTile label="Insumo habitual">
                      {insumo.habitual ? "Sí, se preselecciona en las elaboraciones" : "No"}
                    </FactTile>
                    <div className="col-span-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-1">
                      <dt className="pt-2 text-xs font-medium text-text-secondary">Ingrediente</dt>
                      <dd>
                        <Link
                          to={`/ingredientes/${insumo.ingrediente.id}`}
                          className="inline-flex min-h-11 items-center gap-1 text-base font-medium text-accent-strong underline-offset-2 hover:underline"
                        >
                          {insumo.ingrediente.nombre}
                        </Link>
                      </dd>
                    </div>
                  </dl>
                </ProductDetailSection>

                <ProductDetailSection id="insumo-detail-alergenos" title="Alérgenos declarados">
                  <InsumoAllergensSection insumoId={insumo.id} revisado={insumo.alergenos_revisados} />
                </ProductDetailSection>

                <ProductDetailSection id="insumo-detail-declarado" title="Información declarada">
                  <dl className="grid grid-cols-1 gap-3">
                    <FactTile label="Ingredientes declarados">
                      {insumo.ingredientes_declarados ?? "—"}
                    </FactTile>
                    <FactTile label="Advertencias">{insumo.advertencias ?? "—"}</FactTile>
                  </dl>
                </ProductDetailSection>
              </div>

              <aside className="min-w-0 space-y-6">
                <ProductDetailSection id="insumo-detail-origen" title="Origen de la información">
                  <OrigenInformacion
                    fuente={insumo.fuente}
                    fechaRecuperacion={insumo.fecha_recuperacion}
                    ficha={insumo.ficha}
                  />
                </ProductDetailSection>

                <ComingSoonCard
                  id="insumo-soon-uso"
                  title="Uso reciente en elaboraciones"
                  description="Verás las elaboraciones donde se usó este insumo y con qué lote."
                  icon={<HistorialIcon size={20} />}
                />

                {insumo.activo && (
                  <section
                    aria-label="Desactivar insumo"
                    className="rounded-2xl border border-error-border bg-card p-5 sm:p-6"
                  >
                    <div className="space-y-3">
                      <div>
                        <h2 className="text-sm font-semibold text-text-primary">Desactivar insumo</h2>
                        <p className="mt-1 text-sm text-text-secondary">
                          Un insumo desactivado no se ofrece en nuevas elaboraciones. Podrás
                          reactivarlo cuando quieras y las elaboraciones ya registradas no cambian.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full border-error/30 text-error hover:bg-error-bg sm:w-auto"
                        onClick={() => setShowDeactivateConfirm(true)}
                        loading={working}
                      >
                        Desactivar insumo
                      </Button>
                    </div>
                  </section>
                )}
              </aside>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={showDeactivateConfirm}
        title="Desactivar insumo"
        description="¿Desactivar este insumo? No se ofrecerá en nuevas elaboraciones y, si es el habitual de su ingrediente, perderá esa marca."
        confirmLabel="Desactivar insumo"
        cancelLabel="Cancelar"
        destructive
        loading={working}
        onConfirm={() => void handleDeactivate()}
        onCancel={() => {
          if (!working) setShowDeactivateConfirm(false);
        }}
      />
    </AppShell>
  );
}
