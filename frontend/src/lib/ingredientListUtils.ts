import type {
  Ingrediente,
  IngredienteListFilters,
  IngredienteSortOption,
  IngredienteTipo,
} from "@/types/ingredient";

export function formatIngredienteTipo(tipo: IngredienteTipo | null): string {
  if (tipo === "simple") return "Simple";
  if (tipo === "compuesto") return "Compuesto";
  return "—";
}

export function ingredientCountLabel(count: number): string {
  if (count === 1) return "1 ingrediente registrado";
  return `${count} ingredientes registrados`;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

function recentSortKey(ingrediente: Ingrediente): number {
  if (ingrediente.created_at) {
    return new Date(ingrediente.created_at).getTime();
  }
  return ingrediente.id;
}

function sortIngredientes(
  a: Ingrediente,
  b: Ingrediente,
  sort: IngredienteSortOption,
): number {
  if (sort === "code") {
    return compareText(a.codigo_interno ?? "", b.codigo_interno ?? "");
  }
  if (sort === "name") {
    return compareText(a.nombre, b.nombre);
  }
  return recentSortKey(b) - recentSortKey(a);
}

export function filterAndSortIngredientes(
  ingredientes: Ingrediente[],
  filters: IngredienteListFilters,
): Ingrediente[] {
  const search = filters.search.trim().toLowerCase();

  let result = ingredientes.filter((ingrediente) => {
    if (filters.tipo !== "all" && ingrediente.tipo !== filters.tipo) {
      return false;
    }
    if (!search) return true;
    const nombre = ingrediente.nombre.toLowerCase();
    const codigo = (ingrediente.codigo_interno ?? "").toLowerCase();
    return nombre.includes(search) || codigo.includes(search);
  });

  result = [...result].sort((a, b) => sortIngredientes(a, b, filters.sort));
  return result;
}

export function hasActiveIngredientFilters(filters: IngredienteListFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.tipo !== "all" ||
    filters.sort !== "recent"
  );
}

export function formatPorcentaje(value: string): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return `${numeric.toLocaleString("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })}%`;
}
