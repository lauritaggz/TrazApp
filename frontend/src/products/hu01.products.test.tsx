import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as productService from "@/services/productService";
import { mockProductor, EMPTY_PRODUCT_COMMERCIAL_FIELDS, mockCategories, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
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
    ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
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
    ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
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
    categorias: [
      { id: 1, nombre: "Pastelería" },
      { id: 2, nombre: "Dulce" },
    ],
    costo_produccion: null,
    precio_venta: null,
    imagen_url: null,
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
    vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
  });

  it("muestra Productos en la navegación y permite ir desde el Dashboard", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.listProducts).mockResolvedValue([]);

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });
    expect(
      await screen.findByRole("heading", { name: /Bienvenida/ }),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Productos" })).toBeInTheDocument();

    expect(
      await screen.findByText("Aún no has registrado productos."),
    ).toBeInTheDocument();

    await user.click(
      screen.getAllByRole("button", { name: "Registrar primer producto" })[0],
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
    expect(screen.getAllByText("Pastelería, Dulce").length).toBeGreaterThan(0);
  });

  it("muestra miniatura en el listado solo cuando el producto tiene imagen", async () => {
    const withImage: Product = {
      ...mockProducts[2],
      imagen_url: "/uploads/products/p1_thumb.png",
    };
    vi.mocked(productService.listProducts).mockResolvedValue([
      mockProducts[0],
      withImage,
    ]);

    await openProductsPage();

    const listImages = document.querySelectorAll(
      'img[src*="p1_thumb.png"]',
    );
    expect(listImages.length).toBeGreaterThan(0);
    expect(listImages[0]).toHaveAttribute(
      "src",
      "http://localhost:8000/uploads/products/p1_thumb.png",
    );
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
    vi.mocked(productService.getProduct).mockResolvedValue(mockProducts[0]);
    await openProductsPage();

    const panLinks = screen.getAllByRole("link", { name: "Ver producto Pan integral" });
    expect(panLinks.length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);

    await user.click(panLinks[0]);
    expect(
      await screen.findByRole("heading", { name: "Pan integral", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("No especificada")).toBeInTheDocument();
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
    expect(screen.getByLabelText(/Código interno/)).toBeInTheDocument();
  });
});

describe("Productos HU01 — creación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setupAuthenticated();
    vi.mocked(productService.listProducts).mockResolvedValue([]);
    vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
  });

  async function openNewProductPage() {
    renderWithProviders(<App />, { initialEntries: ["/productos/nuevo"] });
    expect(
      await screen.findByRole("heading", { name: "Nuevo producto", level: 1 }),
    ).toBeInTheDocument();
  }

  async function fillValidProductForm(
    user: ReturnType<typeof userEvent.setup>,
    overrides?: Partial<{
      codigo: string;
      nombre: string;
      descripcion: string;
      contenido: string;
      unidad: string;
      presentacion: string;
    }>,
  ) {
    await user.clear(screen.getByLabelText(/Código interno/));
    await user.type(
      screen.getByLabelText(/Código interno/),
      overrides?.codigo ?? "GAL-001",
    );
    await user.clear(screen.getByLabelText(/Nombre/));
    await user.type(
      screen.getByLabelText(/^Nombre/),
      overrides?.nombre ?? "Galleta de chocolate",
    );
    await user.clear(screen.getByLabelText(/Descripción/));
    await user.type(
      screen.getByLabelText(/Descripción/),
      overrides?.descripcion ?? "Galleta horneada con chips de chocolate",
    );
    await user.clear(screen.getByLabelText(/Contenido neto/));
    await user.type(
      screen.getByLabelText(/Contenido neto/),
      overrides?.contenido ?? "250",
    );
    await user.selectOptions(
      screen.getByLabelText(/Unidad de medida/),
      overrides?.unidad ?? "g",
    );
    if (overrides?.presentacion !== undefined) {
      await user.clear(screen.getByLabelText(/^Presentación$/));
      if (overrides.presentacion) {
        await user.type(
          screen.getByLabelText(/^Presentación$/),
          overrides.presentacion,
        );
      }
    } else {
      await user.type(
        screen.getByLabelText(/^Presentación$/),
        "Bolsa de 10 unidades",
      );
    }
  }

  it("requiere autenticación para /productos/nuevo", async () => {
    localStorage.clear();
    vi.mocked(authService.getCurrentProductor).mockRejectedValue(
      Object.assign(new Error("No autenticado"), { status: 401 }),
    );

    renderWithProviders(<App />, { initialEntries: ["/productos/nuevo"] });

    expect(
      await screen.findByRole("heading", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
  });

  it("renderiza todos los campos del formulario de creación", async () => {
    await openNewProductPage();

    expect(screen.getByLabelText(/Código interno/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nombre/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Descripción/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contenido neto/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Unidad de medida/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Presentación$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Costo de producción/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Precio de venta/)).toBeInTheDocument();
    expect(screen.getByText("Categorías")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar producto" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("valida campos obligatorios y reglas de contenido neto", async () => {
    const user = userEvent.setup();
    await openNewProductPage();

    await user.click(screen.getByRole("button", { name: "Guardar producto" }));

    expect(
      screen.getByText("El código interno es obligatorio."),
    ).toBeInTheDocument();
    expect(screen.getByText("El nombre es obligatorio.")).toBeInTheDocument();
    expect(
      screen.getByText("La descripción es obligatoria."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("El contenido neto es obligatorio."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("La unidad de medida es obligatoria."),
    ).toBeInTheDocument();
    expect(productService.createProduct).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Código interno/), "GAL-001");
    await user.type(screen.getByLabelText(/^Nombre/), "Galleta");
    await user.type(screen.getByLabelText(/Descripción/), "Desc");
    await user.type(screen.getByLabelText(/Contenido neto/), "0");
    await user.selectOptions(screen.getByLabelText(/Unidad de medida/), "g");
    await user.click(screen.getByRole("button", { name: "Guardar producto" }));
    expect(
      screen.getByText("El contenido neto debe ser mayor que 0."),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Contenido neto/));
    await user.type(screen.getByLabelText(/Contenido neto/), "-5");
    await user.click(screen.getByRole("button", { name: "Guardar producto" }));
    expect(
      screen.getByText("El contenido neto debe ser mayor que 0."),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Contenido neto/));
    await user.type(screen.getByLabelText(/Contenido neto/), "1.2345");
    await user.click(screen.getByRole("button", { name: "Guardar producto" }));
    expect(screen.getByText("Máximo 3 decimales.")).toBeInTheDocument();
    expect(productService.createProduct).not.toHaveBeenCalled();
  });

  it("permite presentación opcional y envía payload limpio", async () => {
    const user = userEvent.setup();
    const created: Product = {
      id: 10,
      productor_id: 1,
      codigo_interno: "GAL-001",
      nombre: "Galleta de chocolate",
      descripcion: "Galleta horneada con chips de chocolate",
      contenido_neto: "250.000",
      unidad_medida: "g",
      presentacion: null,
      ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
      activo: true,
      created_at: "2026-08-26T12:00:00Z",
    };
    vi.mocked(productService.createProduct).mockResolvedValue(created);
    vi.mocked(productService.listProducts).mockResolvedValue([created]);

    await openNewProductPage();
    await fillValidProductForm(user, { presentacion: "" });

    await user.click(screen.getByRole("button", { name: "Guardar producto" }));

    await waitFor(() => {
      expect(productService.createProduct).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(productService.createProduct).mock.calls[0][0];
    expect(payload).toEqual({
      codigo_interno: "GAL-001",
      nombre: "Galleta de chocolate",
      descripcion: "Galleta horneada con chips de chocolate",
      contenido_neto: "250",
      unidad_medida: "g",
      presentacion: null,
    });
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("productor_id");

    expect(
      await screen.findByRole("heading", { name: "Productos", level: 1 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Producto creado correctamente."),
    ).toBeInTheDocument();
    expect(await screen.findByText("1 producto registrado")).toBeInTheDocument();
    expect(screen.getAllByText("GAL-001").length).toBeGreaterThan(0);
  });

  it("muestra error 409 en código interno y conserva valores ante error general", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.createProduct)
      .mockRejectedValueOnce(
        new ApiError("Ya existe un producto con ese código interno.", 409),
      )
      .mockRejectedValueOnce(new ApiError("fallo", 500));

    await openNewProductPage();
    await fillValidProductForm(user);

    await user.click(screen.getByRole("button", { name: "Guardar producto" }));

    expect(
      await screen.findByText("Ya existe un producto con este código interno."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Código interno/)).toHaveValue("GAL-001");
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue("Galleta de chocolate");

    await user.click(screen.getByRole("button", { name: "Guardar producto" }));

    expect(
      await screen.findByText(
        "No pudimos guardar el producto. Inténtalo nuevamente.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Código interno/)).toHaveValue("GAL-001");
    expect(screen.getByLabelText(/Contenido neto/)).toHaveValue("250");
  });

  it("evita doble envío mientras guarda", async () => {
    const user = userEvent.setup();
    let resolveCreate!: (value: Product) => void;
    vi.mocked(productService.createProduct).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    await openNewProductPage();
    await fillValidProductForm(user);

    await user.click(screen.getByRole("button", { name: "Guardar producto" }));
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    expect(productService.createProduct).toHaveBeenCalledTimes(1);

    resolveCreate({
      id: 11,
      productor_id: 1,
      codigo_interno: "GAL-001",
      nombre: "Galleta de chocolate",
      descripcion: "Galleta horneada con chips de chocolate",
      contenido_neto: "250.000",
      unidad_medida: "g",
      presentacion: "Bolsa de 10 unidades",
      ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
      activo: true,
      created_at: "2026-08-26T12:00:00Z",
    });

    expect(
      await screen.findByRole("heading", { name: "Productos", level: 1 }),
    ).toBeInTheDocument();
  });

  it("cancelar vuelve al listado de productos", async () => {
    const user = userEvent.setup();
    await openNewProductPage();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      await screen.findByRole("heading", { name: "Productos", level: 1 }),
    ).toBeInTheDocument();
  });

  it("carga categorías disponibles y permite seleccionar varias al crear", async () => {
    const user = userEvent.setup();
    const created: Product = {
      id: 12,
      productor_id: 1,
      codigo_interno: "GAL-001",
      nombre: "Galleta de chocolate",
      descripcion: "Galleta horneada con chips de chocolate",
      contenido_neto: "250.000",
      unidad_medida: "g",
      presentacion: "Bolsa de 10 unidades",
      categorias: [
        { id: 1, nombre: "Pastelería" },
        { id: 2, nombre: "Dulce" },
      ],
      costo_produccion: null,
      precio_venta: null,
      imagen_url: null,
      activo: true,
      created_at: "2026-08-26T12:00:00Z",
    };
    vi.mocked(productService.createProduct).mockResolvedValue(created);
    vi.mocked(productService.listProducts).mockResolvedValue([created]);

    await openNewProductPage();

    expect(productService.listCategories).toHaveBeenCalled();
    expect(await screen.findByLabelText("Pastelería")).toBeInTheDocument();
    expect(screen.getByLabelText("Dulce")).toBeInTheDocument();

    await fillValidProductForm(user);
    await user.click(screen.getByLabelText("Pastelería"));
    await user.click(screen.getByLabelText("Dulce"));
    await user.click(screen.getByRole("button", { name: "Guardar producto" }));

    await waitFor(() => {
      expect(productService.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria_ids: [1, 2],
        }),
      );
    });
  });

  it("envía costo y precio al crear cuando se informan", async () => {
    const user = userEvent.setup();
    const created: Product = {
      id: 13,
      productor_id: 1,
      codigo_interno: "GAL-001",
      nombre: "Galleta de chocolate",
      descripcion: "Galleta horneada con chips de chocolate",
      contenido_neto: "250.000",
      unidad_medida: "g",
      presentacion: "Bolsa de 10 unidades",
      costo_produccion: "12.50",
      precio_venta: "25.00",
      imagen_url: null,
      categorias: [],
      activo: true,
      created_at: "2026-08-26T12:00:00Z",
    };
    vi.mocked(productService.createProduct).mockResolvedValue(created);
    vi.mocked(productService.listProducts).mockResolvedValue([created]);

    await openNewProductPage();
    await fillValidProductForm(user);
    await user.type(screen.getByLabelText(/Costo de producción/), "12.50");
    await user.type(screen.getByLabelText(/Precio de venta/), "25");
    await user.click(screen.getByRole("button", { name: "Guardar producto" }));

    await waitFor(() => {
      expect(productService.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          costo_produccion: "12.50",
          precio_venta: "25",
        }),
      );
    });
  });

  it("rechaza costo y precio negativos", async () => {
    const user = userEvent.setup();
    await openNewProductPage();
    await fillValidProductForm(user);

    await user.type(screen.getByLabelText(/Costo de producción/), "-1");
    await user.click(screen.getByRole("button", { name: "Guardar producto" }));
    expect(
      screen.getByText("El costo de producción debe ser mayor o igual que 0."),
    ).toBeInTheDocument();
    expect(productService.createProduct).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/Costo de producción/));
    await user.type(screen.getByLabelText(/Precio de venta/), "-0.01");
    await user.click(screen.getByRole("button", { name: "Guardar producto" }));
    expect(
      screen.getByText("El precio de venta debe ser mayor o igual que 0."),
    ).toBeInTheDocument();
    expect(productService.createProduct).not.toHaveBeenCalled();
  });

  it("crea el producto y sube la imagen cuando se selecciona un archivo válido", async () => {
    const user = userEvent.setup();
    const created: Product = {
      id: 14,
      productor_id: 1,
      codigo_interno: "GAL-001",
      nombre: "Galleta de chocolate",
      descripcion: "Galleta horneada con chips de chocolate",
      contenido_neto: "250.000",
      unidad_medida: "g",
      presentacion: "Bolsa de 10 unidades",
      ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
      activo: true,
      created_at: "2026-08-26T12:00:00Z",
    };
    const withImage: Product = {
      ...created,
      imagen_url: "/uploads/products/p14_test.png",
    };
    const imageFile = new File(["png"], "galleta.png", { type: "image/png" });

    vi.mocked(productService.createProduct).mockResolvedValue(created);
    vi.mocked(productService.uploadProductImage).mockResolvedValue(withImage);
    vi.mocked(productService.listProducts).mockResolvedValue([withImage]);

    await openNewProductPage();
    await fillValidProductForm(user);
    await user.upload(
      document.getElementById("imagen_producto") as HTMLInputElement,
      imageFile,
    );
    await user.click(screen.getByRole("button", { name: "Guardar producto" }));

    await waitFor(() => {
      expect(productService.createProduct).toHaveBeenCalledTimes(1);
      expect(productService.uploadProductImage).toHaveBeenCalledWith(
        14,
        imageFile,
      );
    });
  });

  it("no sube imagen al crear si no se seleccionó archivo", async () => {
    const user = userEvent.setup();
    const created: Product = {
      id: 15,
      productor_id: 1,
      codigo_interno: "GAL-001",
      nombre: "Galleta de chocolate",
      descripcion: "Galleta horneada con chips de chocolate",
      contenido_neto: "250.000",
      unidad_medida: "g",
      presentacion: "Bolsa de 10 unidades",
      ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
      activo: true,
      created_at: "2026-08-26T12:00:00Z",
    };
    vi.mocked(productService.createProduct).mockResolvedValue(created);
    vi.mocked(productService.listProducts).mockResolvedValue([created]);

    await openNewProductPage();
    await fillValidProductForm(user);
    await user.click(screen.getByRole("button", { name: "Guardar producto" }));

    await waitFor(() => {
      expect(productService.createProduct).toHaveBeenCalledTimes(1);
    });
    expect(productService.uploadProductImage).not.toHaveBeenCalled();
  });

  it("muestra error y reintento cuando falla la carga de categorías", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.listCategories)
      .mockRejectedValueOnce(new ApiError("fallo", 500))
      .mockResolvedValueOnce(mockCategories);

    await openNewProductPage();

    expect(
      await screen.findByText("No pudimos cargar las categorías disponibles."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nombre/)).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByLabelText("Pastelería")).toBeInTheDocument();
  });

  it("permite reintentar o continuar si falla la subida de imagen tras crear", async () => {
    const user = userEvent.setup();
    const created: Product = {
      id: 20,
      productor_id: 1,
      codigo_interno: "GAL-001",
      nombre: "Galleta de chocolate",
      descripcion: "Galleta horneada con chips de chocolate",
      contenido_neto: "250.000",
      unidad_medida: "g",
      presentacion: "Bolsa de 10 unidades",
      ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
      activo: true,
      created_at: "2026-08-26T12:00:00Z",
    };
    const imageFile = new File(["png"], "galleta.png", { type: "image/png" });
    vi.mocked(productService.createProduct).mockResolvedValue(created);
    vi.mocked(productService.uploadProductImage)
      .mockRejectedValueOnce(new ApiError("fallo imagen", 422))
      .mockResolvedValueOnce({ ...created, imagen_url: "/uploads/products/p20.png" });
    vi.mocked(productService.listProducts).mockResolvedValue([created]);

    await openNewProductPage();
    await fillValidProductForm(user);
    await user.upload(
      document.getElementById("imagen_producto") as HTMLInputElement,
      imageFile,
    );
    await user.click(screen.getByRole("button", { name: "Guardar producto" }));

    expect(
      await screen.findByText(
        "El producto se creó, pero no pudimos subir la imagen.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar subida" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar al producto" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar subida" }));

    await waitFor(() => {
      expect(productService.uploadProductImage).toHaveBeenCalledTimes(2);
    });
    expect(
      await screen.findByRole("heading", { name: "Productos", level: 1 }),
    ).toBeInTheDocument();
  });
});

describe("Productos HU01 — detalle y edición", () => {
  const galeta = mockProducts[2];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setupAuthenticated();
    vi.mocked(productService.listProducts).mockResolvedValue(mockProducts);
    vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
    vi.mocked(productService.getProduct).mockReset();
    vi.mocked(productService.updateProduct).mockReset();
    vi.mocked(productService.uploadProductImage).mockReset();
    vi.mocked(productService.deleteProduct).mockReset();
  });

  it("requiere autenticación para detalle", async () => {
    localStorage.clear();
    vi.mocked(authService.getCurrentProductor).mockRejectedValue(
      Object.assign(new Error("No autenticado"), { status: 401 }),
    );

    renderWithProviders(<App />, { initialEntries: ["/productos/1"] });
    expect(
      await screen.findByRole("heading", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
  });

  it("requiere autenticación para edición", async () => {
    localStorage.clear();
    vi.mocked(authService.getCurrentProductor).mockRejectedValue(
      Object.assign(new Error("No autenticado"), { status: 401 }),
    );

    renderWithProviders(<App />, { initialEntries: ["/productos/1/editar"] });
    expect(
      await screen.findByRole("heading", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
  });

  it("muestra loading y luego el detalle del producto", async () => {
    let resolveProduct!: (value: Product) => void;
    vi.mocked(productService.getProduct).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProduct = resolve;
        }),
    );

    renderWithProviders(<App />, { initialEntries: ["/productos/1"] });
    expect(await screen.findByText("Cargando producto...")).toBeInTheDocument();

    resolveProduct(galeta);

    expect(
      await screen.findByRole("heading", {
        name: "Galleta de chocolate",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Información general")).toBeInTheDocument();
    expect(screen.getAllByText("GAL-001").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Galleta con cobertura"),
    ).toBeInTheDocument();
    expect(screen.getByText("250 g")).toBeInTheDocument();
    expect(screen.getByText("Bolsa de 10 unidades")).toBeInTheDocument();
    expect(screen.getByText("Pastelería")).toBeInTheDocument();
    expect(screen.getByText("Dulce")).toBeInTheDocument();
    expect(screen.getAllByText("No informado").length).toBeGreaterThanOrEqual(2);
  });

  it("muestra costo y precio informados en el detalle", async () => {
    const productWithPricing: Product = {
      ...galeta,
      costo_produccion: "12.50",
      precio_venta: "25.00",
    };
    vi.mocked(productService.getProduct).mockResolvedValue(productWithPricing);

    renderWithProviders(<App />, { initialEntries: ["/productos/1"] });

    expect(
      await screen.findByRole("heading", {
        name: "Galleta de chocolate",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("12,5")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("muestra placeholder cuando el producto no tiene imagen", async () => {
    vi.mocked(productService.getProduct).mockResolvedValue(galeta);

    renderWithProviders(<App />, { initialEntries: ["/productos/1"] });

    expect(
      await screen.findByRole("heading", {
        name: "Galleta de chocolate",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sin imagen principal")).toBeInTheDocument();
  });

  it("muestra la imagen principal cuando existe imagen_url", async () => {
    const withImage: Product = {
      ...galeta,
      imagen_url: "/uploads/products/p1_test.png",
    };
    vi.mocked(productService.getProduct).mockResolvedValue(withImage);

    renderWithProviders(<App />, { initialEntries: ["/productos/1"] });

    expect(
      await screen.findByRole("heading", {
        name: "Galleta de chocolate",
        level: 1,
      }),
    ).toBeInTheDocument();
    const image = screen.getByRole("img", {
      name: "Imagen de Galleta de chocolate",
    });
    expect(image).toHaveAttribute(
      "src",
      "http://localhost:8000/uploads/products/p1_test.png",
    );
  });

  it("muestra Producto no disponible ante 404 y permite volver", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.getProduct).mockRejectedValue(
      new ApiError("No encontrado", 404),
    );

    renderWithProviders(<App />, { initialEntries: ["/productos/999"] });

    expect(
      await screen.findByRole("heading", { name: "Producto no disponible." }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Volver a productos" }));
    expect(
      await screen.findByRole("heading", { name: "Productos", level: 1 }),
    ).toBeInTheDocument();
  });

  it("navega a edición desde el detalle", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.getProduct).mockResolvedValue(galeta);

    renderWithProviders(<App />, { initialEntries: ["/productos/1"] });
    expect(
      await screen.findByRole("heading", { name: "Galleta de chocolate" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Editar producto" }));

    expect(
      await screen.findByRole("heading", { name: "Editar producto", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Código interno/)).toHaveValue("GAL-001");
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue("Galleta de chocolate");
    expect(screen.getByLabelText(/Descripción/)).toHaveValue(
      "Galleta con cobertura",
    );
    expect(screen.getByLabelText(/Contenido neto/)).toHaveValue("250");
    expect(screen.getByLabelText(/Unidad de medida/)).toHaveValue("g");
    expect(screen.getByLabelText(/^Presentación$/)).toHaveValue(
      "Bolsa de 10 unidades",
    );
    expect(screen.getByLabelText("Pastelería")).toBeChecked();
    expect(screen.getByLabelText("Dulce")).toBeChecked();
  });

  it("permite quitar todas las categorías y envía categoria_ids vacío", async () => {
    const user = userEvent.setup();
    const updated: Product = {
      ...galeta,
      categorias: [],
    };

    vi.mocked(productService.getProduct)
      .mockResolvedValueOnce(galeta)
      .mockResolvedValueOnce(updated);
    vi.mocked(productService.updateProduct).mockResolvedValue(updated);

    renderWithProviders(<App />, { initialEntries: ["/productos/1/editar"] });
    expect(
      await screen.findByRole("heading", { name: "Editar producto" }),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText("Pastelería"));
    await user.click(screen.getByLabelText("Dulce"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(productService.updateProduct).toHaveBeenCalledWith(1, {
        categoria_ids: [],
      });
    });

    expect(await screen.findByText("Sin categorías")).toBeInTheDocument();
  });

  it("permite editar costo y precio, y limpiarlos con PATCH null", async () => {
    const user = userEvent.setup();
    const pricedGaleta: Product = {
      ...galeta,
      costo_produccion: "10.00",
      precio_venta: "20.00",
    };
    const cleared: Product = {
      ...pricedGaleta,
      costo_produccion: null,
      precio_venta: null,
    };

    vi.mocked(productService.getProduct)
      .mockResolvedValueOnce(pricedGaleta)
      .mockResolvedValueOnce(cleared);
    vi.mocked(productService.updateProduct).mockResolvedValue(cleared);

    renderWithProviders(<App />, { initialEntries: ["/productos/1/editar"] });
    expect(
      await screen.findByRole("heading", { name: "Editar producto" }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/Costo de producción/)).toHaveValue("10");
    expect(screen.getByLabelText(/Precio de venta/)).toHaveValue("20");

    await user.clear(screen.getByLabelText(/Costo de producción/));
    await user.clear(screen.getByLabelText(/Precio de venta/));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(productService.updateProduct).toHaveBeenCalledWith(1, {
        costo_produccion: null,
        precio_venta: null,
      });
    });

    expect(
      await screen.findByRole("heading", {
        name: "Galleta de chocolate",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("No informado").length).toBeGreaterThanOrEqual(2);
  });

  it("envía PATCH parcial, elimina presentación y vuelve al detalle actualizado", async () => {
    const user = userEvent.setup();
    const updated: Product = {
      ...galeta,
      nombre: "Galleta de chocolate premium",
      presentacion: null,
    };

    vi.mocked(productService.getProduct)
      .mockResolvedValueOnce(galeta)
      .mockResolvedValueOnce(updated);
    vi.mocked(productService.updateProduct).mockResolvedValue(updated);

    renderWithProviders(<App />, { initialEntries: ["/productos/1/editar"] });

    expect(
      await screen.findByRole("heading", { name: "Editar producto" }),
    ).toBeInTheDocument();

    const nombre = screen.getByLabelText(/^Nombre/);
    await user.clear(nombre);
    await user.type(nombre, "Galleta de chocolate premium");
    await user.clear(screen.getByLabelText(/^Presentación$/));

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(productService.updateProduct).toHaveBeenCalledTimes(1);
    });

    expect(productService.updateProduct).toHaveBeenCalledWith(1, {
      nombre: "Galleta de chocolate premium",
      presentacion: null,
    });

    expect(
      await screen.findByRole("heading", {
        name: "Galleta de chocolate premium",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Producto actualizado correctamente."),
    ).toBeInTheDocument();
    expect(screen.getByText("No especificada")).toBeInTheDocument();
  });

  it("muestra 409 en código, conserva valores ante error y evita doble envío", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.getProduct).mockResolvedValue(galeta);
    vi.mocked(productService.updateProduct)
      .mockRejectedValueOnce(
        new ApiError("Ya existe un producto con ese código interno.", 409),
      )
      .mockRejectedValueOnce(new ApiError("fallo", 500));

    renderWithProviders(<App />, { initialEntries: ["/productos/1/editar"] });
    expect(
      await screen.findByRole("heading", { name: "Editar producto" }),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Código interno/));
    await user.type(screen.getByLabelText(/Código interno/), "PAN-001");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText("Ya existe un producto con este código interno."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Código interno/)).toHaveValue("PAN-001");
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue("Galleta de chocolate");

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(
      await screen.findByText(
        "No pudimos guardar los cambios. Inténtalo nuevamente.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Código interno/)).toHaveValue("PAN-001");
  });

  it("evita doble envío mientras guarda", async () => {
    const user = userEvent.setup();
    let resolveUpdate!: (value: Product) => void;
    const renamed = { ...galeta, nombre: "Nombre temporal" };
    vi.mocked(productService.getProduct)
      .mockResolvedValueOnce(galeta)
      .mockResolvedValue(renamed);
    vi.mocked(productService.updateProduct).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    renderWithProviders(<App />, { initialEntries: ["/productos/1/editar"] });
    expect(
      await screen.findByRole("heading", { name: "Editar producto" }),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^Nombre/));
    await user.type(screen.getByLabelText(/^Nombre/), "Nombre temporal");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    expect(productService.updateProduct).toHaveBeenCalledTimes(1);

    resolveUpdate(renamed);
    expect(
      await screen.findByRole("heading", { name: "Nombre temporal", level: 1 }),
    ).toBeInTheDocument();
  });

  it("cancelar en edición vuelve al detalle sin guardar", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.getProduct).mockResolvedValue(galeta);

    renderWithProviders(<App />, { initialEntries: ["/productos/1/editar"] });
    expect(
      await screen.findByRole("heading", { name: "Editar producto" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      await screen.findByRole("heading", {
        name: "Galleta de chocolate",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(productService.updateProduct).not.toHaveBeenCalled();
  });

  it("tras editar, el listado refleja los datos actualizados", async () => {
    const user = userEvent.setup();
    const updated: Product = {
      ...galeta,
      nombre: "Galleta premium listado",
    };
    const updatedList = mockProducts.map((item) =>
      item.id === updated.id ? updated : item,
    );

    vi.mocked(productService.getProduct)
      .mockResolvedValueOnce(galeta)
      .mockResolvedValueOnce(updated);
    vi.mocked(productService.updateProduct).mockResolvedValue(updated);
    vi.mocked(productService.listProducts).mockResolvedValue(updatedList);

    renderWithProviders(<App />, { initialEntries: ["/productos/1/editar"] });
    expect(
      await screen.findByRole("heading", { name: "Editar producto" }),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^Nombre/));
    await user.type(screen.getByLabelText(/^Nombre/), "Galleta premium listado");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByRole("heading", {
        name: "Galleta premium listado",
        level: 1,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Volver a productos" }));
    expect(
      await screen.findByRole("heading", { name: "Productos", level: 1 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Producto actualizado correctamente."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Galleta premium listado").length).toBeGreaterThan(
      0,
    );
  });

  it("muestra la imagen actual en edición y sube solo si se reemplaza", async () => {
    const user = userEvent.setup();
    const withImage: Product = {
      ...galeta,
      imagen_url: "/uploads/products/p1_actual.png",
    };
    const updatedImage: Product = {
      ...withImage,
      imagen_url: "/uploads/products/p1_nueva.png",
    };
    const imageFile = new File(["png"], "nueva.png", { type: "image/png" });

    vi.mocked(productService.getProduct)
      .mockResolvedValueOnce(withImage)
      .mockResolvedValueOnce(updatedImage);
    vi.mocked(productService.uploadProductImage).mockResolvedValue(updatedImage);

    renderWithProviders(<App />, { initialEntries: ["/productos/1/editar"] });
    expect(
      await screen.findByRole("heading", { name: "Editar producto" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("img", { name: "Vista previa del producto" }),
    ).toHaveAttribute(
      "src",
      "http://localhost:8000/uploads/products/p1_actual.png",
    );

    await user.upload(
      document.getElementById("imagen_producto") as HTMLInputElement,
      imageFile,
    );
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(productService.uploadProductImage).toHaveBeenCalledWith(1, imageFile);
    });
    expect(productService.updateProduct).not.toHaveBeenCalled();
  });

  it("edición sin cambiar imagen no llama uploadProductImage", async () => {
    const user = userEvent.setup();
    const withImage: Product = {
      ...galeta,
      imagen_url: "/uploads/products/p1_actual.png",
    };
    const renamed: Product = {
      ...withImage,
      nombre: "Galleta renombrada",
    };

    vi.mocked(productService.getProduct)
      .mockResolvedValueOnce(withImage)
      .mockResolvedValueOnce(renamed);
    vi.mocked(productService.updateProduct).mockResolvedValue(renamed);

    renderWithProviders(<App />, { initialEntries: ["/productos/1/editar"] });
    expect(
      await screen.findByRole("heading", { name: "Editar producto" }),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^Nombre/));
    await user.type(screen.getByLabelText(/^Nombre/), "Galleta renombrada");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(productService.updateProduct).toHaveBeenCalledWith(1, {
        nombre: "Galleta renombrada",
      });
    });
    expect(productService.uploadProductImage).not.toHaveBeenCalled();
  });

  it("permite quitar la imagen existente y envía imagen_url null", async () => {
    const user = userEvent.setup();
    const withImage: Product = {
      ...galeta,
      imagen_url: "/uploads/products/p1_actual.png",
    };
    const withoutImage: Product = {
      ...withImage,
      imagen_url: null,
    };
    vi.mocked(productService.getProduct).mockResolvedValue(withImage);
    vi.mocked(productService.updateProduct).mockResolvedValue(withoutImage);

    renderWithProviders(<App />, { initialEntries: ["/productos/1/editar"] });
    expect(
      await screen.findByRole("heading", { name: "Editar producto" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar imagen" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(productService.updateProduct).toHaveBeenCalledWith(1, {
        imagen_url: null,
      });
    });
    expect(productService.uploadProductImage).not.toHaveBeenCalled();
  });

  it("permite continuar al producto si falla la subida de imagen tras editar", async () => {
    const user = userEvent.setup();
    const withImage: Product = {
      ...galeta,
      imagen_url: "/uploads/products/p1_actual.png",
    };
    const imageFile = new File(["png"], "nueva.png", { type: "image/png" });
    vi.mocked(productService.getProduct).mockResolvedValue(withImage);
    vi.mocked(productService.updateProduct).mockResolvedValue(withImage);
    vi.mocked(productService.uploadProductImage).mockRejectedValue(
      new ApiError("fallo imagen", 422),
    );

    renderWithProviders(<App />, { initialEntries: ["/productos/1/editar"] });
    expect(
      await screen.findByRole("heading", { name: "Editar producto" }),
    ).toBeInTheDocument();

    await user.upload(
      document.getElementById("imagen_producto") as HTMLInputElement,
      imageFile,
    );
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText(
        "Los cambios se guardaron, pero no pudimos subir la imagen.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continuar al producto" }));

    expect(
      await screen.findByRole("heading", { name: "Galleta de chocolate", level: 1 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Producto actualizado correctamente."),
    ).toBeInTheDocument();
  });

  it("edición 404 muestra producto no disponible", async () => {
    vi.mocked(productService.getProduct).mockRejectedValue(
      new ApiError("No encontrado", 404),
    );

    renderWithProviders(<App />, { initialEntries: ["/productos/999/editar"] });

    expect(
      await screen.findByRole("heading", { name: "Producto no disponible." }),
    ).toBeInTheDocument();
  });

  it("cancelar eliminación no llama al servicio", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.getProduct).mockResolvedValue(galeta);

    renderWithProviders(<App />, { initialEntries: ["/productos/1"] });
    expect(
      await screen.findByRole("heading", { name: "Galleta de chocolate" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Eliminar producto" }));
    expect(
      screen.getByRole("alertdialog", { name: "Eliminar producto" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(productService.deleteProduct).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Galleta de chocolate", level: 1 }),
    ).toBeInTheDocument();
  });

  it("confirmar eliminación vuelve al listado con mensaje de éxito", async () => {
    const user = userEvent.setup();
    const remaining = mockProducts.filter((item) => item.id !== galeta.id);
    vi.mocked(productService.getProduct).mockResolvedValue(galeta);
    vi.mocked(productService.deleteProduct).mockResolvedValue(undefined);
    vi.mocked(productService.listProducts).mockResolvedValue(remaining);

    renderWithProviders(<App />, { initialEntries: ["/productos/1"] });
    expect(
      await screen.findByRole("heading", { name: "Galleta de chocolate" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Eliminar producto" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Eliminar producto",
      }),
    );

    await waitFor(() => {
      expect(productService.deleteProduct).toHaveBeenCalledWith(1);
    });
    expect(
      await screen.findByRole("heading", { name: "Productos", level: 1 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Producto eliminado correctamente."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Galleta de chocolate")).not.toBeInTheDocument();
  });

  it("muestra error si falla la eliminación", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.getProduct).mockResolvedValue(galeta);
    vi.mocked(productService.deleteProduct).mockRejectedValue(
      new ApiError("fallo", 500),
    );

    renderWithProviders(<App />, { initialEntries: ["/productos/1"] });
    expect(
      await screen.findByRole("heading", { name: "Galleta de chocolate" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Eliminar producto" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Eliminar producto",
      }),
    );

    expect(
      await screen.findByText(
        "No pudimos eliminar el producto. Inténtalo nuevamente.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Galleta de chocolate", level: 1 }),
    ).toBeInTheDocument();
  });
});
