import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAppShell } from "@/hooks/useAppShell";
import {
  filterAndSortIngredientes,
  formatIngredienteTipo,
  hasActiveIngredientFilters,
  ingredientCountLabel,
} from "@/lib/ingredientListUtils";
import { listIngredients } from "@/services/ingredientService";
import {
  DEFAULT_INGREDIENTE_LIST_FILTERS,
  INGREDIENTE_SORT_OPTIONS,
  INGREDIENTE_TIPO_FILTER_OPTIONS,
  type Ingrediente,
  type IngredienteListFilters,
} from "@/types/ingredient";

export default function Ingredients() {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleLogout, handleNavigate, producerName, businessName } =
    useAppShell();

  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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
      ingredientDeleted?: boolean;
      ingredientUpdated?: boolean;
    } | null;
    if (state?.ingredientCreated) {
      setSuccessMessage("Ingrediente creado correctamente.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (state?.ingredientDeleted) {
      setSuccessMessage("Ingrediente desactivado correctamente.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (state?.ingredientUpdated) {
      setSuccessMessage("Ingrediente actualizado correctamente.");
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const filteredIngredientes = useMemo(
    () => filterAndSortIngredientes(ingredientes, filters),
    [ingredientes, filters],
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
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-brand-600 font-medium mb-1">Catálogo</p>
            <h1 className="text-2xl font-semibold text-text-primary mb-1.5">
              Ingredientes
            </h1>
            <p className="text-text-secondary text-sm leading-relaxed">
              Administra los ingredientes de tu negocio.
            </p>
            {!loading && !error && (
              <p className="text-sm text-text-secondary mt-2">
                {ingredientCountLabel(totalCount)}
              </p>
            )}
          </div>
          <Button
            type="button"
            className="w-full sm:w-auto shrink-0"
            onClick={() => navigate("/ingredientes/nuevo")}
          >
            + Nuevo ingrediente
          </Button>
        </header>

        {successMessage && <Alert type="success">{successMessage}</Alert>}

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
              onSelect={(id) => navigate(`/ingredientes/${id}`)}
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
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <Input
        label="Buscar"
        type="search"
        placeholder="Buscar por nombre o código..."
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        disabled={disabled}
        aria-label="Buscar por nombre o código"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-primary">Tipo</span>
          <select
            value={filters.tipo}
            onChange={(e) =>
              onChange({
                ...filters,
                tipo: e.target.value as IngredienteListFilters["tipo"],
              })
            }
            disabled={disabled}
            className="w-full rounded-lg border border-border bg-card text-sm text-text-primary px-3 py-2.5"
          >
            {INGREDIENTE_TIPO_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-primary">Ordenar</span>
          <select
            value={filters.sort}
            onChange={(e) =>
              onChange({
                ...filters,
                sort: e.target.value as IngredienteListFilters["sort"],
              })
            }
            disabled={disabled}
            className="w-full rounded-lg border border-border bg-card text-sm text-text-primary px-3 py-2.5"
          >
            {INGREDIENTE_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {showResultCount && hasActiveIngredientFilters(filters) && (
        <p className="text-xs text-text-secondary">
          Mostrando {resultCount} resultado{resultCount === 1 ? "" : "s"}
        </p>
      )}
    </div>
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
    <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface/60">
            <th className="text-left font-semibold text-text-secondary px-4 py-3">
              Ingrediente
            </th>
            <th className="text-left font-semibold text-text-secondary px-4 py-3">
              Tipo
            </th>
            <th className="text-left font-semibold text-text-secondary px-4 py-3">
              Estado
            </th>
            <th className="text-right font-semibold text-text-secondary px-4 py-3">
              Acción
            </th>
          </tr>
        </thead>
        <tbody>
          {ingredientes.map((ingrediente) => (
            <tr
              key={ingrediente.id}
              className="border-b border-border last:border-b-0 hover:bg-brand-50/40 cursor-pointer"
              onClick={() => onSelect(ingrediente.id)}
              tabIndex={0}
              role="link"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(ingrediente.id);
                }
              }}
            >
              <td className="px-4 py-3">
                <p className="font-medium">{ingrediente.nombre}</p>
                <p className="text-xs text-text-secondary">
                  {ingrediente.codigo_interno ?? "—"}
                </p>
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {formatIngredienteTipo(ingrediente.tipo)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge activo={ingrediente.activo} />
              </td>
              <td className="px-4 py-3 text-right text-brand-600 font-medium">
                Ver
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IngredientsCards({
  ingredientes,
  onSelect,
}: {
  ingredientes: Ingrediente[];
  onSelect: (id: number) => void;
}) {
  return (
    <div className="md:hidden space-y-3">
      {ingredientes.map((ingrediente) => (
        <article
          key={ingrediente.id}
          className="bg-card border border-border rounded-xl p-4 cursor-pointer"
          onClick={() => onSelect(ingrediente.id)}
        >
          <div className="flex justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{ingrediente.nombre}</h2>
              <p className="text-xs text-brand-600 uppercase">
                {ingrediente.codigo_interno ?? "—"}
              </p>
              <p className="text-sm text-text-secondary mt-1">
                {formatIngredienteTipo(ingrediente.tipo)}
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
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
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
  return (
    <div className="space-y-3" aria-live="polite" aria-busy="true">
      <p className="text-sm text-text-secondary">Cargando ingredientes...</p>
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-16 rounded-xl border border-border bg-card animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-8 text-center">
      <h2 className="text-lg font-semibold mb-2">Aún no tienes ingredientes</h2>
      <p className="text-sm text-text-secondary mb-6">
        Registra tu primer ingrediente para comenzar a organizar su información.
      </p>
      <Button type="button" onClick={onCreate}>
        Registrar primer ingrediente
      </Button>
    </div>
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
