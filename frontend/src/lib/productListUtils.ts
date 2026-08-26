import type {
  Product,
  ProductListFilters,
  ProductSortOption,
} from "@/types/product";

export function formatProductContent(
  contenidoNeto: string | null,
  unidadMedida: string | null,
): string {
  if (!contenidoNeto || !unidadMedida) {
    return "—";
  }

  const value = Number(contenidoNeto);
  if (Number.isNaN(value)) {
    return `${contenidoNeto} ${unidadMedida}`;
  }

  const formatted = Number.isInteger(value)
    ? value.toString()
    : value.toString().replace(/\.?0+$/, "");
  return `${formatted} ${unidadMedida}`;
}

export function formatPresentacion(presentacion: string | null): string {
  return presentacion?.trim() ? presentacion : "—";
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

function recentSortKey(product: Product): number {
  if (product.created_at) {
    return new Date(product.created_at).getTime();
  }
  return product.id;
}

export function filterAndSortProducts(
  products: Product[],
  filters: ProductListFilters,
): Product[] {
  const search = filters.search.trim().toLowerCase();

  let result = products.filter((product) => {
    if (filters.unit !== "all" && product.unidad_medida !== filters.unit) {
      return false;
    }

    if (!search) {
      return true;
    }

    const nombre = product.nombre.toLowerCase();
    const codigo = (product.codigo_interno ?? "").toLowerCase();
    return nombre.includes(search) || codigo.includes(search);
  });

  result = [...result].sort((a, b) => sortProducts(a, b, filters.sort));
  return result;
}

function sortProducts(
  a: Product,
  b: Product,
  sort: ProductSortOption,
): number {
  switch (sort) {
    case "code":
      return compareText(a.codigo_interno ?? "", b.codigo_interno ?? "");
    case "name":
      return compareText(a.nombre, b.nombre);
    case "recent":
    default:
      return recentSortKey(b) - recentSortKey(a);
  }
}

export function productCountLabel(total: number): string {
  if (total === 1) {
    return "1 producto registrado";
  }
  return `${total} productos registrados`;
}

export function hasActiveFilters(filters: ProductListFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.unit !== "all" ||
    filters.sort !== "recent"
  );
}
