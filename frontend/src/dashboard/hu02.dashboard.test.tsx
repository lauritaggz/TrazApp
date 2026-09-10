import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as ingredientService from "@/services/ingredientService";
import * as productService from "@/services/productService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
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
  getProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  uploadProductImage: vi.fn(),
}));

vi.mock("@/services/ingredientService", () => ({
  listIngredients: vi.fn(),
  getIngredient: vi.fn(),
  createIngredient: vi.fn(),
  updateIngredient: vi.fn(),
  deleteIngredient: vi.fn(),
  listIngredientComposition: vi.fn(),
  addCompositionComponent: vi.fn(),
  updateCompositionComponent: vi.fn(),
  deleteCompositionComponent: vi.fn(),
  listIngredientAllergens: vi.fn(),
  addIngredientAllergen: vi.fn(),
  deleteIngredientAllergen: vi.fn(),
  listAlergenosCatalog: vi.fn(),
}));

const mockProducts: Product[] = [
  {
    id: 1,
    productor_id: 1,
    codigo_interno: "GAL-001",
    nombre: "Galleta de chocolate",
    descripcion: "Galleta artesanal",
    contenido_neto: "250.000",
    unidad_medida: "g",
    presentacion: "Bolsa",
    costo_produccion: null,
    precio_venta: null,
    imagen_url: null,
    categorias: [{ id: 1, nombre: "Pastelería" }],
    activo: true,
    created_at: "2026-08-25T12:00:00Z",
  },
];

const mockIngredients: Ingrediente[] = [
  {
    id: 1,
    productor_id: 1,
    codigo_interno: "HAR-001",
    nombre: "Harina de trigo",
    descripcion: "Harina integral",
    tipo: "simple",
    activo: true,
    created_at: "2026-08-24T12:00:00Z",
  },
  {
    id: 2,
    productor_id: 1,
    codigo_interno: "MAS-001",
    nombre: "Masa base",
    descripcion: null,
    tipo: "compuesto",
    activo: true,
    created_at: "2026-08-23T12:00:00Z",
  },
];

function setupDashboardMocks() {
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listProducts).mockResolvedValue(mockProducts);
  vi.mocked(productService.listCategories).mockResolvedValue([]);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue(mockIngredients);
}

describe("Dashboard HT02", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renderiza encabezado con datos del productor", async () => {
    setupDashboardMocks();

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(
      await screen.findByRole("heading", { name: /Bienvenida, Ana/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Panaderia La Espiga").length).toBeGreaterThan(0);
  });

  it("muestra métricas reales de productos e ingredientes", async () => {
    setupDashboardMocks();

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(await screen.findByText("Productos registrados")).toBeInTheDocument();
    expect(screen.getByText("Ingredientes compuestos")).toBeInTheDocument();

    function statCard(label: string) {
      const labelNode = screen.getByText(label, { selector: "p" });
      const card = labelNode.parentElement;
      if (card == null) {
        throw new Error(`No se encontró la tarjeta de métrica "${label}"`);
      }
      return card;
    }

    await waitFor(() => {
      expect(within(statCard("Productos registrados")).getByText("1")).toBeInTheDocument();
      expect(within(statCard("Ingredientes")).getByText("2")).toBeInTheDocument();
      expect(within(statCard("Ingredientes compuestos")).getByText("1")).toBeInTheDocument();
      expect(within(statCard("Ingredientes simples")).getByText("1")).toBeInTheDocument();
    });
  });

  it("lista productos recientes con datos reales", async () => {
    setupDashboardMocks();

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(
      await screen.findByRole("button", { name: /Galleta de chocolate/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pastelería")).toBeInTheDocument();
  });

  it("lista ingredientes recientes con datos reales", async () => {
    setupDashboardMocks();

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(await screen.findByText("Harina de trigo")).toBeInTheDocument();
    expect(screen.getByText("Masa base")).toBeInTheDocument();
    expect(screen.getByText("Simple")).toBeInTheDocument();
    expect(screen.getByText("Compuesto")).toBeInTheDocument();
  });

  it("navega a productos e ingredientes desde accesos rápidos", async () => {
    const user = userEvent.setup();
    setupDashboardMocks();

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    await screen.findByText("Tus productos");
    await user.click(
      screen.getByRole("button", { name: "Ver todos los productos" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Productos" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Inicio" }));
    await screen.findByText("Ingredientes recientes");

    await user.click(
      screen.getByRole("button", { name: "Ver todos los ingredientes" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Ingredientes" }),
    ).toBeInTheDocument();
  });

  it("muestra error y reintento al fallar carga de productos", async () => {
    const user = userEvent.setup();
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
    vi.mocked(productService.listProducts)
      .mockRejectedValueOnce(new ApiError("fallo", 500))
      .mockResolvedValueOnce([]);
    vi.mocked(ingredientService.listIngredients).mockResolvedValue([]);

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(
      await screen.findByText("No pudimos cargar tus productos."),
    ).toBeInTheDocument();

    const retryButtons = screen.getAllByRole("button", { name: "Reintentar" });
    await user.click(retryButtons[0]);

    expect(
      await screen.findByText("Aún no has registrado productos."),
    ).toBeInTheDocument();
  });

  it("muestra error y reintento al fallar carga de ingredientes", async () => {
    const user = userEvent.setup();
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
    vi.mocked(productService.listProducts).mockResolvedValue([]);
    vi.mocked(ingredientService.listIngredients)
      .mockRejectedValueOnce(new ApiError("fallo", 500))
      .mockResolvedValueOnce([]);

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    const ingredientsPanel = await screen.findByText("Ingredientes recientes");
    const section = ingredientsPanel.closest("div.rounded-xl");
    expect(section).not.toBeNull();

    expect(
      await within(section as HTMLElement).findByText(
        "No pudimos cargar tus ingredientes.",
      ),
    ).toBeInTheDocument();

    await user.click(
      within(section as HTMLElement).getByRole("button", { name: "Reintentar" }),
    );

    expect(
      await within(section as HTMLElement).findByText(
        "Aún no has registrado ingredientes.",
      ),
    ).toBeInTheDocument();
  });

  it("no muestra pantalla de próximamente para ingredientes", async () => {
    setupDashboardMocks();

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    await screen.findByText("Ingredientes recientes");
    expect(screen.queryByText("Próximamente disponible")).not.toBeInTheDocument();
  });
});
