import { useId, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/Input";

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface ListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  disabled?: boolean;
  /** Controles de filtro y orden; en móvil quedan tras el botón «Filtros». */
  controls: ReactNode;
  chips: FilterChip[];
  onClearAll: () => void;
  status?: string;
}

export default function ListToolbar({
  search,
  onSearchChange,
  searchLabel,
  searchPlaceholder,
  disabled = false,
  controls,
  chips,
  onClearAll,
  status,
}: ListToolbarProps) {
  const [expanded, setExpanded] = useState(false);
  const controlsId = useId();
  const nonSearchCount = chips.filter((chip) => chip.key !== "search").length;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <Input
            label="Buscar"
            type="search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={disabled}
            aria-label={searchLabel}
          />
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={controlsId}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border-strong bg-card px-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface sm:hidden"
        >
          <FilterIcon />
          Filtros
          {nonSearchCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">
              {nonSearchCount}
            </span>
          )}
        </button>
      </div>

      <div
        id={controlsId}
        className={`${expanded ? "grid" : "hidden"} grid-cols-1 gap-4 sm:grid sm:grid-cols-2`}
      >
        {controls}
      </div>

      {chips.length > 0 && (
        <div role="group" className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-0.5 pl-3 pr-1 text-xs font-medium text-accent-strong"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`Quitar filtro: ${chip.label}`}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-brand-100"
              >
                <svg
                  aria-hidden="true"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="rounded px-1 text-xs font-medium text-accent-strong underline-offset-2 hover:underline"
          >
            Limpiar todo
          </button>
        </div>
      )}

      {status && (
        <p className="text-xs text-text-secondary" role="status">
          {status}
        </p>
      )}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
