import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/toastContext";
import Button from "@/components/ui/Button";
import EmptyStateCard from "@/components/ui/EmptyStateCard";
import ListToolbar, { type FilterChip } from "@/components/ui/ListToolbar";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAppShell } from "@/hooks/useAppShell";
import {
  filterAndSortIngredientes,
  hasActiveIngredientFilters,
  ingredientCountLabel,
} from "@/lib/ingredientListUtils";
import { listIngredients } from "@/services/ingredientService";
import {
  DEFAULT_INGREDIENTE_LIST_FILTERS,
  INGREDIENTE_SORT_OPTIONS,
  type Ingrediente,
  type IngredienteListFilters,
} from "@/types/ingredient";

export default function Ingredients() {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleLogout, producerName, businessName } =
    useAppShell();

  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { notify } = useToast();
  const [filters, setFilters] = useState<IngredienteListFilters>(
    DEFAULT_INGREDIENTE_LIST_FILTERS,
  );

  const loadIngredientes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listIngredients();
      setIngredientes(data);
    } catch {
      setError("No pudimos cargar tus ingredientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIngredientes();
  }, [loadIngredientes]);

  useEffect(() => {
    const state = location.state as {
      ingredientCreated?: boolean;
      ingredientId?: number;
      ingredientDeleted?: boolean;
      ingredientUpdated?: boolean;
    } | null;
    if (state?.ingredientCreated) {
      notify(
        "Ingrediente creado correctamente.",
        "success",
        typeof state.ingredientId === "number"
          ? {
              label: "Declarar alérgenos y composición",
              to: `/ingredientes/${state.ingredientId}`,
            }
          : undefined,
      );
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (state?.ingredientDeleted) {
      notify("Ingrediente desactivado correctamente.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (state?.ingredientUpdated) {
      notify("Ingrediente actualizado correctamente.");
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate, notify]);

  const deferredSearch = useDeferredValue(filters.search);
  const filteredIngredientes = useMemo(
    () =>
      filterAndSortIngredientes(ingredientes, { ...filters, search: deferredSearch }),
    [ingredientes, filters, deferredSearch],
  );

  const totalCount = ingredientes.length;
  const showEmptyState = !loading && !error && totalCount === 0;
  const showNoResults =
    !loading && !error && totalCount > 0 && filteredIngredientes.length === 0;
  const showList =
    !loading && !error && totalCount > 0 && filteredIngredientes.length > 0;

  function clearFilters() {
    setFilters(DEFAULT_INGREDIENTE_LIST_FILTERS);
  }

  return (
    <AppShell
      activePage="ingredientes"
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="w-full space-y-6">
        <PageHeader
          title="Ingredientes"
          description={
            <>
              Administra los ingredientes de tu negocio.
              {!loading && !error && (
                <span className="mt-2 block">{ingredientCountLabel(totalCount)}</span>
              )}
            </>
          }
          actions={
            <Button
              type="button"
              className="w-full sm:w-auto shrink-0"
              onClick={() => navigate("/ingredientes/nuevo")}
            >
              + Nuevo ingrediente
            </Button>
          }
        />

        {!showEmptyState && !error && (
          <IngredientListControls
            filters={filters}
            onChange={setFilters}
            disabled={loading}
            resultCount={filteredIngredientes.length}
            showResultCount={showList || showNoResults}
          />
        )}

        {loading && <IngredientsLoadingSkeleton />}

        {!loading && error && (
          <ErrorState message={error} onRetry={() => void loadIngredientes()} />
        )}

        {showEmptyState && (
          <EmptyState onCreate={() => navigate("/ingredientes/nuevo")} />
        )}

        {showNoResults && <NoResultsState onClear={clearFilters} />}

        {showList && (
          <>
            <IngredientsTable
              ingredientes={filteredIngredientes}
              onSelect={(id) => navigate(`/ingredientes/${id}`)}
            />
            <IngredientsCards
              ingredientes={filteredIngredientes}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}

function IngredientListControls({
  filters,
  onChange,
  disabled,
  resultCount,
  showResultCount,
}: {
  filters: IngredienteListFilters;
  onChange: (filters: IngredienteListFilters) => void;
  disabled: boolean;
  resultCount: number;
  showResultCount: boolean;
}) {
  const sortLabel =
    INGREDIENTE_SORT_OPTIONS.find((option) => option.value === filters.sort)?.label ??
    filters.sort;

  const chips: FilterChip[] = [];
  if (filters.search.trim()) {
    chips.push({
      key: "search",
      label: `Búsqueda: «${filters.search.trim()}»`,
      onRemove: () => onChange({ ...filters, search: "" }),
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
      onClearAll={() => onChange(DEFAULT_INGREDIENTE_LIST_FILTERS)}
      status={
        showResultCount && hasActiveIngredientFilters(filters)
          ? `Mostrando ${resultCount} resultado${resultCount === 1 ? "" : "s"}`
          : undefined
      }
      controls={
        <Select
          label="Ordenar"
          value={filters.sort}
          onChange={(e) =>
            onChange({
              ...filters,
              sort: e.target.value as IngredienteListFilters["sort"],
            })
          }
          disabled={disabled}
        >
          {INGREDIENTE_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      }
    />
  );
}

function IngredientsTable({
  ingredientes,
  onSelect,
}: {
  ingredientes: Ingrediente[];
  onSelect: (id: number) => void;
}) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[40rem] table-auto text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/60">
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Ingrediente
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Estado
              </th>
              <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                Acción
              </th>
            </tr>
          </thead>
        <tbody>
          {ingredientes.map((ingrediente) => (
            <tr
              key={ingrediente.id}
              className="border-b border-border last:border-b-0 hover:bg-brand-50/40 cursor-pointer focus-within:bg-brand-50/40"
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest("a")) {
                  onSelect(ingrediente.id);
                }
              }}
            >
              <td className="px-4 py-3">
                <p>
                  <Link
                    to={`/ingredientes/${ingrediente.id}`}
                    aria-label={`Ver ingrediente ${ingrediente.nombre}`}
                    className="rounded font-medium text-text-primary hover:text-accent-strong hover:underline underline-offset-2"
                  >
                    {ingrediente.nombre}
                  </Link>
                </p>
                <p className="text-[13px] text-text-secondary">
                  {ingrediente.codigo_interno ?? "—"}
                </p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge activo={ingrediente.activo} />
              </td>
              <td
                aria-hidden="true"
                className="px-4 py-3 text-right text-accent font-medium"
              >
                Ver
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}

function IngredientsCards({ ingredientes }: { ingredientes: Ingrediente[] }) {
  return (
    <div className="md:hidden space-y-3">
      {ingredientes.map((ingrediente) => (
        <article
          key={ingrediente.id}
          className="relative bg-card border border-border rounded-xl p-4 hover:border-accent transition-colors focus-within:ring-2 focus-within:ring-accent"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold break-words">
                <Link
                  to={`/ingredientes/${ingrediente.id}`}
                  aria-label={`Ver ingrediente ${ingrediente.nombre}`}
                  className="after:absolute after:inset-0 focus:outline-none"
                >
                  {ingrediente.nombre}
                </Link>
              </h2>
              <p className="text-[13px] text-accent uppercase">
                {ingrediente.codigo_interno ?? "—"}
              </p>
            </div>
            <StatusBadge activo={ingrediente.activo} />
          </div>
        </article>
      ))}
    </div>
  );
}

function StatusBadge({ activo }: { activo: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 self-start whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-medium ${
        activo
          ? "bg-success-bg text-success border border-success/20"
          : "bg-surface text-text-secondary border border-border"
      }`}
    >
      {activo ? "Activo" : "Inactivo"}
    </span>
  );
}

function IngredientsLoadingSkeleton() {
  return <ListSkeleton label="Cargando ingredientes..." />;
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyStateCard
      title="Aún no tienes ingredientes"
      description="Registra tu primer ingrediente para comenzar a organizar su información."
      steps={[
        "Escribe su nombre y código interno.",
        "Declara sus alérgenos desde el detalle.",
        "Si es compuesto, indica su composición.",
      ]}
      action={
        <Button type="button" onClick={onCreate}>
          Registrar primer ingrediente
        </Button>
      }
    />
  );
}

function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-8 text-center">
      <h2 className="text-lg font-semibold mb-2">No encontramos ingredientes</h2>
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
      <h2 className="text-lg font-semibold mb-2">{message}</h2>
      <Button type="button" variant="secondary" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
