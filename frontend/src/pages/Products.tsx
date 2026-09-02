import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAppShell } from "@/hooks/useAppShell";
import {
  filterAndSortProducts,
  formatCategoriasCompact,
  formatPresentacion,
  formatProductContent,
  hasActiveFilters,
  productCountLabel,
} from "@/lib/productListUtils";
import { resolveProductImageUrl } from "@/lib/productImageUpload";
import { listProducts } from "@/services/productService";
import {
  DEFAULT_PRODUCT_LIST_FILTERS,
  PRODUCT_SORT_OPTIONS,
  PRODUCT_UNIT_OPTIONS,
  type Product,
  type ProductListFilters,
} from "@/types/product";

export default function Products() {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleLogout, handleNavigate, producerName, businessName } =
    useAppShell();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [filters, setFilters] = useState<ProductListFilters>(
    DEFAULT_PRODUCT_LIST_FILTERS,
  );

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listProducts();
      setProducts(data);
    } catch {
      setError("No pudimos cargar tus productos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const state = location.state as {
      productCreated?: boolean;
      productDeleted?: boolean;
      productUpdated?: boolean;
    } | null;
    if (state?.productCreated) {
      setSuccessMessage("Producto creado correctamente.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (state?.productDeleted) {
      setSuccessMessage("Producto eliminado correctamente.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (state?.productUpdated) {
      setSuccessMessage("Producto actualizado correctamente.");
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const filteredProducts = useMemo(
    () => filterAndSortProducts(products, filters),
    [products, filters],
  );

  const totalCount = products.length;
  const showEmptyState = !loading && !error && totalCount === 0;
  const showNoResults =
    !loading && !error && totalCount > 0 && filteredProducts.length === 0;
  const showList =
    !loading && !error && totalCount > 0 && filteredProducts.length > 0;

  function clearFilters() {
    setFilters(DEFAULT_PRODUCT_LIST_FILTERS);
  }

  function goToNewProduct() {
    navigate("/productos/nuevo");
  }

  function goToProduct(id: number) {
    navigate(`/productos/${id}`);
  }

  return (
    <AppShell
      activePage="productos"
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-brand-600 font-medium mb-1">Catálogo</p>
            <h1 className="text-2xl font-semibold text-text-primary mb-1.5">
              Productos
            </h1>
            <p className="text-text-secondary text-sm leading-relaxed">
              Administra los productos de tu negocio.
            </p>
            {!loading && !error && (
              <p className="text-sm text-text-secondary mt-2">
                {productCountLabel(totalCount)}
              </p>
            )}
          </div>
          <Button
            type="button"
            className="w-full sm:w-auto shrink-0"
            onClick={goToNewProduct}
          >
            + Nuevo producto
          </Button>
        </header>

        {successMessage && <Alert type="success">{successMessage}</Alert>}

        {!showEmptyState && !error && (
          <ProductListControls
            filters={filters}
            onChange={setFilters}
            disabled={loading}
            resultCount={filteredProducts.length}
            showResultCount={showList || showNoResults}
          />
        )}

        {loading && <ProductsLoadingSkeleton />}

        {!loading && error && (
          <ErrorState message={error} onRetry={() => void loadProducts()} />
        )}

        {showEmptyState && (
          <EmptyState onCreate={goToNewProduct} />
        )}

        {showNoResults && (
          <NoResultsState onClear={clearFilters} />
        )}

        {showList && (
          <>
            <ProductsTable
              products={filteredProducts}
              onSelect={goToProduct}
            />
            <ProductsCards
              products={filteredProducts}
              onSelect={goToProduct}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}

function ProductListControls({
  filters,
  onChange,
  disabled,
  resultCount,
  showResultCount,
}: {
  filters: ProductListFilters;
  onChange: (filters: ProductListFilters) => void;
  disabled: boolean;
  resultCount: number;
  showResultCount: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <Input
        label="Buscar"
        type="search"
        placeholder="Buscar por nombre o código..."
        value={filters.search}
        onChange={(e) =>
          onChange({ ...filters, search: e.target.value })
        }
        disabled={disabled}
        aria-label="Buscar por nombre o código"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-primary">Unidad</span>
          <select
            value={filters.unit}
            onChange={(e) =>
              onChange({
                ...filters,
                unit: e.target.value as ProductListFilters["unit"],
              })
            }
            disabled={disabled}
            className="w-full rounded-lg border border-border bg-card text-sm text-text-primary px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent disabled:opacity-50"
            aria-label="Filtrar por unidad de medida"
          >
            {PRODUCT_UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label === "Todas"
                  ? "Todas"
                  : option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-primary">Ordenar</span>
          <select
            value={filters.sort}
            onChange={(e) =>
              onChange({
                ...filters,
                sort: e.target.value as ProductListFilters["sort"],
              })
            }
            disabled={disabled}
            className="w-full rounded-lg border border-border bg-card text-sm text-text-primary px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent disabled:opacity-50"
            aria-label="Ordenar productos"
          >
            {PRODUCT_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {showResultCount && hasActiveFilters(filters) && (
        <p className="text-xs text-text-secondary">
          Mostrando {resultCount} resultado{resultCount === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

function ProductsTable({
  products,
  onSelect,
}: {
  products: Product[];
  onSelect: (id: number) => void;
}) {
  return (
    <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface/60">
            <th className="text-left font-semibold text-text-secondary px-4 py-3">
              Producto
            </th>
            <th className="text-left font-semibold text-text-secondary px-4 py-3">
              Contenido
            </th>
            <th className="text-left font-semibold text-text-secondary px-4 py-3">
              Presentación
            </th>
            <th className="text-right font-semibold text-text-secondary px-4 py-3">
              Acción
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              onSelect={() => onSelect(product.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductRow({
  product,
  onSelect,
}: {
  product: Product;
  onSelect: () => void;
}) {
  return (
    <tr
      className="border-b border-border last:border-b-0 hover:bg-brand-50/40 transition-colors cursor-pointer focus-within:bg-brand-50/40"
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`Ver producto ${product.nombre}`}
    >
      <td className="px-4 py-3 text-text-primary">
        <div className="flex items-center gap-3 min-w-0">
          <ProductListThumbnail
            imagenUrl={product.imagen_url}
            nombre={product.nombre}
          />
          <div className="space-y-0.5 min-w-0">
            <p className="font-medium truncate">{product.nombre}</p>
            <p className="text-xs text-text-secondary truncate">
              {product.codigo_interno ?? "—"}
            </p>
            {formatCategoriasCompact(product.categorias) ? (
              <p className="text-xs text-text-secondary truncate">
                {formatCategoriasCompact(product.categorias)}
              </p>
            ) : (
              <p className="text-xs text-text-muted">Sin categorías</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-text-secondary">
        {formatProductContent(product.contenido_neto, product.unidad_medida)}
      </td>
      <td className="px-4 py-3 text-text-secondary">
        {formatPresentacion(product.presentacion)}
      </td>
      <td className="px-4 py-3 text-right">
        <span className="inline-flex items-center gap-1 text-brand-600 font-medium">
          Ver
          <ArrowRightIcon />
        </span>
      </td>
    </tr>
  );
}

function ProductsCards({
  products,
  onSelect,
}: {
  products: Product[];
  onSelect: (id: number) => void;
}) {
  return (
    <div className="md:hidden space-y-3">
      {products.map((product) => (
        <article
          key={product.id}
          className="bg-card border border-border rounded-xl p-4 hover:border-brand-600 hover:shadow-sm transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          onClick={() => onSelect(product.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(product.id);
            }
          }}
          tabIndex={0}
          role="link"
          aria-label={`Ver producto ${product.nombre}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <ProductListThumbnail
                imagenUrl={product.imagen_url}
                nombre={product.nombre}
              />
              <div className="min-w-0 space-y-0.5">
                <h2 className="text-sm font-semibold text-text-primary truncate">
                  {product.nombre}
                </h2>
                <p className="text-xs font-medium text-brand-600 uppercase tracking-wide">
                  {product.codigo_interno ?? "—"}
                </p>
                {formatCategoriasCompact(product.categorias) ? (
                  <p className="text-xs text-text-secondary">
                    {formatCategoriasCompact(product.categorias)}
                  </p>
                ) : (
                  <p className="text-xs text-text-muted">Sin categorías</p>
                )}
                <p className="text-sm text-text-secondary">
                  {formatProductContent(
                    product.contenido_neto,
                    product.unidad_medida,
                  )}
                </p>
                <p className="text-xs text-text-secondary">
                  {formatPresentacion(product.presentacion)}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 shrink-0">
              Ver
              <ArrowRightIcon />
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProductsLoadingSkeleton() {
  return (
    <div className="space-y-3" aria-live="polite" aria-busy="true">
      <p className="text-sm text-text-secondary">Cargando productos...</p>
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-16 rounded-xl border border-border bg-card animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-8 sm:p-10 text-center">
      <h2 className="text-lg font-semibold text-text-primary mb-2">
        Aún no tienes productos
      </h2>
      <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-md mx-auto">
        Registra tu primer producto para comenzar a organizar su información
        de trazabilidad.
      </p>
      <Button type="button" onClick={onCreate}>
        Registrar primer producto
      </Button>
    </div>
  );
}

function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-8 text-center">
      <h2 className="text-lg font-semibold text-text-primary mb-2">
        No encontramos productos
      </h2>
      <p className="text-sm text-text-secondary leading-relaxed mb-6">
        No hay productos que coincidan con la búsqueda o los filtros
        seleccionados.
      </p>
      <Button type="button" variant="secondary" onClick={onClear}>
        Limpiar filtros
      </Button>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-8 text-center">
      <h2 className="text-lg font-semibold text-text-primary mb-2">
        {message}
      </h2>
      <p className="text-sm text-text-secondary mb-6">
        Verifica tu conexión e inténtalo nuevamente.
      </p>
      <Button type="button" variant="secondary" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}

function ProductListThumbnail({
  imagenUrl,
  nombre,
}: {
  imagenUrl: string | null;
  nombre: string;
}) {
  const src = resolveProductImageUrl(imagenUrl);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="h-10 w-10 shrink-0 rounded-md border border-border object-cover bg-surface"
        loading="lazy"
      />
    );
  }

  return (
    <div
      className="h-10 w-10 shrink-0 rounded-md border border-dashed border-border bg-surface flex items-center justify-center"
      aria-hidden="true"
      title={`Sin imagen de ${nombre}`}
    >
      <ProductPlaceholderIcon />
    </div>
  );
}

function ProductPlaceholderIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-muted"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
