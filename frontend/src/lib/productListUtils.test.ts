import { describe, expect, it } from "vitest";
import {
  filterAndSortProducts,
  formatPresentacion,
  formatProductContent,
  formatProductMoney,
} from "@/lib/productListUtils";
import type { Product } from "@/types/product";
import { EMPTY_PRODUCT_COMMERCIAL_FIELDS } from "@/test/testUtils";

const baseProduct: Product = {
  id: 1,
  productor_id: 1,
  codigo_interno: "GAL-001",
  nombre: "Galleta",
  descripcion: "Desc",
  contenido_neto: "250.000",
  unidad_medida: "g",
  presentacion: null,
  ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
  activo: true,
  created_at: null,
};

describe("productListUtils", () => {
  it("formatea contenido y presentación", () => {
    expect(formatProductContent("250.000", "g")).toBe("250 g");
    expect(formatPresentacion(null)).toBe("—");
  });

  it("formatea costo y precio para detalle", () => {
    expect(formatProductMoney(null)).toBe("No informado");
    expect(formatProductMoney("12.50")).toBe("12,5");
    expect(formatProductMoney("1000.00")).toBe("1.000");
  });

  it("ordena legacy sin created_at usando id como fallback", () => {
    const products: Product[] = [
      { ...baseProduct, id: 1, created_at: null },
      { ...baseProduct, id: 5, created_at: null, codigo_interno: "Z-001" },
    ];

    const sorted = filterAndSortProducts(products, {
      search: "",
      unit: "all",
      sort: "recent",
    });

    expect(sorted.map((p) => p.id)).toEqual([5, 1]);
  });
});
