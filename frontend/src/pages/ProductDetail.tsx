import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ElaboracionCreateDialog from "@/components/elaboraciones/ElaboracionCreateDialog";
import AppShell from "@/components/layout/AppShell";
import ComingSoonCard from "@/components/detail/ComingSoonCard";
import DetailHero from "@/components/detail/DetailHero";
import FactTile from "@/components/detail/FactTile";
import { EtiquetaIcon, ProductoIcon, QrIcon, TrazabilidadIcon } from "@/components/detail/icons";
import Badge from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/toastContext";
import ProductDetailSection from "@/components/products/ProductDetailSection";
import ProductElaboracionesSection from "@/components/products/ProductElaboracionesSection";
import ProductFormulationSection from "@/components/products/ProductFormulationSection";
import ProductUnavailable from "@/components/products/ProductUnavailable";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { useAppShell } from "@/hooks/useAppShell";
import { formatProductContent, formatProductPrice } from "@/lib/productListUtils";
import { resolveProductImageUrl } from "@/lib/productImageUpload";
import { getProductFormulation } from "@/services/formulationService";
import { getProduct, deleteProduct } from "@/services/productService";
import { ApiError } from "@/types/auth";
import type { Product, Categoria } from "@/types/product";

const ID_SIN_FORMULACION = "product-sin-formulacion";

function parseProductId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export default function ProductDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: rawId } = useParams();
  const productId = parseProductId(rawId);
  const { handleLogout, producerName, businessName } =
    useAppShell();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const { notify } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formulationVersion, setFormulationVersion] = useState(0);
  // «Nueva elaboración» needs a formulation: true / false / null (not known yet).
  const [tieneFormulacion, setTieneFormulacion] = useState<boolean | null>(null);
  const [elaboracionDialogOpen, setElaboracionDialogOpen] = useState(false);

  const loadProduct = useCallback(async (id: number) => {
    setLoading(true);
    setUnavailable(false);
    try {
      const data = await getProduct(id);
      setProduct(data);
    } catch {
      setProduct(null);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (productId == null) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    void loadProduct(productId);
  }, [loadProduct, productId]);

  useEffect(() => {
    if (productId == null) return;
    let vigente = true;
    getProductFormulation(productId).then(
      (formulacion) => {
        if (vigente) setTieneFormulacion(formulacion.existe);
      },
      () => {
        if (vigente) setTieneFormulacion(null);
      },
    );
    return () => {
      vigente = false;
    };
  }, [productId, formulationVersion]);

  useEffect(() => {
    const state = location.state as {
      productCreated?: boolean;
      productUpdated?: boolean;
      elaboracionEliminada?: boolean;
    } | null;
    if (state?.productCreated) {
      // Coming from "Nuevo producto" (HT06-07). Not an update: going back to the list says nothing.
      notify("Producto creado.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (state?.elaboracionEliminada) {
      notify("Borrador eliminado.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (!state?.productUpdated) return;
    notify("Cambios guardados.");
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, notify]);

  function handleDeleteRequest() {
    if (!product || deleting) return;
    setShowDeleteConfirm(true);
  }

  async function handleDeleteConfirm() {
    if (!product) return;

    setDeleteError("");
    setDeleting(true);
    try {
      await deleteProduct(product.id);
      navigate("/productos", { state: { productDeleted: true } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setUnavailable(true);
        return;
      }
      setDeleteError("No pudimos eliminar el producto. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <AppShell
      activePage="productos"
      pageTitle={product?.nombre ?? "Detalle del producto"}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="max-w-6xl space-y-6">
        {loading && <ProductDetailLoading />}

        {!loading && unavailable && (
          <ProductUnavailable onBack={() => navigate("/productos")} />
        )}

        {!loading && product && (
          <>
            <Breadcrumbs
              items={[{ label: "Productos", to: "/productos" }, { label: product.nombre }]}
            />
            <DetailHero
              kind="Producto"
              icon={<ProductoIcon size={30} />}
              title={product.nombre}
              subtitle={product.codigo_interno ?? "—"}
              badges={
                tieneFormulacion === null ? undefined : (
                  <Badge variant={tieneFormulacion ? "success" : "warning"}>
                    {tieneFormulacion ? "Lista para elaborar" : "Falta la formulación"}
                  </Badge>
                )
              }
              actions={
                <>
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    disabled={tieneFormulacion !== true}
                    aria-describedby={tieneFormulacion === false ? ID_SIN_FORMULACION : undefined}
                    onClick={() => setElaboracionDialogOpen(true)}
                  >
                    Nueva elaboración
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => navigate(`/productos/${product.id}/editar`)}
                  >
                    Editar producto
                  </Button>
                  {/* Maqueta: el código QR del producto es trabajo futuro. */}
                  <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled>
                    <QrIcon size={18} />
                    Ver QR (próximamente)
                  </Button>
                </>
              }
            />
            {deleteError && <Alert type="error">{deleteError}</Alert>}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
              <div className="min-w-0 space-y-6">
                <ProductDetailSection id="product-detail-general" title="Información general">
                  <div className="space-y-4">
                    <ProductMainImage imagenUrl={product.imagen_url} nombre={product.nombre} />
                    <dl className="grid grid-cols-2 gap-3">
                      <DetailField label="Descripción" className="col-span-2">
                        {product.descripcion?.trim() || "—"}
                      </DetailField>
                      <FactTile label="Código interno">{product.codigo_interno ?? "—"}</FactTile>
                      <FactTile label="Contenido neto">
                        {formatProductContent(product.contenido_neto, product.unidad_medida)}
                      </FactTile>
                    </dl>
                  </div>
                </ProductDetailSection>

                <ProductDetailSection id="product-detail-formulation" title="Formulación">
                  <ProductFormulationSection
                    productoId={product.id}
                    onSaved={() => setFormulationVersion((key) => key + 1)}
                  />
                </ProductDetailSection>

                <ProductDetailSection id="product-detail-elaboraciones" title="Elaboraciones">
                  <ProductElaboracionesSection
                    productoId={product.id}
                    refreshKey={formulationVersion}
                    tieneFormulacion={tieneFormulacion}
                    idSinFormulacion={ID_SIN_FORMULACION}
                  />
                </ProductDetailSection>
              </div>

              <aside className="min-w-0 space-y-6">
                <ProductDetailSection id="product-detail-categories" title="Categorías">
                  {product.categorias.length > 0 ? (
                    <CategoryBadges categorias={product.categorias} />
                  ) : (
                    <p className="text-sm text-text-secondary">Sin categorías</p>
                  )}
                </ProductDetailSection>

                <ProductDetailSection id="product-detail-presentation" title="Presentación">
                  <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                    {product.presentacion?.trim() ? product.presentacion : "No especificada"}
                  </p>
                </ProductDetailSection>

                <ProductDetailSection id="product-detail-commercial" title="Información comercial">
                  <dl className="grid grid-cols-2 gap-3">
                    <FactTile label="Costo de producción">
                      {formatProductPrice(product.costo_produccion)}
                    </FactTile>
                    <FactTile label="Precio de venta">
                      {formatProductPrice(product.precio_venta)}
                    </FactTile>
                  </dl>
                </ProductDetailSection>

                <ComingSoonCard
                  id="product-soon-trazabilidad"
                  title="Trazabilidad de ingredientes"
                  description="Verás cuántos ingredientes del producto tienen su información completa."
                  icon={<TrazabilidadIcon size={20} />}
                  rows={1}
                />
                <ComingSoonCard
                  id="product-soon-adicional"
                  title="Información adicional"
                  description="Lote, vigencia y sellos como «Sin TACC» o «Sin conservantes»."
                  icon={<EtiquetaIcon size={20} />}
                  rows={0}
                />

                <section
                  aria-labelledby="product-delete-title"
                  className="bg-card border border-error-border rounded-2xl p-5 sm:p-6"
                >
                  <div className="space-y-3">
                    <div>
                      <h2 id="product-delete-title" className="text-sm font-semibold text-text-primary">
                        Eliminar producto
                      </h2>
                      <p id="product-delete-help" className="text-sm text-text-secondary leading-relaxed mt-1">
                        Al eliminar, el producto dejará de aparecer en tu catálogo. La trazabilidad
                        histórica se conserva.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full sm:w-auto text-error border-error/30 hover:bg-error-bg"
                      onClick={handleDeleteRequest}
                      loading={deleting}
                      disabled={deleting}
                      aria-describedby="product-delete-help"
                    >
                      {deleting ? "Eliminando…" : "Eliminar producto"}
                    </Button>
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>

      {elaboracionDialogOpen && product && (
        <ElaboracionCreateDialog
          productoId={product.id}
          onCreated={(creada) => navigate(`/elaboraciones/${creada.id}/registro`)}
          onCancel={() => setElaboracionDialogOpen(false)}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Eliminar producto"
        description={
          "¿Eliminar este producto?\n\nSe ocultará del catálogo, pero conservaremos su información histórica de trazabilidad."
        }
        confirmLabel="Eliminar producto"
        cancelLabel="Cancelar"
        destructive
        loading={deleting}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => {
          if (!deleting) setShowDeleteConfirm(false);
        }}
      />
    </AppShell>
  );
}

function DetailField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <dt className="text-xs font-medium text-text-secondary">
        {label}
      </dt>
      <dd className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
        {children}
      </dd>
    </div>
  );
}

function ProductDetailLoading() {
  return (
    <div className="space-y-6" aria-live="polite" aria-busy="true">
      <p className="text-sm text-text-secondary">Cargando producto...</p>
      <div className="h-8 w-2/3 rounded-lg bg-card border border-border animate-pulse" />
      <div className="h-48 rounded-xl bg-card border border-border animate-pulse" />
      <div className="h-36 rounded-xl bg-card border border-border animate-pulse" />
      <div className="h-24 rounded-xl bg-card border border-border animate-pulse" />
    </div>
  );
}

function ProductMainImage({
  imagenUrl,
  nombre,
}: {
  imagenUrl: string | null;
  nombre: string;
}) {
  const src = resolveProductImageUrl(imagenUrl);

  // Without an image: a low strip, not a square that pushes the information down.
  if (!src) {
    return (
      <div
        role="img"
        aria-label="Sin imagen principal"
        className="flex h-12 items-center justify-center rounded-xl border border-dashed border-border bg-surface px-4 text-sm text-text-secondary"
      >
        Sin imagen
      </div>
    );
  }

  return (
    <div className="aspect-[16/9] w-full overflow-hidden rounded-xl border border-border bg-surface sm:max-w-sm">
      <img src={src} alt={`Imagen de ${nombre}`} className="h-full w-full object-cover" />
    </div>
  );
}

function CategoryBadges({ categorias }: { categorias: Categoria[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categorias.map((categoria) => (
        <span
          key={categoria.id}
          className="inline-flex items-center rounded-full bg-brand-50 text-accent-strong border border-brand-100 px-3 py-1 text-sm font-medium"
        >
          {categoria.nombre}
        </span>
      ))}
    </div>
  );
}
