import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/toastContext";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { AvisoLista, FichaInicial, FlechaFila } from "@/components/ui/ListaPiezas";
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
        "Ingrediente creado.",
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
      notify("Ingrediente desactivado.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (state?.ingredientUpdated) {
      notify("Cambios guardados.");
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
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[40rem] table-auto text-sm">
          <thead>
            <tr className="border-b border-border bg-panel/70">
              <th className="px-5 py-3 text-left text-[13px] font-semibold text-text-muted">
                Ingrediente
              </th>
              <th className="px-4 py-3 text-left text-[13px] font-semibold text-text-muted">
                Estado
              </th>
              <th className="w-12 px-4 py-3 text-right">
                <span className="sr-only">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ingredientes.map((ingrediente) => (
              <tr
                key={ingrediente.id}
                className="group cursor-pointer border-b border-border-soft transition-colors duration-150 last:border-b-0 hover:bg-panel/60 focus-within:bg-panel/60"
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest("a")) {
                    onSelect(ingrediente.id);
                  }
                }}
              >
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-3">
                    <FichaInicial nombre={ingrediente.nombre} />
                    <div className="min-w-0">
                      <p>
                        <Link
                          to={`/ingredientes/${ingrediente.id}`}
                          aria-label={`Ver ingrediente ${ingrediente.nombre}`}
                          className="inline-flex min-h-11 items-center rounded text-[15px] font-semibold text-text-primary underline-offset-2 hover:text-accent-strong hover:underline"
                        >
                          {ingrediente.nombre}
                        </Link>
                      </p>
                      <p className="-mt-2 text-[13px] tabular-nums text-text-secondary">
                        {ingrediente.codigo_interno ?? "—"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge activo={ingrediente.activo} />
                </td>
                <td aria-hidden="true" className="px-4 py-2.5 text-right">
                  <FlechaFila />
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
    <div className="space-y-2.5 md:hidden">
      {ingredientes.map((ingrediente) => (
        <article
          key={ingrediente.id}
          className="group relative flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-[border-color,transform] duration-150 active:scale-[0.99] hover:border-wheat-deep focus-within:ring-2 focus-within:ring-accent"
        >
          <FichaInicial nombre={ingrediente.nombre} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold break-words">
              <Link
                to={`/ingredientes/${ingrediente.id}`}
                aria-label={`Ver ingrediente ${ingrediente.nombre}`}
                className="inline-flex min-h-11 items-center after:absolute after:inset-0 focus:outline-none"
              >
                {ingrediente.nombre}
              </Link>
            </h2>
            <p className="-mt-2 text-[13px] tabular-nums text-text-secondary">
              {ingrediente.codigo_interno ?? "—"}
            </p>
          </div>
          <StatusBadge activo={ingrediente.activo} />
          <FlechaFila />
        </article>
      ))}
    </div>
  );
}

function StatusBadge({ activo }: { activo: boolean }) {
  return (
    <Badge variant={activo ? "success" : "neutral"} className="shrink-0 self-center text-[13px]">
      {activo ? "Activo" : "Inactivo"}
    </Badge>
  );
}

function IngredientsLoadingSkeleton() {
  return <ListSkeleton label="Cargando ingredientes..." />;
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyStateCard
      title="Aún no tienes ingredientes"
      description="Crea tu primer ingrediente: es lo que lleva cada producto."
      steps={[
        "Escribe su nombre y código interno.",
        "Si es compuesto, indica su composición.",
        "Los alérgenos que importan se declaran en tus insumos; los del ingrediente son solo de referencia.",
      ]}
      action={
        <Button type="button" onClick={onCreate}>
          Crear tu primer ingrediente
        </Button>
      }
    />
  );
}

function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <AvisoLista
      title="No encontramos ingredientes"
      description="Prueba con otro nombre o código, o quita los filtros."
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
