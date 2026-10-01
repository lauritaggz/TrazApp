import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { getProductGaps, productsWithGaps } from "@/lib/productCompleteness";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as ingredientService from "@/services/ingredientService";
import * as productService from "@/services/productService";
import {
  mockCategories,
  mockProductor,
  renderWithProviders,
} from "@/test/testUtils";
import type { Ingrediente } from "@/types/ingredient";
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
}));

vi.mock("@/services/ingredientService", () => ({
  listIngredients: vi.fn(),
  getIngredient: vi.fn(),
  createIngredient: vi.fn(),
  updateIngredient: vi.fn(),
  deleteIngredient: vi.fn(),
  listIngredientComposition: vi.fn(),
  listIngredientAllergens: vi.fn(),
  listAlergenosCatalog: vi.fn(),
}));

const complete: Product = {
  id: 1,
  productor_id: 1,
  codigo_interno: "GAL-001",
  nombre: "Galleta completa",
  descripcion: "Con todo",
  contenido_neto: "250",
  unidad_medida: "g",
  presentacion: "Bolsa",
  costo_produccion: "500",
  precio_venta: "1200",
  imagen_url: "/uploads/products/1.png",
  categorias: [{ id: 1, nombre: "Pastelería" }],
  activo: true,
  created_at: "2026-08-24T12:00:00Z",
};

const incomplete: Product = {
  ...complete,
  id: 2,
  codigo_interno: "PAN-001",
  nombre: "Pan sin datos",
  unidad_medida: "kg",
  precio_venta: null,
  imagen_url: null,
  categorias: [],
  created_at: "2026-08-25T12:00:00Z",
};

const ingredient: Ingrediente = {
  id: 7,
  productor_id: 1,
  codigo_interno: "HAR-001",
  nombre: "Harina",
  descripcion: null,
  tipo: null,
  activo: true,
  created_at: "2026-08-24T12:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
  vi.mocked(productService.listProducts).mockResolvedValue([complete, incomplete]);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([ingredient]);
});

describe("productCompleteness", () => {
  it("detecta imagen, categorías y precio faltantes", () => {
    expect(getProductGaps(complete)).toEqual([]);
    expect(getProductGaps(incomplete)).toEqual(["imagen", "categorias", "precio"]);
    expect(
      getProductGaps({ ...complete, precio_venta: "  ", imagen_url: "" }),
    ).toEqual(["imagen", "precio"]);
  });

  it("lista primero los productos con más pendientes", () => {
    const partial = { ...complete, id: 3, precio_venta: null };
    const result = productsWithGaps([complete, partial, incomplete]);

    expect(result.map((entry) => entry.product.id)).toEqual([2, 3]);
  });
});

describe("Dashboard: por completar", () => {
  it("muestra los productos con información pendiente y enlaza a su edición", async () => {
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    const section = await screen.findByRole("region", { name: "Por completar" });
    expect(within(section).getByText("Pan sin datos")).toBeInTheDocument();
    expect(within(section).queryByText("Galleta completa")).not.toBeInTheDocument();
    expect(within(section).getByText("Sin imagen")).toBeInTheDocument();
    expect(within(section).getByText("Sin categorías")).toBeInTheDocument();
    expect(within(section).getByText("Sin precio de venta")).toBeInTheDocument();
    expect(
      within(section).getByRole("link", { name: "Completar producto Pan sin datos" }),
    ).toHaveAttribute("href", "/productos/2/editar");
  });

  it("no muestra la sección cuando todo está completo", async () => {
    vi.mocked(productService.listProducts).mockResolvedValue([complete]);
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    await screen.findByText("Tus productos");
    expect(
      screen.queryByRole("region", { name: "Por completar" }),
    ).not.toBeInTheDocument();
  });

  it("ofrece accesos rápidos para crear producto e ingrediente", async () => {
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    await screen.findByText("Tus productos");
    expect(screen.getByRole("link", { name: "+ Nuevo producto" })).toHaveAttribute(
      "href",
      "/productos/nuevo",
    );
    expect(screen.getByRole("link", { name: "+ Nuevo ingrediente" })).toHaveAttribute(
      "href",
      "/ingredientes/nuevo",
    );
  });
});

describe("Listados: filtros con chips", () => {
  it("muestra chips de filtros activos y permite quitarlos de a uno", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/productos"] });

    await screen.findByRole("heading", { name: "Productos", level: 1 });
    await screen.findAllByRole("link", { name: /Ver producto/ });
    await user.selectOptions(
      screen.getByLabelText("Filtrar por unidad de medida"),
      "kg",
    );
    await user.type(screen.getByLabelText("Buscar por nombre o código"), "pan");

    const group = screen.getByRole("group", { name: "Filtros activos" });
    expect(within(group).getByText("Unidad: kg")).toBeInTheDocument();
    expect(within(group).getByText("Búsqueda: «pan»")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Quitar filtro: Unidad: kg" }),
    );
    expect(screen.getByLabelText("Filtrar por unidad de medida")).toHaveValue("all");
    expect(screen.getByLabelText("Buscar por nombre o código")).toHaveValue("pan");

    await user.click(screen.getByRole("button", { name: "Limpiar todo" }));
    expect(screen.getByLabelText("Buscar por nombre o código")).toHaveValue("");
    expect(
      screen.queryByRole("group", { name: "Filtros activos" }),
    ).not.toBeInTheDocument();
  });

  it("el botón Filtros expone el estado expandido para móvil", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/productos"] });

    await screen.findByRole("heading", { name: "Productos", level: 1 });
    const toggle = screen.getByRole("button", { name: /^Filtros/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});

describe("Listados y detalle: navegación", () => {
  it("los ingredientes se abren desde un enlace real", async () => {
    const user = userEvent.setup();
    vi.mocked(ingredientService.getIngredient).mockResolvedValue(ingredient);
    vi.mocked(ingredientService.listIngredientComposition).mockResolvedValue([]);
    vi.mocked(ingredientService.listIngredientAllergens).mockResolvedValue([]);
    vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue([]);
    renderWithProviders(<App />, { initialEntries: ["/ingredientes"] });

    const links = await screen.findAllByRole("link", {
      name: "Ver ingrediente Harina",
    });
    expect(links[0]).toHaveAttribute("href", "/ingredientes/7");

    await user.click(links[0]);
    expect(
      await screen.findByRole("heading", { name: "Harina", level: 1 }),
    ).toBeInTheDocument();
  });

  it("el detalle del producto ofrece Editar y Volver arriba, junto al título", async () => {
    vi.mocked(productService.getProduct).mockResolvedValue(complete);
    renderWithProviders(<App />, { initialEntries: ["/productos/1"] });

    await screen.findByRole("heading", { name: "Galleta completa", level: 1 });
    const edit = screen.getByRole("button", { name: "Editar producto" });
    const back = screen.getByRole("button", { name: "Volver a productos" });
    expect(edit.parentElement).toBe(back.parentElement);
    expect(
      screen.getByRole("region", { name: "Eliminar producto" }),
    ).toBeInTheDocument();
  });
});
