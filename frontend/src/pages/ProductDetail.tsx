import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import ProductDetailSection from "@/components/products/ProductDetailSection";
import ProductUnavailable from "@/components/products/ProductUnavailable";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { useAppShell } from "@/hooks/useAppShell";
import { formatProductContent, formatProductMoney } from "@/lib/productListUtils";
import { resolveProductImageUrl } from "@/lib/productImageUpload";
import { getProduct, deleteProduct } from "@/services/productService";
import { ApiError } from "@/types/auth";
import type { Product, Categoria } from "@/types/product";

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
  const { handleLogout, handleNavigate, producerName, businessName } =
    useAppShell();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
    const state = location.state as { productUpdated?: boolean } | null;
    if (!state?.productUpdated) return;
    setSuccessMessage("Producto actualizado correctamente.");
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  async function handleDelete() {
    if (!product) return;

    const confirmed = window.confirm(
      "¿Eliminar este producto?\n\nSe ocultará del catálogo, pero conservaremos su información histórica de trazabilidad.",
    );
    if (!confirmed) return;

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
      setDeleteError("No pudimos eliminar el producto. Inténtalo nuevamente.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell
      activePage="productos"
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="max-w-2xl space-y-6">
        {loading && <ProductDetailLoading />}

        {!loading && unavailable && (
          <ProductUnavailable onBack={() => navigate("/productos")} />
        )}

        {!loading && product && (
          <>
            <header className="space-y-2">
              <p className="text-sm text-brand-600 font-medium">
                Productos / {product.nombre}
              </p>
              <h1 className="text-2xl font-semibold text-text-primary">
                {product.nombre}
              </h1>
              <p className="text-sm font-medium text-text-secondary tracking-wide">
                {product.codigo_interno ?? "—"}
              </p>
            </header>

            {successMessage && <Alert type="success">{successMessage}</Alert>}
            {deleteError && <Alert type="error">{deleteError}</Alert>}

            <ProductDetailSection id="product-detail-image" title="Imagen principal">
              <ProductMainImage
                imagenUrl={product.imagen_url}
                nombre={product.nombre}
              />
            </ProductDetailSection>

            <ProductDetailSection
              id="product-detail-general"
              title="Información general"
            >
              <dl className="grid grid-cols-1 gap-4 sm:gap-5">
                <DetailField label="Código interno">
                  {product.codigo_interno ?? "—"}
                </DetailField>
                <DetailField label="Descripción">
                  {product.descripcion?.trim() || "—"}
                </DetailField>
                <DetailField label="Contenido neto">
                  {formatProductContent(
                    product.contenido_neto,
                    product.unidad_medida,
                  )}
                </DetailField>
              </dl>
            </ProductDetailSection>

            <ProductDetailSection
              id="product-detail-presentation"
              title="Presentación"
            >
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                {product.presentacion?.trim()
                  ? product.presentacion
                  : "No especificada"}
              </p>
            </ProductDetailSection>

            <ProductDetailSection
              id="product-detail-categories"
              title="Categorías"
            >
              {product.categorias.length > 0 ? (
                <CategoryBadges categorias={product.categorias} />
              ) : (
                <p className="text-sm text-text-secondary">Sin categorías</p>
              )}
            </ProductDetailSection>

            <ProductDetailSection
              id="product-detail-commercial"
              title="Información comercial"
            >
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <DetailField label="Costo de producción">
                  {formatProductMoney(product.costo_produccion)}
                </DetailField>
                <DetailField label="Precio de venta">
                  {formatProductMoney(product.precio_venta)}
                </DetailField>
              </dl>
            </ProductDetailSection>

            <section
              aria-label="Acciones del producto"
              className="bg-card border border-border rounded-xl p-5 sm:p-6 space-y-4"
            >
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                Acciones
              </h2>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => navigate("/productos")}
                >
                  Volver a productos
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => navigate(`/productos/${product.id}/editar`)}
                >
                  Editar producto
                </Button>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-text-primary">
                    Eliminar producto
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed mt-1">
                    Al eliminar, el producto dejará de aparecer en tu catálogo.
                    La información histórica de trazabilidad se conservará.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto text-error border-error/30 hover:bg-error-bg"
                  onClick={() => void handleDelete()}
                  loading={deleting}
                  disabled={deleting}
                  aria-describedby="product-delete-help"
                >
                  {deleting ? "Eliminando…" : "Eliminar producto"}
                </Button>
                <p id="product-delete-help" className="sr-only">
                  Acción irreversible para el catálogo. La trazabilidad histórica
                  se mantiene.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-text-secondary uppercase tracking-wide">
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

  return (
    <div className="w-full max-w-xs">
      <div className="aspect-square rounded-xl border border-border bg-surface overflow-hidden flex items-center justify-center">
        {src ? (
          <img
            src={src}
            alt={`Imagen de ${nombre}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="text-center px-4 text-sm text-text-secondary">
            Sin imagen principal
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryBadges({ categorias }: { categorias: Categoria[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categorias.map((categoria) => (
        <span
          key={categoria.id}
          className="inline-flex items-center rounded-full bg-brand-50 text-brand-700 border border-brand-100 px-2.5 py-0.5 text-xs font-medium"
        >
          {categoria.nombre}
        </span>
      ))}
    </div>
  );
}
