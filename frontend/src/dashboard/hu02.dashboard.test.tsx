import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as ingredientService from "@/services/ingredientService";
import * as insumoService from "@/services/insumoService";
import * as productService from "@/services/productService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { Ingrediente } from "@/types/ingredient";
import type { Insumo } from "@/types/insumo";
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

// HT06-07: the Dashboard also asks for the drafts in progress; no real request in these tests.
vi.mock("@/services/elaboracionService", () => ({
  listElaboraciones: vi.fn(),
}));

// HT07: the Dashboard counts the supplies with allergens to review; no real request in these tests.
vi.mock("@/services/insumoService", () => ({
  listInsumos: vi.fn(),
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
    tiene_formulacion: false,
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
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue([]);
  vi.mocked(insumoService.listInsumos).mockResolvedValue([]);
}

function insumo(id: number, revisado: boolean): Insumo {
  return {
    id,
    productor_id: 1,
    ingrediente_id: 1,
    ingrediente: { id: 1, nombre: "Harina" },
    nombre: `Insumo ${id}`,
    marca_origen: "Marca",
    presentacion: null,
    codigo_barras: null,
    ingredientes_declarados: null,
    advertencias: null,
    ficha: null,
    fuente: "manual",
    fecha_recuperacion: null,
    habitual: false,
    activo: true,
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    alergenos_revisados: revisado,
    alergenos_revisados_at: revisado ? "2026-10-01T12:00:00Z" : null,
    alergenos_declarados: [],
  };
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
      await screen.findByRole("heading", { name: /Hola, Ana/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Panaderia La Espiga").length).toBeGreaterThan(0);
  });

  it("muestra métricas reales de productos e ingredientes sin desglose por tipo", async () => {
    setupDashboardMocks();

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(await screen.findByText("Productos registrados")).toBeInTheDocument();
    expect(screen.queryByText("Ingredientes compuestos")).not.toBeInTheDocument();
    expect(screen.queryByText("Ingredientes simples")).not.toBeInTheDocument();

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
    });
    // HT07: la tarjeta «Ingredientes» se reemplazó por la de insumos con alérgenos sin revisar.
    expect(screen.queryByText("Ingredientes", { selector: "p" })).not.toBeInTheDocument();
  });

  it("saluda en neutro, con la fecha en minúscula y el texto de bienvenida de HT07", async () => {
    setupDashboardMocks();
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(await screen.findByRole("heading", { name: "Hola, Ana" })).toBeInTheDocument();
    expect(
      screen.getByText("Registra tus elaboraciones, insumos y alérgenos, y mantén tu catálogo al día."),
    ).toBeInTheDocument();
    // «Miércoles, 21 de octubre»: solo la primera letra en mayúscula.
    expect(screen.getByText(/^[A-ZÁÉÍÓÚ][a-záéíóú]+, \d{1,2} de [a-záéíóú]+$/)).toBeInTheDocument();
    expect(screen.queryByText(/ De [A-Z]/)).not.toBeInTheDocument();
  });

  it("la tarjeta de alérgenos cuenta los insumos activos sin revisar y lleva al listado filtrado", async () => {
    setupDashboardMocks();
    vi.mocked(insumoService.listInsumos).mockResolvedValue([insumo(1, true), insumo(2, false), insumo(3, false)]);
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    const tarjeta = await screen.findByRole("link", { name: /Insumos con alérgenos sin revisar/ });

    await waitFor(() => expect(within(tarjeta).getByText("2")).toBeInTheDocument());
    expect(tarjeta).toHaveAttribute("href", "/insumos?alergenos=sin-revisar");
    expect(insumoService.listInsumos).toHaveBeenCalledWith({ activo: true });
  });

  it("con todos los alérgenos revisados la tarjeta lo dice en positivo", async () => {
    setupDashboardMocks();
    vi.mocked(insumoService.listInsumos).mockResolvedValue([insumo(1, true), insumo(2, true)]);
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    const tarjeta = await screen.findByRole("link", { name: /Todos tus insumos tienen los alérgenos revisados/ });

    expect(within(tarjeta).getByText("Al día")).toBeInTheDocument();
    expect(tarjeta).toHaveAttribute("href", "/insumos");
  });

  it("sin insumos no dice «al día»: es la tarjeta de insumos registrados", async () => {
    setupDashboardMocks();
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    const tarjeta = await screen.findByRole("link", { name: /Insumos registrados/ });

    expect(within(tarjeta).getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("Al día")).not.toBeInTheDocument();
  });

  it("si no se pueden cargar los insumos, la tarjeta muestra «—» y sigue llevando al listado", async () => {
    setupDashboardMocks();
    vi.mocked(insumoService.listInsumos).mockRejectedValue(new ApiError("falla", 500));
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    const tarjeta = await screen.findByRole("link", { name: /Insumos con alérgenos sin revisar/ });

    await waitFor(() => expect(within(tarjeta).getByText("—")).toBeInTheDocument());
  });

  it("las tarjetas de productos son enlaces", async () => {
    setupDashboardMocks();
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(await screen.findByRole("link", { name: /Productos registrados/ })).toHaveAttribute("href", "/productos");
    expect(screen.getByRole("link", { name: /Productos por completar/ })).toHaveAttribute("href", "/productos");
  });

  it("«Nueva elaboración» es la única acción rellena del encabezado, antes de «Nuevo insumo» y «Nuevo producto»", async () => {
    setupDashboardMocks();
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    const principal = await screen.findByRole("button", { name: "Nueva elaboración" });
    const insumoLink = screen.getByRole("link", { name: "Nuevo insumo" });
    const producto = screen.getByRole("link", { name: "Nuevo producto" });

    expect(principal).toHaveClass("bg-white");
    expect(insumoLink).not.toHaveClass("bg-white");
    expect(producto).not.toHaveClass("bg-white");
    expect(principal.compareDocumentPosition(insumoLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(insumoLink.compareDocumentPosition(producto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("«Primeros pasos»: el paso 3 es la primera elaboración y se marca hecho con datos reales", async () => {
    setupDashboardMocks();
    const { unmount } = renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(await screen.findByText("Registra tu primera elaboración")).toBeInTheDocument();
    expect(screen.queryByText(/Próximamente/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("67%")).toBeInTheDocument());
    unmount();

    vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue([
      {
        id: 1,
        producto: { id: 1, nombre: "Galleta de chocolate" },
        version: { id: 1, numero_version: 1 },
        codigo: "E-001",
        fecha: "2026-10-01",
        estado: "finalizada",
        finalizada_at: "2026-10-01T12:00:00Z",
        total_ingredientes: 1,
        pendientes: 0,
      },
    ]);
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    await waitFor(() => expect(screen.getByText("100%")).toBeInTheDocument());
  });

  it("lista productos recientes con datos reales", async () => {
    setupDashboardMocks();

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(
      await screen.findByRole("button", { name: /Galleta de chocolate/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pastelería")).toBeInTheDocument();
  });

  it("lista ingredientes recientes con datos reales sin mostrar el tipo", async () => {
    setupDashboardMocks();

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(await screen.findByText("Harina de trigo")).toBeInTheDocument();
    expect(screen.getByText("Masa base")).toBeInTheDocument();
    expect(screen.queryByText("Simple")).not.toBeInTheDocument();
    expect(screen.queryByText("Compuesto")).not.toBeInTheDocument();
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

    await user.click(screen.getByRole("link", { name: "Inicio" }));
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
      await screen.findByText("Aún no tienes productos."),
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
        "Aún no tienes ingredientes.",
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
