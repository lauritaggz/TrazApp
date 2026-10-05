import {
  FUENTE_LABELS,
  type AlergenoDeclarado,
  type Insumo,
  type InsumoListFilters,
  type IngredienteResumen,
  type TipoDeclaracion,
} from "@/types/insumo";

export function insumoCountLabel(count: number, activos: boolean): string {
  const estado = activos ? "" : " inactivo";
  if (count === 1) return `1 insumo${estado} registrado`;
  return `${count} insumos${activos ? "" : " inactivos"} registrados`;
}

export function formatFuente(fuente: string): string {
  return FUENTE_LABELS[fuente] ?? fuente;
}

/** Date and time in 24 h, Chile time zone (project convention). */
export function formatFechaHora(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

/** Distinct ingredients of the loaded supplies, by name: the options of the ingredient filter. */
export function ingredienteFilterOptions(insumos: Insumo[]): IngredienteResumen[] {
  const byId = new Map<number, IngredienteResumen>();
  for (const insumo of insumos) byId.set(insumo.ingrediente.id, insumo.ingrediente);
  return [...byId.values()].sort((a, b) => compareText(a.nombre, b.nombre));
}

/** Search by name, brand/origin or barcode, plus the ingredient filter. The status is a server filter. */
export function filterInsumos(insumos: Insumo[], filters: InsumoListFilters): Insumo[] {
  const search = filters.search.trim().toLowerCase();
  return insumos.filter((insumo) => {
    if (
      filters.ingredienteId !== "all" &&
      String(insumo.ingrediente_id) !== filters.ingredienteId
    ) {
      return false;
    }
    if (!search) return true;
    return (
      insumo.nombre.toLowerCase().includes(search) ||
      insumo.marca_origen.toLowerCase().includes(search) ||
      (insumo.codigo_barras ?? "").includes(search)
    );
  });
}

export function hasActiveInsumoFilters(filters: InsumoListFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.ingredienteId !== "all" ||
    filters.estado !== "activos"
  );
}

/** Split declared allergens by declaration type, keeping the order the API returns. */
export function groupDeclarados(
  declarados: AlergenoDeclarado[],
): Record<TipoDeclaracion, AlergenoDeclarado[]> {
  return {
    contiene: declarados.filter((item) => item.tipo === "contiene"),
    trazas: declarados.filter((item) => item.tipo === "trazas"),
  };
}
