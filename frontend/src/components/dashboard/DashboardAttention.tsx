import { Link } from "react-router-dom";
import Badge from "@/components/ui/Badge";
import {
  PRODUCT_GAP_LABELS,
  type ProductWithGaps,
} from "@/lib/productCompleteness";

const MAX_VISIBLE = 5;

interface DashboardAttentionProps {
  items: ProductWithGaps[];
}

export default function DashboardAttention({ items }: DashboardAttentionProps) {
  const visible = items.slice(0, MAX_VISIBLE);
  const hidden = items.length - visible.length;

  return (
    <section
      aria-labelledby="dashboard-attention-title"
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2
            id="dashboard-attention-title"
            className="text-base font-semibold text-text-primary"
          >
            Por completar
          </h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Productos con información comercial pendiente.
          </p>
        </div>
        <Badge variant="warning">{items.length}</Badge>
      </div>

      <ul className="divide-y divide-border">
        {visible.map(({ product, gaps }) => (
          <li
            key={product.id}
            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">
                {product.nombre}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {gaps.map((gap) => (
                  <Badge key={gap} variant="neutral">
                    {PRODUCT_GAP_LABELS[gap]}
                  </Badge>
                ))}
              </div>
            </div>
            <Link
              to={`/productos/${product.id}/editar`}
              aria-label={`Completar producto ${product.nombre}`}
              className="shrink-0 self-start rounded text-sm font-medium text-accent-strong underline-offset-2 hover:underline sm:self-center"
            >
              Completar
            </Link>
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <p className="mt-3 text-xs text-text-secondary">
          y {hidden} producto{hidden === 1 ? "" : "s"} más.{" "}
          <Link
            to="/productos"
            className="font-medium text-accent-strong underline-offset-2 hover:underline"
          >
            Ver todos los productos
          </Link>
        </p>
      )}
    </section>
  );
}
