import Badge from "@/components/ui/Badge";
import {
  formatProductContent,
  formatProductMoney,
} from "@/lib/productListUtils";
import type { Categoria, ProductFormValues } from "@/types/product";

const REQUIRED_FIELDS: (keyof ProductFormValues)[] = [
  "codigo_interno",
  "nombre",
  "descripcion",
  "contenido_neto",
  "unidad_medida",
];

function countCompletedRequired(values: ProductFormValues): number {
  return REQUIRED_FIELDS.filter((field) => String(values[field] ?? "").trim() !== "")
    .length;
}

interface ProductPreviewCardProps {
  values: ProductFormValues;
  categories: Categoria[];
}

/** Resumen en vivo de cómo quedará el producto en el catálogo. Solo presentación. */
export default function ProductPreviewCard({
  values,
  categories,
}: ProductPreviewCardProps) {
  const completed = countCompletedRequired(values);
  const total = REQUIRED_FIELDS.length;
  const selected = categories.filter((category) =>
    values.categoria_ids.includes(category.id),
  );
  const name = values.nombre.trim();
  const content = formatProductContent(
    values.contenido_neto.trim() || null,
    values.unidad_medida || null,
  );
  const price = values.precio_venta.trim();

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-text-primary">
            Datos obligatorios
          </p>
          <p className="text-sm tabular-nums text-text-secondary">
            {completed} de {total}
          </p>
        </div>
        <div
          aria-hidden="true"
          className="h-1.5 w-full overflow-hidden rounded-full bg-border"
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Así se verá en tu catálogo
        </p>
        <p
          className={`text-base font-semibold ${name ? "text-text-primary" : "text-text-muted"}`}
        >
          {name || "Nombre del producto"}
        </p>
        <p className="text-sm text-text-secondary">
          {values.codigo_interno.trim() || "Código interno"}
          <span aria-hidden="true"> · </span>
          <span className="tabular-nums">{content}</span>
        </p>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((category) => (
              <Badge key={category.id} variant="brand">
                {category.nombre}
              </Badge>
            ))}
          </div>
        )}
        {price && (
          <p className="text-sm font-medium tabular-nums text-text-primary">
            ${formatProductMoney(price)}
          </p>
        )}
      </div>
    </div>
  );
}
