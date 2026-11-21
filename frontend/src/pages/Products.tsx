import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/toastContext";
import Button from "@/components/ui/Button";
import { AvisoLista, FlechaFila } from "@/components/ui/ListaPiezas";
import EmptyStateCard from "@/components/ui/EmptyStateCard";
import ListToolbar, { type FilterChip } from "@/components/ui/ListToolbar";
import PublicacionBadge from "@/components/products/PublicacionBadge";
import ProductsGrid from "@/components/products/ProductsGrid";
import PageHeader from "@/components/ui/PageHeader";
import ViewToggle from "@/components/ui/ViewToggle";
import Select from "@/components/ui/Select";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAppShell } from "@/hooks/useAppShell";
import { useStoredView } from "@/hooks/useStoredView";
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
  const { handleLogout, producerName, businessName } =
    useAppShell();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { notify } = useToast();
  const [view, setView] = useStoredView();
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
      notify("Producto creado.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (state?.productDeleted) {
      notify("Producto eliminado.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (state?.productUpdated) {
      notify("Cambios guardados.");
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate, notify]);

  const deferredSearch = useDeferredValue(filters.search);
  const filteredProducts = useMemo(
    () => filterAndSortProducts(products, { ...filters, search: deferredSearch }),
    [products, filters, deferredSearch],
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
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="w-full space-y-6">
        <PageHeader
          title="Productos"
          description={
            <>
              Administra los productos de tu negocio.
              {!loading && !error && (
                <span className="mt-2 block">{productCountLabel(totalCount)}</span>
              )}
            </>
          }
          actions={
            <Button
              type="button"
              className="w-full sm:w-auto shrink-0"
              onClick={goToNewProduct}
            >
              + Nuevo producto
            </Button>
          }
        />

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
          <div className="flex justify-end">
            <ViewToggle
              label="Vista del listado"
              value={view}
              onChange={setView}
              options={[
                { value: "lista", label: "Lista" },
                { value: "cuadricula", label: "Cuadrícula" },
              ]}
            />
          </div>
        )}

        {showList && view === "cuadricula" && (
          <ProductsGrid products={filteredProducts} />
        )}

        {showList && view === "lista" && (
          <>
            <ProductsTable
              products={filteredProducts}
              onSelect={goToProduct}
            />
            <ProductsCards
              products={filteredProducts}
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
  const unitLabel =
    PRODUCT_UNIT_OPTIONS.find((option) => option.value === filters.unit)?.label ??
    filters.unit;
  const sortLabel =
    PRODUCT_SORT_OPTIONS.find((option) => option.value === filters.sort)?.label ??
    filters.sort;

  const chips: FilterChip[] = [];
  if (filters.search.trim()) {
    chips.push({
      key: "search",
      label: `Búsqueda: «${filters.search.trim()}»`,
      onRemove: () => onChange({ ...filters, search: "" }),
    });
  }
  if (filters.unit !== "all") {
    chips.push({
      key: "unit",
      label: `Unidad: ${unitLabel}`,
      onRemove: () => onChange({ ...filters, unit: "all" }),
    });
  }
  if (filters.sort !== "recent") {
    chips.push({
      key: "sort",
      label: `Orden: ${sortLabel}`,
      onRemove: () => onChange({ ...filters, sort: "recent" }),
    });
  }

  return (
    <ListToolbar
      search={filters.search}
      onSearchChange={(search) => onChange({ ...filters, search })}
      searchLabel="Buscar por nombre o código"
      searchPlaceholder="Buscar por nombre o código..."
      disabled={disabled}
      chips={chips}
      onClearAll={() => onChange(DEFAULT_PRODUCT_LIST_FILTERS)}
      status={
        showResultCount && hasActiveFilters(filters)
          ? `Mostrando ${resultCount} resultado${resultCount === 1 ? "" : "s"}`
          : undefined
      }
      controls={
        <>
          <Select
            label="Unidad"
            value={filters.unit}
            onChange={(e) =>
              onChange({
                ...filters,
                unit: e.target.value as ProductListFilters["unit"],
              })
            }
            disabled={disabled}
            aria-label="Filtrar por unidad de medida"
          >
            {PRODUCT_UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            label="Ordenar"
            value={filters.sort}
            onChange={(e) =>
              onChange({
                ...filters,
                sort: e.target.value as ProductListFilters["sort"],
              })
            }
            disabled={disabled}
            aria-label="Ordenar productos"
          >
            {PRODUCT_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </>
      }
    />
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
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[40rem] table-auto text-sm">
          <thead>
            <tr className="border-b border-border bg-panel/70">
              <th className="px-4 py-3 text-left text-[13px] font-semibold text-text-muted">
                Producto
              </th>
              <th className="px-4 py-3 text-left text-[13px] font-semibold text-text-muted">
                Contenido
              </th>
              <th className="px-4 py-3 text-left text-[13px] font-semibold text-text-muted">
                Presentación
              </th>
              <th className="w-12 px-4 py-3 text-right">
                <span className="sr-only">Acción</span>
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
      className="group cursor-pointer border-b border-border-soft transition-colors duration-150 last:border-b-0 hover:bg-panel/60 focus-within:bg-panel/60"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a")) onSelect();
      }}
    >
      <td className="px-4 py-3 text-text-primary">
        <div className="flex items-center gap-3 min-w-0">
          <ProductListThumbnail
            imagenUrl={product.imagen_url}
            nombre={product.nombre}
          />
          <div className="space-y-0.5 min-w-0">
            <p className="truncate">
              <Link
                to={`/productos/${product.id}`}
                aria-label={`Ver producto ${product.nombre}`}
                className="inline-flex min-h-11 items-center rounded text-[15px] font-semibold text-text-primary hover:text-accent-strong hover:underline underline-offset-2"
              >
                {product.nombre}
              </Link>
            </p>
            <p className="text-[13px] text-text-secondary truncate">
              {product.codigo_interno ?? "—"}
            </p>
            <PublicacionBadge publicado={product.publicado} />
            {formatCategoriasCompact(product.categorias) ? (
              <p className="text-[13px] text-text-secondary truncate">
                {formatCategoriasCompact(product.categorias)}
              </p>
            ) : (
              <p className="text-[13px] text-text-muted">Sin categorías</p>
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
        <span aria-hidden="true">
          <FlechaFila />
        </span>
      </td>
    </tr>
  );
}

function ProductsCards({ products }: { products: Product[] }) {
  return (
    <div className="md:hidden space-y-3">
      {products.map((product) => (
        <article
          key={product.id}
          className="group relative rounded-2xl border border-border bg-card p-4 transition-[border-color,transform] duration-150 active:scale-[0.99] hover:border-wheat-deep focus-within:ring-2 focus-within:ring-accent"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <ProductListThumbnail
                imagenUrl={product.imagen_url}
                nombre={product.nombre}
              />
              <div className="min-w-0 space-y-0.5">
                <h2 className="truncate text-[15px] font-semibold text-text-primary">
                  <Link
                    to={`/productos/${product.id}`}
                    aria-label={`Ver producto ${product.nombre}`}
                    className="inline-flex min-h-11 items-center after:absolute after:inset-0 focus:outline-none"
                  >
                    {product.nombre}
                  </Link>
                </h2>
                <p className="text-[13px] tabular-nums text-text-secondary">
                  {product.codigo_interno ?? "—"}
                </p>
                <PublicacionBadge publicado={product.publicado} />
                {formatCategoriasCompact(product.categorias) ? (
                  <p className="text-[13px] text-text-secondary">
                    {formatCategoriasCompact(product.categorias)}
                  </p>
                ) : (
                  <p className="text-[13px] text-text-muted">Sin categorías</p>
                )}
                <p className="text-sm text-text-secondary">
                  {formatProductContent(
                    product.contenido_neto,
                    product.unidad_medida,
                  )}
                </p>
                <p className="text-[13px] text-text-secondary">
                  {formatPresentacion(product.presentacion)}
                </p>
              </div>
            </div>
            <span aria-hidden="true" className="mt-3 shrink-0">
              <FlechaFila />
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProductsLoadingSkeleton() {
  return <ListSkeleton label="Cargando productos..." />;
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyStateCard
      title="Aún no tienes productos"
      description="Crea tu primer producto para empezar a registrar tus elaboraciones."
      steps={[
        "Escribe su nombre, código y contenido.",
        "Agrega categorías, precio e imagen cuando quieras.",
        "Define su formulación: los ingredientes que lleva. Con ella podrás crear elaboraciones.",
      ]}
      action={
        <Button type="button" onClick={onCreate}>
          Crear tu primer producto
        </Button>
      }
    />
  );
}

function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <AvisoLista
      title="No encontramos productos"
      description="No hay productos que coincidan con la búsqueda o los filtros seleccionados."
      action={
        <Button type="button" variant="secondary" onClick={onClear}>
          Limpiar filtros
        </Button>
      }
    />
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
    <AvisoLista
      title={message}
      description="Verifica tu conexión e inténtalo nuevamente."
      action={
        <Button type="button" variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      }
    />
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
