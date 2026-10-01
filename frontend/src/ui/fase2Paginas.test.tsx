import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as ingredientService from "@/services/ingredientService";
import * as productService from "@/services/productService";
import {
  mockCategories,
  mockProductor,
  renderWithProviders,
} from "@/test/testUtils";

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
  createIngredient: vi.fn(),
  getIngredient: vi.fn(),
  updateIngredient: vi.fn(),
  deleteIngredient: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
  vi.mocked(productService.listProducts).mockResolvedValue([]);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([]);
});

describe("Páginas de formulario — fase 2", () => {
  it("muestra migas de pan con enlace de vuelta al listado", async () => {
    renderWithProviders(<App />, { initialEntries: ["/productos/nuevo"] });

    await screen.findByRole("heading", { name: "Nuevo producto", level: 1 });
    const crumb = screen.getByRole("navigation", { name: "Ruta de navegación" });
    expect(crumb).toHaveTextContent("Productos");
    expect(crumb.querySelector('[aria-current="page"]')).toHaveTextContent(
      "Nuevo producto",
    );
  });

  it("avisa antes de abandonar el formulario con cambios al usar el menú", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/productos/nuevo"] });

    await screen.findByRole("heading", { name: "Nuevo producto", level: 1 });
    await user.type(screen.getByLabelText(/^Nombre/), "Galleta");

    await user.click(screen.getByRole("link", { name: "Ingredientes" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Tienes cambios sin guardar");

    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(
      screen.getByRole("heading", { name: "Nuevo producto", level: 1 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Ingredientes" }));
    await user.click(
      await screen.findByRole("button", { name: "Salir sin guardar" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Ingredientes", level: 1 }),
    ).toBeInTheDocument();
  });

  it("no avisa si el formulario está intacto", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/productos/nuevo"] });

    await screen.findByRole("heading", { name: "Nuevo producto", level: 1 });
    await user.click(screen.getByRole("link", { name: "Ingredientes" }));

    expect(
      await screen.findByRole("heading", { name: "Ingredientes", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
