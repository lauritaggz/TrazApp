import { Link } from "react-router-dom";
import Badge from "@/components/ui/Badge";
import {
  formatCategoriasCompact,
  formatProductContent,
  formatProductMoney,
} from "@/lib/productListUtils";
import { resolveProductImageUrl } from "@/lib/productImageUpload";
import type { Product } from "@/types/product";

export default function ProductsGrid({ products }: { products: Product[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product, index) => {
        const src = resolveProductImageUrl(product.imagen_url);
        const categories = formatCategoriasCompact(product.categorias);
        const price = product.precio_venta?.trim();
        return (
          <li
            key={product.id}
            className="reveal"
            style={{ "--i": Math.min(index, 11) } as React.CSSProperties}
          >
            <article className="group relative h-full overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-shadow hover:shadow-lift focus-within:ring-2 focus-within:ring-accent">
              <div className="aspect-[4/3] w-full overflow-hidden bg-surface">
                {src ? (
                  <img
                    src={src}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="flex h-full w-full items-center justify-center text-3xl font-semibold text-brand-200"
                  >
                    {product.nombre.trim().charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="space-y-1.5 p-4">
                <h2 className="truncate text-base font-semibold text-text-primary">
                  <Link
                    to={`/productos/${product.id}`}
                    aria-label={`Ver producto ${product.nombre}`}
                    className="after:absolute after:inset-0 focus:outline-none"
                  >
                    {product.nombre}
                  </Link>
                </h2>
                <p className="text-sm text-text-secondary">
                  {product.codigo_interno ?? "—"}
                  <span aria-hidden="true"> · </span>
                  <span className="tabular-nums">
                    {formatProductContent(
                      product.contenido_neto,
                      product.unidad_medida,
                    )}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {categories ? (
                    product.categorias.map((category) => (
                      <Badge key={category.id} variant="brand">
                        {category.nombre}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-[13px] text-text-muted">
                      Sin categorías
                    </span>
                  )}
                  {price && (
                    <span className="ml-auto text-sm font-medium tabular-nums text-text-primary">
                      ${formatProductMoney(price)}
                    </span>
                  )}
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
