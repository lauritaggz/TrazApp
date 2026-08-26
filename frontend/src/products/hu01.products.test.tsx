import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as productService from "@/services/productService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import type { Product } from "@/types/product";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("@/services/productService", () => ({
  listProducts: vi.fn(),
}));

const mockProducts: Product[] = [
  {
    id: 3,
    productor_id: 1,
    codigo_interno: "PAN-001",
    nombre: "Pan integral",
    descripcion: "Pan artesanal",
    contenido_neto: "500.000",
    unidad_medida: "g",
    presentacion: null,
    activo: true,
    created_at: "2026-08-25T12:00:00Z",
  },
  {
    id: 2,
    productor_id: 1,
    codigo_interno: "GAL-002",
    nombre: "Galleta vainilla",
    descripcion: "Galleta suave",
    contenido_neto: "1.000",
    unidad_medida: "kg",
    presentacion: "Caja x12",
    activo: true,
    created_at: "2026-08-24T12:00:00Z",
  },
  {
    id: 1,
    productor_id: 1,
    codigo_interno: "GAL-001",
    nombre: "Galleta de chocolate",
    descripcion: "Galleta con cobertura",
    contenido_neto: "250.000",
    unidad_medida: "g",
    presentacion: "Bolsa de 10 unidades",
    activo: true,
    created_at: "2026-08-23T12:00:00Z",
  },
];

function setupAuthenticated() {
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
}

async function openProductsPage(initialEntries = ["/productos"]) {
  renderWithProviders(<App />, { initialEntries });
  expect(
    await screen.findByRole("heading", { name: "Productos", level: 1 }),
  ).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.queryByText("Cargando productos...")).not.toBeInTheDocument();
  });
}

describe("Productos HU01 — listado y navegación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setupAuthenticated();
  });

  it("muestra Productos en la navegación y permite ir desde el Dashboard", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.listProducts).mockResolvedValue([]);

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });
    expect(
      await screen.findByRole("heading", { name: /Bienvenida/ }),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Productos" })).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Ir a productos/i }),
    );

    expect(
      await screen.findByRole("heading", { name: "Productos" }),
    ).toBeInTheDocument();
  });

  it("requiere autenticación para acceder a /productos", async () => {
    localStorage.clear();
    vi.mocked(authService.getCurrentProductor).mockRejectedValue(
      Object.assign(new Error("No autenticado"), { status: 401 }),
    );

    renderWithProviders(<App />, { initialEntries: ["/productos"] });

    expect(
      await screen.findByRole("heading", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
  });

  it("muestra loading y luego el listado con total registrado", async () => {
    let resolveProducts!: (value: Product[]) => void;
    vi.mocked(productService.listProducts).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProducts = resolve;
        }),
    );

    renderWithProviders(<App />, { initialEntries: ["/productos"] });
    expect(
      await screen.findByRole("heading", { name: "Productos", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cargando productos...")).toBeInTheDocument();

    resolveProducts(mockProducts);

    expect(await screen.findByText("3 productos registrados")).toBeInTheDocument();
    expect(screen.getAllByText("GAL-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Galleta de chocolate").length).toBeGreaterThan(0);
  });

  it("muestra estado vacío cuando no hay productos", async () => {
    vi.mocked(productService.listProducts).mockResolvedValue([]);
    await openProductsPage();

    expect(
      screen.getByRole("heading", { name: "Aún no tienes productos", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar primer producto" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Nuevo producto" })).toBeInTheDocument();
  });

  it("busca por nombre y por código de forma local", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.listProducts).mockResolvedValue(mockProducts);
    await openProductsPage();

    const search = screen.getByLabelText("Buscar por nombre o código");
    await user.type(search, "vainilla");
    expect(screen.getAllByText("Galleta vainilla").length).toBeGreaterThan(0);
    expect(screen.queryByText("Pan integral")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "pan-001");
    expect(screen.getAllByText("Pan integral").length).toBeGreaterThan(0);
    expect(screen.queryByText("Galleta vainilla")).not.toBeInTheDocument();
  });

  it("filtra por unidad y ordena por código y nombre", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.listProducts).mockResolvedValue(mockProducts);
    await openProductsPage();

    await user.selectOptions(
      screen.getByLabelText("Filtrar por unidad de medida"),
      "g",
    );
    expect(screen.getAllByText("GAL-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pan integral").length).toBeGreaterThan(0);
    expect(screen.queryByText("Galleta vainilla")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Ordenar productos"), "code");
    const codeRows = screen.getAllByRole("link", { name: /Ver producto/i });
    expect(codeRows[0]).toHaveAccessibleName("Ver producto Galleta de chocolate");
    expect(codeRows[1]).toHaveAccessibleName("Ver producto Pan integral");

    await user.selectOptions(screen.getByLabelText("Ordenar productos"), "name");
    const nameRows = screen.getAllByRole("link", { name: /Ver producto/i });
    expect(nameRows[0]).toHaveAccessibleName("Ver producto Galleta de chocolate");
    expect(nameRows[nameRows.length - 1]).toHaveAccessibleName(
      "Ver producto Pan integral",
    );
  });

  it("ordena por más recientes usando created_at", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.listProducts).mockResolvedValue(mockProducts);
    await openProductsPage();

    await user.selectOptions(screen.getByLabelText("Ordenar productos"), "recent");
    const rows = screen.getAllByRole("link", { name: /Ver producto/i });
    expect(rows[0]).toHaveAccessibleName("Ver producto Pan integral");
  });

  it("combina búsqueda y filtro y muestra sin resultados con limpiar filtros", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.listProducts).mockResolvedValue(mockProducts);
    await openProductsPage();

    await user.type(screen.getByLabelText("Buscar por nombre o código"), "pan");
    await user.selectOptions(
      screen.getByLabelText("Filtrar por unidad de medida"),
      "kg",
    );

    expect(
      screen.getByRole("heading", { name: "No encontramos productos", level: 2 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(screen.getAllByText("GAL-001").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Buscar por nombre o código")).toHaveValue("");
    expect(screen.getByLabelText("Filtrar por unidad de medida")).toHaveValue("all");
    expect(screen.getByLabelText("Ordenar productos")).toHaveValue("recent");
  });

  it("muestra presentación null como guión y permite navegar al detalle", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.listProducts).mockResolvedValue(mockProducts);
    await openProductsPage();

    const panLinks = screen.getAllByRole("link", { name: "Ver producto Pan integral" });
    expect(panLinks.length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);

    await user.click(panLinks[0]);
    expect(
      await screen.findByRole("heading", { name: "Detalle de producto" }),
    ).toBeInTheDocument();
  });

  it("muestra error de API y permite reintentar", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.listProducts)
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(mockProducts);

    await openProductsPage();

    expect(
      screen.getByRole("heading", {
        name: "No pudimos cargar tus productos.",
        level: 2,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(screen.getByText("3 productos registrados")).toBeInTheDocument();
    });
    expect(productService.listProducts).toHaveBeenCalledTimes(2);
  });

  it("prepara navegación hacia nuevo producto", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.listProducts).mockResolvedValue([]);
    await openProductsPage();

    await user.click(screen.getByRole("button", { name: "+ Nuevo producto" }));

    expect(
      await screen.findByRole("heading", { name: "Nuevo producto" }),
    ).toBeInTheDocument();
  });
});
