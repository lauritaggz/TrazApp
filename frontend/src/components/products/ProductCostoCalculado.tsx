import { Link } from "react-router-dom";
import Badge from "@/components/ui/Badge";
import { formatearPesos } from "@/lib/dinero";
import { formatProductPrice } from "@/lib/productListUtils";
import type { Product } from "@/types/product";

/**
 * Costo de producción calculado (HU14, CA10): solo existe cuando el cálculo está completo y hay rendimiento.
 * Se muestra con la etiqueta «Calculado» y un enlace a la calculadora. El valor manual de HU01 no se toca: se
 * ve como referencia y vuelve a ser el valor principal cuando el cálculo deja de estar completo.
 */
export default function ProductCostoCalculado({ product }: { product: Product }) {
  const calculado = product.costo_calculado;
  if (calculado === null || calculado === undefined) return null;

  const manual = product.costo_produccion;
  return (
    <section
      aria-labelledby="product-cost-title"
      className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-soft sm:flex-row sm:items-center"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-accent"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <line x1="8" y1="6" x2="16" y2="6" />
            <line x1="8" y1="11" x2="8.01" y2="11" />
            <line x1="12" y1="11" x2="12.01" y2="11" />
            <line x1="16" y1="11" x2="16.01" y2="11" />
            <line x1="8" y1="15" x2="8.01" y2="15" />
            <line x1="12" y1="15" x2="12.01" y2="15" />
            <line x1="16" y1="15" x2="16.01" y2="15" />
          </svg>
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="product-cost-title" className="text-sm font-semibold text-text-primary">
              Costo de producción
            </h2>
            <Badge variant="success">Calculado</Badge>
          </div>
          <p className="mt-0.5 text-xs text-text-secondary">
            {manual === null ? "Sin valor manual" : `Valor manual: ${formatProductPrice(manual)} por unidad`}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="sm:text-right">
          <p className="text-lg font-semibold tabular-nums text-text-primary">{formatearPesos(calculado)}</p>
          <p className="text-xs text-text-secondary">por unidad</p>
        </div>
        <Link
          to={`/calculadora?producto=${product.id}`}
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-accent-strong underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Abrir calculadora
        </Link>
      </div>
    </section>
  );
}
