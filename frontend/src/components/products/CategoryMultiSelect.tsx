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
            space-y-2 rounded-lg
            ${error ? "border border-error bg-error-bg p-3" : ""}
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
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const checked = selectedIds.includes(category.id);
                return (
                  <label
                    key={category.id}
                    className="cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
                  >
                    <input
                      type="checkbox"
                      name="categoria_ids"
                      value={category.id}
                      checked={checked}
                      onChange={() => toggleCategory(category.id)}
                      disabled={disabled || loading}
                      className="peer sr-only"
                    />
                    <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border-strong bg-card px-3.5 text-sm text-text-primary transition-colors hover:bg-surface peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:font-medium peer-checked:text-brand-700 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600 peer-focus-visible:ring-offset-2">
                      {checked && (
                        <svg
                          aria-hidden="true"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {category.nombre}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
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
