import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyStateCard from "@/components/ui/EmptyStateCard";
import { AvisoLista, Etiqueta, FichaInicial, FlechaFila } from "@/components/ui/ListaPiezas";
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
  type InsumoAlergenosFilter,
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
  // The Dashboard links here with `?alergenos=sin-revisar`.
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<InsumoListFilters>(() => ({
    ...DEFAULT_INSUMO_LIST_FILTERS,
    alergenos: searchParams.get("alergenos") === "sin-revisar" ? "sin_revisar" : "todos",
  }));

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
    // The allergens are declared in the creation form itself (HT06): nothing is left to do afterwards.
    const state = location.state as { insumoCreated?: boolean } | null;
    if (!state?.insumoCreated) return;
    notify("Insumo creado.", "success");
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
              Administra los insumos que usas en tus elaboraciones.
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
          <VistasRapidas
            filters={filters}
            insumos={insumos}
            loading={loading}
            onChange={(cambio) =>
              setFilters({
                ...filters,
                ...cambio,
                ingredienteId: cambio.estado !== filters.estado ? "all" : filters.ingredienteId,
              })
            }
          />
        )}

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
          <AvisoLista
            title="No tienes insumos inactivos"
            description="Los insumos que desactives aparecerán aquí para que puedas reactivarlos."
          />
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
  if (filters.alergenos === "sin_revisar") {
    chips.push({
      key: "alergenos",
      label: "Alérgenos sin revisar",
      onRemove: () => onChange({ ...filters, alergenos: "todos" }),
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
      searchPlaceholder="Buscar por nombre, marca, presentación o código de barras..."
      disabled={disabled}
      chips={chips}
      controlsColumns={3}
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
            label="Alérgenos"
            value={filters.alergenos}
            onChange={(e) => onChange({ ...filters, alergenos: e.target.value as InsumoAlergenosFilter })}
            disabled={disabled}
            aria-label="Filtrar por alérgenos"
          >
            <option value="todos">Todos</option>
            <option value="sin_revisar">Alérgenos sin revisar</option>
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

/** A supply whose allergens nobody reviewed. "Reviewed, no allergens" is not a problem: no mark. */
function SinRevisarBadge() {
  return <Badge variant="warning">Alérgenos sin revisar</Badge>;
}

function InsumoNameCell({ insumo }: { insumo: Insumo }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <FichaInicial nombre={insumo.nombre} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to={`/insumos/${insumo.id}`}
            aria-label={`Ver insumo ${insumo.nombre}`}
            className="inline-flex min-h-11 items-center rounded text-[15px] font-semibold text-text-primary underline-offset-2 hover:text-accent-strong hover:underline"
          >
            {insumo.nombre}
          </Link>
          {insumo.habitual && <Badge variant="brand">Habitual</Badge>}
          {!insumo.activo && <Badge>Inactivo</Badge>}
          {!insumo.alergenos_revisados && <SinRevisarBadge />}
        </p>
        {insumo.presentacion && (
          <p data-presentacion className="-mt-1.5 text-[13px] text-text-secondary">
            {insumo.presentacion}
          </p>
        )}
        {insumo.codigo_barras && (
          <p className="text-[13px] tabular-nums text-text-muted">{insumo.codigo_barras}</p>
        )}
      </div>
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
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[40rem] table-auto text-sm">
          <thead>
            <tr className="border-b border-border bg-panel/70">
              <th className="px-5 py-3 text-left text-[13px] font-semibold text-text-muted">Insumo</th>
              <th className="px-4 py-3 text-left text-[13px] font-semibold text-text-muted">
                Marca u origen
              </th>
              <th className="px-4 py-3 text-left text-[13px] font-semibold text-text-muted">
                Ingrediente
              </th>
              <th className="w-12 px-4 py-3 text-right">
                <span className="sr-only">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {insumos.map((insumo) => (
              <tr
                key={insumo.id}
                className="group cursor-pointer border-b border-border-soft transition-colors duration-150 last:border-b-0 hover:bg-panel/60 focus-within:bg-panel/60"
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest("a")) onSelect(insumo.id);
                }}
              >
                <td className="px-5 py-2.5">
                  <InsumoNameCell insumo={insumo} />
                </td>
                <td className="px-4 py-2.5 text-text-secondary">{insumo.marca_origen}</td>
                <td className="px-4 py-2.5">
                  <Etiqueta>{insumo.ingrediente.nombre}</Etiqueta>
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

function InsumosCards({ insumos }: { insumos: Insumo[] }) {
  return (
    <div className="space-y-2.5 md:hidden">
      {insumos.map((insumo) => (
        <article
          key={insumo.id}
          className="group relative flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-[border-color,transform] duration-150 active:scale-[0.99] hover:border-wheat-deep focus-within:ring-2 focus-within:ring-accent"
        >
          <span className="mt-1.5">
            <FichaInicial nombre={insumo.nombre} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold">
              <Link
                to={`/insumos/${insumo.id}`}
                aria-label={`Ver insumo ${insumo.nombre}`}
                className="inline-flex min-h-11 items-center break-words after:absolute after:inset-0 focus:outline-none"
              >
                {insumo.nombre}
              </Link>
              {insumo.presentacion && (
                <span data-presentacion className="text-[13px] font-normal text-text-secondary">
                  {insumo.presentacion}
                </span>
              )}
              {insumo.habitual && <Badge variant="brand">Habitual</Badge>}
              {!insumo.activo && <Badge>Inactivo</Badge>}
              {!insumo.alergenos_revisados && <SinRevisarBadge />}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-text-secondary">
              <Etiqueta>{insumo.ingrediente.nombre}</Etiqueta>
              {insumo.marca_origen}
            </p>
            {insumo.codigo_barras && (
              <p className="mt-1 text-[13px] tabular-nums text-text-muted">
                {insumo.codigo_barras}
              </p>
            )}
          </div>
          <span className="mt-3.5">
            <FlechaFila />
          </span>
        </article>
      ))}
    </div>
  );
}

/**
 * Atajos de la vista (HT08): activos, por revisar e inactivos, con su conteo cuando se conoce.
 * Equivalen a los filtros «Alérgenos» y «Estado» de la barra; los dos quedan sincronizados.
 */
function VistasRapidas({
  filters,
  insumos,
  loading,
  onChange,
}: {
  filters: InsumoListFilters;
  insumos: Insumo[];
  loading: boolean;
  onChange: (cambio: Pick<InsumoListFilters, "estado" | "alergenos">) => void;
}) {
  const enActivos = filters.estado === "activos";
  const conocidos = enActivos && !loading;
  const porRevisar = insumos.filter((insumo) => !insumo.alergenos_revisados).length;
  const vistas = [
    {
      key: "activos",
      label: "Activos",
      n: conocidos ? insumos.length : null,
      activa: enActivos && filters.alergenos === "todos",
      cambio: { estado: "activos", alergenos: "todos" } as const,
      alerta: false,
    },
    {
      key: "por-revisar",
      label: "Por revisar",
      n: conocidos ? porRevisar : null,
      activa: enActivos && filters.alergenos === "sin_revisar",
      cambio: { estado: "activos", alergenos: "sin_revisar" } as const,
      alerta: true,
    },
    {
      key: "inactivos",
      label: "Inactivos",
      n: !enActivos && !loading ? insumos.length : null,
      activa: !enActivos,
      cambio: { estado: "inactivos", alergenos: "todos" } as const,
      alerta: false,
    },
  ];

  return (
    <div
      role="group"
      aria-label="Vistas rápidas de insumos"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {vistas.map((vista) => (
        <button
          key={vista.key}
          type="button"
          aria-pressed={vista.activa}
          onClick={() => onChange(vista.cambio)}
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-[background-color,color,border-color,transform] duration-200 active:scale-95 ${
            vista.activa
              ? vista.alerta
                ? "border-warning bg-warning text-surface"
                : "border-text-primary bg-text-primary text-surface"
              : vista.alerta
                ? "border-warning-border bg-warning-bg text-warning hover:border-warning"
                : "border-border bg-card text-text-secondary hover:border-border-strong hover:text-text-primary"
          }`}
        >
          {vista.label}
          {vista.n !== null && (
            <span className="text-[13px] tabular-nums opacity-80">{vista.n}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyStateCard
      title="Aún no tienes insumos"
      description="Crea los insumos que compras y usas, con sus ingredientes declarados y alérgenos, para saber qué se utilizó realmente en cada elaboración."
      steps={[
        "Escanea el código de barras del envase, o escribe su nombre y marca u origen.",
        "Elige el ingrediente que abastece.",
        "Declara sus alérgenos o confirma que no contiene ninguno.",
      ]}
      action={
        <Button type="button" onClick={onCreate}>
          Crear tu primer insumo
        </Button>
      }
    />
  );
}

function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <AvisoLista
      title="No encontramos insumos"
      description="No hay insumos que coincidan con la búsqueda o los filtros seleccionados."
      action={
        <Button type="button" variant="secondary" onClick={onClear}>
          Limpiar filtros
        </Button>
      }
    />
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
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
