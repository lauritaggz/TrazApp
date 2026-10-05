import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import InsumoAllergensSection from "@/components/insumos/InsumoAllergensSection";
import InsumoUnavailable from "@/components/insumos/InsumoUnavailable";
import AppShell from "@/components/layout/AppShell";
import ProductDetailSection from "@/components/products/ProductDetailSection";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/toastContext";
import { useAppShell } from "@/hooks/useAppShell";
import { formatFechaHora, formatFuente } from "@/lib/insumoUtils";
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
    if (state?.insumoUpdated) notify("Insumo actualizado correctamente.");
    else if (state?.insumoReactivated) notify("Insumo reactivado correctamente.");
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
      notify("Insumo desactivado correctamente.");
    } catch {
      setActionError("No pudimos desactivar el insumo. Inténtalo nuevamente.");
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
      notify("Insumo reactivado correctamente.");
    } catch {
      setActionError("No pudimos reactivar el insumo. Inténtalo nuevamente.");
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
      <div className="max-w-3xl space-y-6">
        {loading && <p className="text-sm text-text-secondary">Cargando insumo...</p>}

        {!loading && unavailable && <InsumoUnavailable onBack={() => navigate("/insumos")} />}

        {!loading && insumo && (
          <>
            <PageHeader
              title={insumo.nombre}
              description={insumo.marca_origen}
              titleSuffix={
                <>
                  <Badge variant={insumo.activo ? "success" : "neutral"}>
                    {insumo.activo ? "Activo" : "Inactivo"}
                  </Badge>
                  {insumo.habitual && <Badge variant="brand">Habitual</Badge>}
                </>
              }
              breadcrumbs={[{ label: "Insumos", to: "/insumos" }, { label: insumo.nombre }]}
              actions={
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => navigate("/insumos")}
                  >
                    Volver a insumos
                  </Button>
                  {insumo.activo ? (
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
                  )}
                </>
              }
            />

            {actionError && <Alert type="error">{actionError}</Alert>}

            {!insumo.activo && (
              <p
                role="status"
                className="rounded-lg border border-warning-border bg-warning-bg px-3.5 py-3 text-sm font-medium text-warning"
              >
                Este insumo está desactivado y no se ofrecerá en nuevas elaboraciones.
              </p>
            )}

            <ProductDetailSection id="insumo-detail-general" title="Información general">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailField label="Marca u origen">{insumo.marca_origen}</DetailField>
                <DetailField label="Ingrediente">
                  <Link
                    to={`/ingredientes/${insumo.ingrediente.id}`}
                    className="font-medium text-accent-strong underline-offset-2 hover:underline"
                  >
                    {insumo.ingrediente.nombre}
                  </Link>
                </DetailField>
                <DetailField label="Presentación">{insumo.presentacion ?? "—"}</DetailField>
                <DetailField label="Código de barras">
                  <span className="tabular-nums">{insumo.codigo_barras ?? "—"}</span>
                </DetailField>
                <DetailField label="Insumo habitual">
                  {insumo.habitual ? "Sí, se preselecciona en las elaboraciones" : "No"}
                </DetailField>
              </dl>
            </ProductDetailSection>

            <ProductDetailSection id="insumo-detail-declarado" title="Información declarada">
              <dl className="grid grid-cols-1 gap-4">
                <DetailField label="Ingredientes declarados">
                  {insumo.ingredientes_declarados ?? "—"}
                </DetailField>
                <DetailField label="Advertencias">{insumo.advertencias ?? "—"}</DetailField>
              </dl>
            </ProductDetailSection>

            <ProductDetailSection id="insumo-detail-origen" title="Estado y fuente">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailField label="Estado">
                  <Badge variant={insumo.activo ? "success" : "neutral"}>
                    {insumo.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </DetailField>
                <DetailField label="Fuente de la información">
                  {formatFuente(insumo.fuente)}
                </DetailField>
                {insumo.fecha_recuperacion && (
                  <DetailField label="Recuperado el">
                    {formatFechaHora(insumo.fecha_recuperacion)}
                  </DetailField>
                )}
              </dl>
            </ProductDetailSection>

            <ProductDetailSection id="insumo-detail-alergenos" title="Alérgenos declarados">
              <InsumoAllergensSection insumoId={insumo.id} />
            </ProductDetailSection>

            {insumo.activo && (
              <section
                aria-label="Desactivar insumo"
                className="rounded-xl border border-error-border bg-card p-5 sm:p-6"
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
                    className="border-error/30 text-error hover:bg-error-bg"
                    onClick={() => setShowDeactivateConfirm(true)}
                    loading={working}
                  >
                    Desactivar insumo
                  </Button>
                </div>
              </section>
            )}
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

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm text-text-primary">{children}</dd>
    </div>
  );
}
