import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as costosService from "@/services/costosService";
import * as elaboracionService from "@/services/elaboracionService";
import * as productService from "@/services/productService";
import { EMPTY_PRODUCT_COMMERCIAL_FIELDS, mockCategories, mockProductor, paginaElaboraciones, renderWithProviders } from "@/test/testUtils";
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

vi.mock("@/services/costosService", () => ({
  obtenerCostos: vi.fn(),
  guardarCostos: vi.fn(),
}));

const PRODUCTO: Product = {
  id: 7,
  productor_id: 1,
  codigo_interno: "COD-007",
  nombre: "Mermelada de frutilla",
  descripcion: null,
  contenido_neto: "250.000",
  unidad_medida: "g",
  presentacion: null,
  ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
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
  vi.mocked(productService.listProducts).mockResolvedValue([PRODUCTO]);
  vi.mocked(productService.getProduct).mockResolvedValue(PRODUCTO);
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(paginaElaboraciones([]));
});

describe("HU14 — menú y acceso desde el producto", () => {
  it("«Calculadora de costos» está en «Herramientas», después de «Publicaciones», y lleva a /calculadora", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/productos"] });

    const nav = await screen.findByRole("navigation", { name: "Secciones" });
    const enlaces = within(nav).getAllByRole("link").map((l) => l.textContent);
    expect(enlaces.slice(-2)).toEqual(["Publicaciones", "Calculadora de costos"]);

    await user.click(within(nav).getByRole("link", { name: "Calculadora de costos" }));
    expect(await screen.findByRole("heading", { name: "Calculadora de costos", level: 1 })).toBeInTheDocument();
    // Cada pantalla trae su propio menú: se vuelve a buscar.
    const navNuevo = screen.getByRole("navigation", { name: "Secciones" });
    expect(within(navNuevo).getByRole("link", { name: "Calculadora de costos" })).toHaveAttribute("aria-current", "page");
    // The title is set in an effect, after the screen is drawn: wait for it like for the heading.
    await waitFor(() => expect(document.title).toContain("Calculadora de costos"));
  });

  it("el detalle del producto tiene «Calcular costos» y lleva a /calculadora?producto=<id>", async () => {
    const user = userEvent.setup();
    vi.mocked(costosService.obtenerCostos).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<App />, { initialEntries: ["/productos/7"] });

    await user.click(await screen.findByRole("button", { name: "Calcular costos" }));

    expect(await screen.findByRole("heading", { name: "Calculadora de costos", level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenCalledWith(7, {}, expect.anything()));
  });
});

// --- tamaños: el código de la calculadora respeta el mínimo de 12 px y de 44 px ---------------------

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivos(join(dir, e.name)) : [join(dir, e.name)],
  );
}

describe("HU14 — la calculadora no usa texto de menos de 12 px", () => {
  const rutas = [...archivos("src/components/costos"), "src/pages/CostCalculator.tsx"];

  it("encuentra los archivos que debe revisar", () => {
    expect(rutas.length).toBeGreaterThanOrEqual(5);
  });

  it("ningún archivo usa text-[10px] ni text-[11px]", () => {
    const infractores = rutas.filter((r) => /text-\[(?:[0-9]|1[01])px\]/.test(readFileSync(r, "utf8")));
    expect(infractores).toEqual([]);
  });

  it("los enlaces sueltos de la calculadora miden 44 px (min-h-11)", () => {
    for (const ruta of rutas) {
      const codigo = readFileSync(ruta, "utf8");
      for (const m of codigo.matchAll(/<(?:Link|a)\b[^>]*className="([^"]*)"/g)) {
        expect(m[1], `${ruta}: un enlace sin min-h-11 (${m[1].slice(0, 40)}…)`).toContain("min-h-11");
      }
    }
  });
});
