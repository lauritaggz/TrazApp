import { formatCategoriasCompact, formatProductContent } from "@/lib/productListUtils";
import type { Product } from "@/types/product";
import { LeafIcon } from "@/components/dashboard/dashboardIcons";

interface DashboardProductPreviewCardProps {
  product: Product;
  onClick: () => void;
}

export default function DashboardProductPreviewCard({
  product,
  onClick,
}: DashboardProductPreviewCardProps) {
  const categoryLabel =
    formatCategoriasCompact(product.categorias) ?? "Sin categoría";
  const contentLabel = formatProductContent(
    product.contenido_neto,
    product.unidad_medida,
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full cursor-pointer items-start gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-wheat-deep hover:shadow-soft active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-wheat font-display text-lg font-bold text-accent-strong transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] group-hover:-rotate-6"
        aria-hidden
      >
        {product.nombre.trim().charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">
              {product.nombre}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">{categoryLabel}</p>
          </div>
          <span className="shrink-0 rounded-full border border-success-border bg-success-bg px-2 py-0.5 text-xs font-semibold text-success">
            Activo
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1">
            <LeafIcon size={12} />
            {contentLabel}
          </span>
          {product.codigo_interno ? (
            <>
              <span aria-hidden="true" className="text-wheat-deep">·</span>
              <span className="text-text-muted">{product.codigo_interno}</span>
            </>
          ) : null}
        </div>
      </div>
    </button>
  );
}
