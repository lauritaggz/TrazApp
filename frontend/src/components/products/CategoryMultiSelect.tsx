import type { Categoria } from "@/types/product";
import Button from "@/components/ui/Button";

interface CategoryMultiSelectProps {
  categories?: Categoria[];
  selectedIds: number[];
  disabled?: boolean;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  error?: string;
  onChange: (selectedIds: number[]) => void;
}

export default function CategoryMultiSelect({
  categories = [],
  selectedIds,
  disabled = false,
  loading = false,
  loadError,
  onRetry,
  error,
  onChange,
}: CategoryMultiSelectProps) {
  const selectedCategories = categories.filter((category) =>
    selectedIds.includes(category.id),
  );

  function toggleCategory(categoryId: number) {
    if (disabled || loading) return;
    if (selectedIds.includes(categoryId)) {
      onChange(selectedIds.filter((id) => id !== categoryId));
      return;
    }
    onChange([...selectedIds, categoryId]);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-text-primary">
        Categorías
      </legend>
      <p className="text-xs text-text-secondary">
        Opcional. Puedes seleccionar una o varias categorías comerciales.
      </p>

      {loading ? (
        <p className="text-sm text-text-secondary" aria-live="polite">
          Cargando categorías...
        </p>
      ) : loadError ? (
        <div
          className="rounded-lg border border-error bg-error-bg p-3 space-y-3"
          role="alert"
        >
          <p className="text-sm text-error">{loadError}</p>
          {onRetry && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={onRetry}
              disabled={disabled}
            >
              Reintentar
            </Button>
          )}
        </div>
      ) : (
        <div
          className={`
            rounded-lg border bg-card p-3 space-y-2
            ${error ? "border-error bg-error-bg" : "border-border"}
          `}
          role="group"
          aria-label="Categorías del producto"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "categoria_ids-error" : undefined}
        >
          {categories.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No hay categorías disponibles.
            </p>
          ) : (
            categories.map((category) => {
              const checked = selectedIds.includes(category.id);
              return (
                <label
                  key={category.id}
                  className="flex items-center gap-2.5 text-sm text-text-primary cursor-pointer"
                >
                  <input
                    type="checkbox"
                    name="categoria_ids"
                    value={category.id}
                    checked={checked}
                    onChange={() => toggleCategory(category.id)}
                    disabled={disabled || loading}
                    className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-600"
                  />
                  <span>{category.nombre}</span>
                </label>
              );
            })
          )}
        </div>
      )}

      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-live="polite">
          {selectedCategories.map((category) => (
            <span
              key={category.id}
              className="inline-flex items-center rounded-full bg-brand-50 text-brand-700 border border-brand-100 px-2.5 py-0.5 text-xs font-medium"
            >
              {category.nombre}
            </span>
          ))}
        </div>
      )}

      {error && (
        <p
          id="categoria_ids-error"
          className="text-xs text-error flex items-center gap-1"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}
