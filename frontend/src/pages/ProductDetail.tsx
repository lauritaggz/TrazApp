import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import ProductUnavailable from "@/components/products/ProductUnavailable";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { useAppShell } from "@/hooks/useAppShell";
import { formatProductContent } from "@/lib/productListUtils";
import { getProduct } from "@/services/productService";
import type { Product } from "@/types/product";

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

            <section
              className="bg-card border border-border rounded-xl p-5 sm:p-6 space-y-5"
              aria-labelledby="product-general-info"
            >
              <h2
                id="product-general-info"
                className="text-sm font-semibold text-text-primary uppercase tracking-wide"
              >
                Información general
              </h2>

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
                <DetailField label="Presentación">
                  {product.presentacion?.trim()
                    ? product.presentacion
                    : "No especificada"}
                </DetailField>
              </dl>
            </section>

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
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <p className="text-sm text-text-secondary">Cargando producto...</p>
      <div className="h-8 w-2/3 rounded-lg bg-card border border-border animate-pulse" />
      <div className="h-40 rounded-xl bg-card border border-border animate-pulse" />
    </div>
  );
}
