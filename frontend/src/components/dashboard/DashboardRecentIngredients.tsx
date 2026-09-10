import { formatIngredienteTipo } from "@/lib/ingredientListUtils";
import type { Ingrediente } from "@/types/ingredient";
import { LeafIcon } from "@/components/dashboard/dashboardIcons";

interface DashboardRecentIngredientsProps {
  ingredients: Ingrediente[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onViewAll: () => void;
}

export default function DashboardRecentIngredients({
  ingredients,
  loading,
  error,
  onRetry,
  onViewAll,
}: DashboardRecentIngredientsProps) {
  const recent = ingredients.slice(0, 4);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text-primary">
          Ingredientes recientes
        </h2>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-medium text-brand-600 underline-offset-2 hover:underline"
          aria-label="Ver todos los ingredientes"
        >
          Ver todos
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary" aria-live="polite">
          Cargando ingredientes...
        </p>
      ) : error ? (
        <div className="space-y-3" role="alert">
          <p className="text-sm text-error">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Reintentar
          </button>
        </div>
      ) : recent.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Aún no has registrado ingredientes.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {recent.map((ingredient) => (
            <li key={ingredient.id} className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                <LeafIcon size={12} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {ingredient.nombre}
                </p>
                <p className="text-xs text-text-secondary">
                  {ingredient.descripcion?.trim() ||
                    ingredient.codigo_interno ||
                    "Sin descripción"}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                {formatIngredienteTipo(ingredient.tipo)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
