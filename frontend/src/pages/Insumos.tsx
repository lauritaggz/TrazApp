import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyStateCard from "@/components/ui/EmptyStateCard";
import ListToolbar, { type FilterChip } from "@/components/ui/ListToolbar";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/toastContext";
import { useAppShell } from "@/hooks/useAppShell";
import {
  filterInsumos,
  hasActiveInsumoFilters,
  ingredienteFilterOptions,
  insumoCountLabel,
} from "@/lib/insumoUtils";
import { listInsumos } from "@/services/insumoService";
import {
  DEFAULT_INSUMO_LIST_FILTERS,
  INSUMO_ESTADO_OPTIONS,
  type Insumo,
  type InsumoEstadoFilter,
  type InsumoListFilters,
} from "@/types/insumo";

export default function Insumos() {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleLogout, producerName, businessName } = useAppShell();
  const { notify } = useToast();

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<InsumoListFilters>(DEFAULT_INSUMO_LIST_FILTERS);

  const activos = filters.estado === "activos";

  const loadInsumos = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setInsumos(await listInsumos({ activo: activos }));
    } catch {
      setError("No pudimos cargar tus insumos.");
    } finally {
      setLoading(false);
    }
  }, [activos]);

  useEffect(() => {
    void loadInsumos();
  }, [loadInsumos]);

  useEffect(() => {
    const state = location.state as { insumoCreated?: boolean; insumoId?: number } | null;
    if (!state?.insumoCreated) return;
    notify(
      "Insumo creado correctamente.",
      "success",
      typeof state.insumoId === "number"
        ? { label: "Declarar alérgenos", to: `/insumos/${state.insumoId}` }
        : undefined,
    );
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, notify]);

  const deferredSearch = useDeferredValue(filters.search);
  const ingredienteOptions = useMemo(() => ingredienteFilterOptions(insumos), [insumos]);
  const filteredInsumos = useMemo(
    () => filterInsumos(insumos, { ...filters, search: deferredSearch }),
    [insumos, filters, deferredSearch],
  );

  const totalCount = insumos.length;
  const showEmptyState = !loading && !error && totalCount === 0;
  const showNoResults = !loading && !error && totalCount > 0 && filteredInsumos.length === 0;
  const showList = !loading && !error && filteredInsumos.length > 0;

  function changeEstado(estado: InsumoEstadoFilter) {
    // The ingredient options come from the loaded list, so they restart with each status.
    setFilters({ ...filters, estado, ingredienteId: "all" });
  }

  function clearFilters() {
    setFilters(DEFAULT_INSUMO_LIST_FILTERS);
  }

  return (
    <AppShell
      activePage="insumos"
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="w-full space-y-6">
        <PageHeader
          title="Insumos"
          description={
            <>
              Administra los productos comerciales que usas como insumos.
              {!loading && !error && (
                <span className="mt-2 block">{insumoCountLabel(totalCount, activos)}</span>
              )}
            </>
          }
          actions={
            <Button
              type="button"
              className="w-full shrink-0 sm:w-auto"
              onClick={() => navigate("/insumos/nuevo")}
            >
              + Nuevo insumo
            </Button>
          }
        />

        {!(showEmptyState && activos) && !error && (
          <InsumoListControls
            filters={filters}
            onChange={setFilters}
            onEstadoChange={changeEstado}
            ingredienteOptions={ingredienteOptions}
            disabled={loading}
            resultCount={filteredInsumos.length}
            showResultCount={showList || showNoResults}
          />
        )}

        {loading && <ListSkeleton label="Cargando insumos..." />}

        {!loading && error && <ErrorState message={error} onRetry={() => void loadInsumos()} />}

        {showEmptyState && activos && <EmptyState onCreate={() => navigate("/insumos/nuevo")} />}

        {showEmptyState && !activos && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <h2 className="mb-2 text-lg font-semibold text-text-primary">
              No tienes insumos inactivos
            </h2>
            <p className="text-sm text-text-secondary">
              Los insumos que desactives aparecerán aquí para que puedas reactivarlos.
            </p>
          </div>
        )}

        {showNoResults && <NoResultsState onClear={clearFilters} />}

        {showList && (
          <>
            <InsumosTable insumos={filteredInsumos} onSelect={(id) => navigate(`/insumos/${id}`)} />
            <InsumosCards insumos={filteredInsumos} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function InsumoListControls({
  filters,
  onChange,
  onEstadoChange,
  ingredienteOptions,
  disabled,
  resultCount,
  showResultCount,
}: {
  filters: InsumoListFilters;
  onChange: (filters: InsumoListFilters) => void;
  onEstadoChange: (estado: InsumoEstadoFilter) => void;
  ingredienteOptions: { id: number; nombre: string }[];
  disabled: boolean;
  resultCount: number;
  showResultCount: boolean;
}) {
  const chips: FilterChip[] = [];
  if (filters.search.trim()) {
    chips.push({
      key: "search",
      label: `Búsqueda: «${filters.search.trim()}»`,
      onRemove: () => onChange({ ...filters, search: "" }),
    });
  }
  if (filters.ingredienteId !== "all") {
    const nombre =
      ingredienteOptions.find((item) => String(item.id) === filters.ingredienteId)?.nombre ??
      filters.ingredienteId;
    chips.push({
      key: "ingrediente",
      label: `Ingrediente: ${nombre}`,
      onRemove: () => onChange({ ...filters, ingredienteId: "all" }),
    });
  }
  if (filters.estado !== "activos") {
    chips.push({
      key: "estado",
      label: "Estado: Inactivos",
      onRemove: () => onEstadoChange("activos"),
    });
  }

  return (
    <ListToolbar
      search={filters.search}
      onSearchChange={(search) => onChange({ ...filters, search })}
      searchLabel="Buscar insumos"
      searchPlaceholder="Buscar por nombre, marca o código de barras..."
      disabled={disabled}
      chips={chips}
      onClearAll={() => onChange(DEFAULT_INSUMO_LIST_FILTERS)}
      status={
        showResultCount && hasActiveInsumoFilters(filters)
          ? `Mostrando ${resultCount} resultado${resultCount === 1 ? "" : "s"}`
          : undefined
      }
      controls={
        <>
          <Select
            label="Ingrediente"
            value={filters.ingredienteId}
            onChange={(e) => onChange({ ...filters, ingredienteId: e.target.value })}
            disabled={disabled}
            aria-label="Filtrar por ingrediente"
          >
            <option value="all">Todos</option>
            {ingredienteOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </Select>
          <Select
            label="Estado"
            value={filters.estado}
            onChange={(e) => onEstadoChange(e.target.value as InsumoEstadoFilter)}
            disabled={disabled}
            aria-label="Filtrar por estado"
          >
            {INSUMO_ESTADO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </>
      }
    />
  );
}

function InsumoNameCell({ insumo }: { insumo: Insumo }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="flex flex-wrap items-center gap-2">
        <Link
          to={`/insumos/${insumo.id}`}
          aria-label={`Ver insumo ${insumo.nombre}`}
          className="rounded font-medium text-text-primary underline-offset-2 hover:text-accent-strong hover:underline"
        >
          {insumo.nombre}
        </Link>
        {insumo.habitual && <Badge variant="brand">Habitual</Badge>}
        {!insumo.activo && <Badge>Inactivo</Badge>}
      </p>
      {insumo.codigo_barras && (
        <p className="text-[13px] tabular-nums text-text-secondary">{insumo.codigo_barras}</p>
      )}
    </div>
  );
}

function InsumosTable({
  insumos,
  onSelect,
}: {
  insumos: Insumo[];
  onSelect: (id: number) => void;
}) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[40rem] table-auto text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/60">
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">Insumo</th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Marca u origen
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Ingrediente
              </th>
              <th className="px-4 py-3 text-right font-semibold text-text-secondary">Acción</th>
            </tr>
          </thead>
          <tbody>
            {insumos.map((insumo) => (
              <tr
                key={insumo.id}
                className="cursor-pointer border-b border-border last:border-b-0 hover:bg-brand-50/40 focus-within:bg-brand-50/40"
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest("a")) onSelect(insumo.id);
                }}
              >
                <td className="px-4 py-3">
                  <InsumoNameCell insumo={insumo} />
                </td>
                <td className="px-4 py-3 text-text-secondary">{insumo.marca_origen}</td>
                <td className="px-4 py-3 text-text-secondary">{insumo.ingrediente.nombre}</td>
                <td aria-hidden="true" className="px-4 py-3 text-right font-medium text-accent">
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

function InsumosCards({ insumos }: { insumos: Insumo[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {insumos.map((insumo) => (
        <article
          key={insumo.id}
          className="relative rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent focus-within:ring-2 focus-within:ring-accent"
        >
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Link
              to={`/insumos/${insumo.id}`}
              aria-label={`Ver insumo ${insumo.nombre}`}
              className="break-words after:absolute after:inset-0 focus:outline-none"
            >
              {insumo.nombre}
            </Link>
            {insumo.habitual && <Badge variant="brand">Habitual</Badge>}
            {!insumo.activo && <Badge>Inactivo</Badge>}
          </h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            {insumo.marca_origen} · {insumo.ingrediente.nombre}
          </p>
          {insumo.codigo_barras && (
            <p className="mt-1 text-[13px] tabular-nums text-text-secondary">
              {insumo.codigo_barras}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyStateCard
      title="Aún no tienes insumos"
      description="Registra los productos comerciales que usas, con sus ingredientes declarados y alérgenos, para saber qué se utilizó realmente en cada elaboración."
      steps={[
        "Escribe su nombre y marca u origen, y elige el ingrediente que abastece.",
        "Agrega su código de barras si lo tiene.",
        "Declara sus alérgenos desde el detalle.",
      ]}
      action={
        <Button type="button" onClick={onCreate}>
          Registrar primer insumo
        </Button>
      }
    />
  );
}

function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <h2 className="mb-2 text-lg font-semibold text-text-primary">No encontramos insumos</h2>
      <p className="mb-6 text-sm text-text-secondary">
        No hay insumos que coincidan con la búsqueda o los filtros seleccionados.
      </p>
      <Button type="button" variant="secondary" onClick={onClear}>
        Limpiar filtros
      </Button>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <h2 className="mb-2 text-lg font-semibold text-text-primary">{message}</h2>
      <p className="mb-6 text-sm text-text-secondary">Verifica tu conexión e inténtalo nuevamente.</p>
      <Button type="button" variant="secondary" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
