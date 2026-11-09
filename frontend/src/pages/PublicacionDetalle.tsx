import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import DeshabilitarPublicacionDialog from "@/components/publicaciones/DeshabilitarPublicacionDialog";
import { EyeIcon, GlobeIcon, ShieldIcon } from "@/components/publicaciones/iconos";
import PublicacionSwitch from "@/components/publicaciones/PublicacionSwitch";
import PublicacionElaboraciones from "@/components/publicaciones/PublicacionElaboraciones";
import { RequisitosFaltantes } from "@/components/publicaciones/Requisitos";
import ProductUnavailable from "@/components/products/ProductUnavailable";
import PublicacionBadge from "@/components/products/PublicacionBadge";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { useAppShell } from "@/hooks/useAppShell";
import { usePublicacionProducto } from "@/hooks/usePublicacionProducto";
import { getProduct } from "@/services/productService";
import type { Product } from "@/types/product";

function parseProductId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Publication of ONE product (HU09): its state and the switch. */
export default function PublicacionDetalle() {
  const navigate = useNavigate();
  const { productoId: rawId } = useParams();
  const productoId = parseProductId(rawId);
  const { handleLogout, producerName, businessName } = useAppShell();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const cargar = useCallback(async (id: number) => {
    setLoading(true);
    setLoadError(false);
    setUnavailable(false);
    try {
      setProduct(await getProduct(id));
    } catch (err) {
      setProduct(null);
      if ((err as { status?: number }).status === 0) setLoadError(true);
      else setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (productoId === null) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    void cargar(productoId);
  }, [cargar, productoId]);

  return (
    <AppShell
      activePage="publicaciones"
      pageTitle={product ? `Publicación de ${product.nombre}` : "Publicación del producto"}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="max-w-6xl space-y-6">
        <Link
          to="/publicaciones"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-strong underline-offset-2 hover:underline"
        >
          <span aria-hidden="true">←</span> Volver a Publicaciones
        </Link>

        {loading && <p className="text-sm text-text-secondary" aria-live="polite">Cargando publicación...</p>}

        {!loading && unavailable && <ProductUnavailable onBack={() => navigate("/publicaciones")} />}

        {!loading && loadError && productoId !== null && (
          <Alert type="error">
            <p>No pudimos cargar el producto. Revisa tu conexión e inténtalo de nuevo.</p>
            <Button type="button" variant="secondary" className="mt-3" onClick={() => void cargar(productoId)}>
              Reintentar
            </Button>
          </Alert>
        )}

        {!loading && product && (
          <Contenido
            product={product}
            onChange={(cambios) => setProduct((actual) => (actual ? { ...actual, ...cambios } : actual))}
            onNotFound={() => setUnavailable(true)}
          />
        )}
      </div>
    </AppShell>
  );
}

function Contenido({
  product,
  onChange,
  onNotFound,
}: {
  product: Product;
  onChange: (cambios: Partial<Product>) => void;
  onNotFound: () => void;
}) {
  const publicacion = usePublicacionProducto({ productoId: product.id, onChange, onNotFound });
  const publicado = product.publicado === true;
  const idPublico = product.id_publico ?? null;
  // The id exists but the server cannot build the link: its public address is not configured.
  const faltaConfiguracion = idPublico !== null && !product.url_publica;
  const listo = product.tiene_formulacion === true && (product.elaboraciones_finalizadas ?? 0) > 0;
  const bloqueado = !publicado && !listo;

  return (
    <>
      <PageHeader
        title={product.nombre}
        description={product.codigo_interno ?? undefined}
        titleSuffix={<PublicacionBadge publicado={publicado} />}
      />

      <section aria-labelledby="publicacion-estado" className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h2 id="publicacion-estado" className="text-sm font-semibold text-text-primary">
            Estado de publicación
          </h2>
          <p className="mt-0.5 text-[13px] text-text-secondary">Controla el acceso a la ficha pública del producto.</p>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden="true"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${publicado ? "bg-success-bg text-success" : "bg-surface text-text-secondary"}`}
              >
                {publicado ? <GlobeIcon /> : <EyeIcon />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">
                  {publicado ? "Visible para consumidores" : "Información no disponible"}
                </p>
                <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-text-secondary">
                  {publicado
                    ? "Quienes escaneen el QR podrán consultar las elaboraciones visibles."
                    : idPublico
                      ? "La publicación está deshabilitada. Quien escanee el QR impreso verá «información no disponible». El enlace del producto no cambia."
                      : "Aún no está publicado. Al habilitar la publicación se genera el código QR permanente del producto."}
                </p>
              </div>
            </div>
            <PublicacionSwitch
              checked={publicado}
              disabled={bloqueado || publicacion.busy}
              label={publicado ? "Deshabilitar publicación" : "Habilitar publicación"}
              title={bloqueado ? "Completa los requisitos para habilitar la publicación" : undefined}
              onChange={(siguiente) => (siguiente ? void publicacion.habilitar() : publicacion.pedirDeshabilitar())}
            />
          </div>

          {faltaConfiguracion && (
            <Alert type="error">
              La dirección pública de TrazApp no está configurada en el servidor, por eso no se puede mostrar el
              enlace del producto ni descargar su QR. Avisa a quien administra el servidor.
            </Alert>
          )}

          {publicacion.faltantes.length > 0 && (
            <RequisitosFaltantes faltantes={publicacion.faltantes} productoId={product.id} />
          )}
          {bloqueado && publicacion.faltantes.length === 0 && (
            <RequisitosFaltantes
              faltantes={[
                ...(product.tiene_formulacion === true ? [] : ["sin_formulacion"]),
                ...((product.elaboraciones_finalizadas ?? 0) > 0 ? [] : ["sin_elaboracion_finalizada"]),
              ]}
              productoId={product.id}
            />
          )}
          {publicacion.error && (
            <Alert type="error">
              <p>{publicacion.error}</p>
            </Alert>
          )}
        </div>
      </section>

      <PublicacionElaboraciones productoId={product.id} />

      <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
        <span aria-hidden="true" className="mt-0.5 text-text-secondary">
          <ShieldIcon />
        </span>
        <div>
          <p className="text-sm font-semibold text-text-primary">La ficha pública no se puede personalizar</p>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
            TrazApp define qué información se muestra y cómo se presenta para asegurar una consulta clara y consistente.
          </p>
        </div>
      </div>

      <DeshabilitarPublicacionDialog
        open={publicacion.confirmando}
        loading={publicacion.busy}
        onConfirm={() => void publicacion.confirmarDeshabilitar()}
        onCancel={publicacion.cancelarDeshabilitar}
      />
    </>
  );
}
