/**
 * Detalle del producto sin maquetas (T-HT08-03 / HT08, PT-HT08-06): se retiraron «Trazabilidad de
 * ingredientes» e «Información adicional», y no queda ningún «Próximamente». La columna lateral
 * conserva sus tarjetas reales.
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as productService from "@/services/productService";
import {
  EMPTY_PRODUCT_COMMERCIAL_FIELDS,
  mockCategories,
  mockProductor,
  paginaElaboraciones,
  renderWithProviders,
} from "@/test/testUtils";
import type { Product } from "@/types/product";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("@/services/productService", () => ({
  listProducts: vi.fn(),
  listCategories: vi.fn(),
  createProduct: vi.fn(),
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  uploadProductImage: vi.fn(),
  deleteProduct: vi.fn(),
  // HT08: the product detail loads its «Anterior» / «Siguiente» neighbours.
  getProductNeighbors: vi.fn().mockResolvedValue({ anterior: null, siguiente: null }),
}));

vi.mock("@/services/formulationService", () => ({
  getProductFormulation: vi.fn().mockResolvedValue({ existe: true, version: null }),
  saveProductFormulation: vi.fn(),
  listProductVersions: vi.fn().mockResolvedValue([]),
  getVersionFormulation: vi.fn(),
}));

vi.mock("@/services/elaboracionService", () => ({
  listElaboraciones: vi.fn(),
  getCodigoSugerido: vi.fn(),
  createElaboracion: vi.fn(),
  getElaboracion: vi.fn(),
  // HT08: the elaboración detail loads its «Anterior» / «Siguiente» neighbours.
  getElaboracionNeighbors: vi.fn().mockResolvedValue({ anterior: null, siguiente: null }),
}));

const PRODUCTO: Product = {
  id: 7,
  productor_id: 1,
  codigo_interno: "COD-007",
  nombre: "Mermelada de frutilla",
  descripcion: "Mermelada casera de frutilla.",
  contenido_neto: "250.000",
  unidad_medida: "g",
  presentacion: "Frasco de vidrio",
  ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
  categorias: [mockCategories[0]],
  costo_produccion: "800.00",
  precio_venta: "1500.00",
  activo: true,
  created_at: "2026-08-23T12:00:00Z",
  tiene_formulacion: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
  vi.mocked(productService.getProduct).mockResolvedValue(PRODUCTO);
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(paginaElaboraciones([]));
});

describe("HT08 (PT-HT08-06) — detalle del producto sin tarjetas «Próximamente»", () => {
  it("no muestra «Trazabilidad de ingredientes», «Información adicional» ni «Próximamente»", async () => {
    renderWithProviders(<App />, { initialEntries: ["/productos/7"] });
    await screen.findByRole("heading", { name: "Mermelada de frutilla", level: 1 });

    expect(screen.queryByText(/Trazabilidad de ingredientes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Información adicional/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Próximamente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sin TACC|Sin conservantes/)).not.toBeInTheDocument();
    expect(document.querySelector("[data-proximamente]")).toBeNull();
  });

  it("la columna lateral conserva sus tarjetas reales", async () => {
    renderWithProviders(<App />, { initialEntries: ["/productos/7"] });
    await screen.findByRole("heading", { name: "Mermelada de frutilla", level: 1 });

    for (const nombre of ["Categorías", "Presentación", "Información comercial", "Eliminar producto"]) {
      expect(screen.getByRole("region", { name: nombre })).toBeInTheDocument();
    }
  });
});
