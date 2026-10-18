import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { hoyChile } from "@/lib/elaboracionUtils";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as ingredientService from "@/services/ingredientService";
import * as insumoService from "@/services/insumoService";
import * as productService from "@/services/productService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { Elaboracion, ElaboracionResumen } from "@/types/elaboracion";
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
  listAlergenosCatalog: vi.fn(),
}));

vi.mock("@/services/insumoService", () => ({
  listInsumos: vi.fn(),
}));

vi.mock("@/services/elaboracionService", () => ({
  getCodigoSugerido: vi.fn(),
  createElaboracion: vi.fn(),
  listElaboraciones: vi.fn(),
  getElaboracion: vi.fn(),
  updateElaboracion: vi.fn(),
  replaceUsos: vi.fn(),
  deleteElaboracion: vi.fn(),
  finalizarElaboracion: vi.fn(),
  listLotesInsumo: vi.fn(),
}));

// --- datos ---

function producto(id: number, nombre: string, tieneFormulacion: boolean): Product {
  return {
    id,
    productor_id: 1,
    codigo_interno: `P-${id}`,
    nombre,
    descripcion: "Producto",
    contenido_neto: "250.000",
    unidad_medida: "g",
    presentacion: null,
    costo_produccion: null,
    precio_venta: "1000",
    imagen_url: "/uploads/x.png",
    categorias: [{ id: 1, nombre: "Pastelería" }],
    activo: true,
    created_at: `2026-08-${10 + id}T12:00:00Z`,
    tiene_formulacion: tieneFormulacion,
  };
}

const QUEQUE = producto(5, "Queque de vainilla", true);
const GALLETAS = producto(6, "Galletas de avena", false);
const PAN = producto(7, "Pan amasado", true);

function borrador(id: number, codigo: string, fecha: string, nombre = "Queque de vainilla", productoId = 5): ElaboracionResumen {
  return {
    id,
    producto: { id: productoId, nombre },
    version: { id: 1, numero_version: 1 },
    codigo,
    fecha,
    estado: "borrador",
    finalizada_at: null,
    total_ingredientes: 2,
    pendientes: 2,
  };
}

/** What the registro screen needs to open after a creation. */
function elaboracionCreada(id: number, codigo: string, estado: "borrador" | "finalizada" = "borrador"): Elaboracion {
  return {
    id,
    producto: { id: 5, nombre: "Queque de vainilla" },
    version: { id: 1, numero_version: 1 },
    codigo,
    fecha: "2026-10-06",
    estado,
    finalizada_at: estado === "finalizada" ? "2026-10-06T18:30:00Z" : null,
    created_at: "2026-10-06T12:00:00Z",
    updated_at: "2026-10-06T12:00:00Z",
    usos: [
      {
        ingrediente_id: 1,
        ingrediente_nombre: "Harina",
        orden: 1,
        cantidad: "500",
        unidad: "g",
        insumo: null,
        lote: null,
        lote_sugerido: null,
        sin_lote: false,
        alergenos_revisados: false,
        pendiente: true,
        falta: ["insumo", "lote"],
        insumo_desactivado: false,
        ingrediente_desactivado: false,
      },
    ],
  };
}

type Usuario = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listProducts).mockResolvedValue([QUEQUE, GALLETAS, PAN]);
  vi.mocked(productService.listCategories).mockResolvedValue([]);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([]);
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue([]);
  vi.mocked(insumoService.listInsumos).mockResolvedValue([]);
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue([]);
  vi.mocked(elaboracionService.getCodigoSugerido).mockResolvedValue({ codigo: "E-001" });
  vi.mocked(elaboracionService.listLotesInsumo).mockResolvedValue([]);
  vi.mocked(elaboracionService.getElaboracion).mockImplementation(async (id) => elaboracionCreada(id, "E-001"));
  vi.mocked(elaboracionService.createElaboracion).mockImplementation(async (_productoId, payload) =>
    elaboracionCreada(77, payload?.codigo ?? "E-001"),
  );
});

function abrirDashboard() {
  return renderWithProviders(<App />, { initialEntries: ["/dashboard"] });
}

const botonNueva = () => screen.getByRole("button", { name: "Nueva elaboración" });

async function abrirDialogo(user: Usuario) {
  await waitFor(() => expect(botonNueva()).toBeEnabled());
  await user.click(botonNueva());
  return screen.findByRole("dialog", { name: "Registrar elaboración" });
}

// --- acción «Nueva elaboración» ---

describe("Dashboard: acción «Nueva elaboración» (HT06-07)", () => {
  it("está habilitada cuando algún producto tiene formulación, sin explicación", async () => {
    abrirDashboard();
    await screen.findByRole("heading", { name: /Bienvenida/ });

    await waitFor(() => expect(botonNueva()).toBeEnabled());
    expect(screen.queryByText(/Define la formulación de un producto/)).not.toBeInTheDocument();
  });

  it("sin ningún producto con formulación está deshabilitada, explica por qué y enlaza a Productos", async () => {
    vi.mocked(productService.listProducts).mockResolvedValue([GALLETAS]);
    abrirDashboard();
    await screen.findByRole("heading", { name: /Bienvenida/ });

    await waitFor(() =>
      expect(screen.getByText(/Define la formulación de un producto para registrar elaboraciones/)).toBeInTheDocument(),
    );
    expect(botonNueva()).toBeDisabled();
    const explicacion = screen.getByText(/Define la formulación de un producto para registrar elaboraciones/);
    expect(botonNueva().getAttribute("aria-describedby")).toBe(explicacion.id);
    expect(within(explicacion).getByRole("link", { name: "Ir a Productos" })).toHaveAttribute("href", "/productos");
  });

  it("sin productos también está deshabilitada y explica por qué", async () => {
    vi.mocked(productService.listProducts).mockResolvedValue([]);
    abrirDashboard();
    await screen.findByRole("heading", { name: /Bienvenida/ });

    expect(await screen.findByText(/Define la formulación de un producto/)).toBeInTheDocument();
    expect(botonNueva()).toBeDisabled();
  });

  it("mientras carga los productos no se puede usar, y sin decir nada todavía", async () => {
    vi.mocked(productService.listProducts).mockReturnValue(new Promise(() => undefined));
    abrirDashboard();
    await screen.findByRole("heading", { name: /Bienvenida/ });

    expect(botonNueva()).toBeDisabled();
    expect(screen.queryByText(/Define la formulación de un producto/)).not.toBeInTheDocument();
  });

  it("si falla la carga de productos no se puede usar y no culpa a la formulación", async () => {
    vi.mocked(productService.listProducts).mockRejectedValue(new ApiError("falla", 500));
    abrirDashboard();

    expect(await screen.findByText("No pudimos cargar tus productos.")).toBeInTheDocument();
    expect(botonNueva()).toBeDisabled();
    expect(screen.queryByText(/Define la formulación de un producto/)).not.toBeInTheDocument();
  });

  it("abre el diálogo con un selector que solo ofrece los productos con formulación", async () => {
    const user = userEvent.setup();
    abrirDashboard();

    const dialogo = await abrirDialogo(user);

    const select = within(dialogo).getByLabelText("Producto");
    const opciones = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(opciones).toEqual(["Elige un producto", "Queque de vainilla", "Pan amasado"]);
    expect(opciones).not.toContain("Galletas de avena");
    expect(within(dialogo).getByText("Solo aparecen los productos que tienen formulación.")).toBeInTheDocument();
  });

  it("con un único producto con formulación lo deja elegido", async () => {
    vi.mocked(productService.listProducts).mockResolvedValue([QUEQUE, GALLETAS]);
    const user = userEvent.setup();
    abrirDashboard();

    const dialogo = await abrirDialogo(user);

    expect(within(dialogo).getByLabelText("Producto")).toHaveValue("5");
    await waitFor(() => expect(elaboracionService.getCodigoSugerido).toHaveBeenCalledWith(5));
  });

  it("crear el borrador navega al registro de la elaboración, igual que desde el producto", async () => {
    const user = userEvent.setup();
    abrirDashboard();
    const dialogo = await abrirDialogo(user);
    await user.selectOptions(within(dialogo).getByLabelText("Producto"), "7");
    await waitFor(() => expect(elaboracionService.getCodigoSugerido).toHaveBeenCalledWith(7));
    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-001"));

    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));

    await waitFor(() =>
      expect(elaboracionService.createElaboracion).toHaveBeenCalledWith(7, { codigo: "E-001", fecha: hoyChile() }),
    );
    expect(await screen.findByRole("heading", { name: "Elaboración E-001", level: 1 })).toBeInTheDocument();
    expect(elaboracionService.getElaboracion).toHaveBeenCalledWith(77);
  });

  it("sin elegir producto muestra el error y no crea nada", async () => {
    const user = userEvent.setup();
    abrirDashboard();
    const dialogo = await abrirDialogo(user);
    await user.type(within(dialogo).getByLabelText("Código de la elaboración"), "E-009");

    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));

    expect(await within(dialogo).findByText("Elige el producto.")).toBeInTheDocument();
    expect(elaboracionService.createElaboracion).not.toHaveBeenCalled();
  });

  it("al cambiar de producto pide el código sugerido del nuevo", async () => {
    const user = userEvent.setup();
    abrirDashboard();
    const dialogo = await abrirDialogo(user);

    await user.selectOptions(within(dialogo).getByLabelText("Producto"), "5");
    await waitFor(() => expect(elaboracionService.getCodigoSugerido).toHaveBeenLastCalledWith(5));
    await user.selectOptions(within(dialogo).getByLabelText("Producto"), "7");

    await waitFor(() => expect(elaboracionService.getCodigoSugerido).toHaveBeenLastCalledWith(7));
  });

  it("cancelar cierra el diálogo sin crear nada", async () => {
    const user = userEvent.setup();
    abrirDashboard();
    const dialogo = await abrirDialogo(user);

    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(elaboracionService.createElaboracion).not.toHaveBeenCalled();
  });
});

// --- sección «Elaboraciones en curso» ---

describe("Dashboard: sección «Elaboraciones en curso» (HT06-07)", () => {
  it("pide solo los borradores, sin filtrar por producto", async () => {
    abrirDashboard();
    await screen.findByRole("heading", { name: /Bienvenida/ });

    await waitFor(() => expect(elaboracionService.listElaboraciones).toHaveBeenCalledWith({ estado: "borrador" }));
    expect(elaboracionService.listElaboraciones).toHaveBeenCalledTimes(1);
  });

  it("muestra cada borrador con el producto, el código, la fecha y un enlace a su registro", async () => {
    vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue([
      borrador(31, "E-004", "2026-10-06", "Queque de vainilla", 5),
      borrador(32, "P-001", "2026-10-05", "Pan amasado", 7),
    ]);
    abrirDashboard();

    const region = await screen.findByRole("region", { name: "Elaboraciones en curso" });

    const items = within(region).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Queque de vainilla")).toBeInTheDocument();
    expect(within(items[0]).getByText("E-004 · 06-10-2026")).toBeInTheDocument();
    expect(
      within(items[0]).getByRole("link", { name: "Continuar elaboración E-004 de Queque de vainilla" }),
    ).toHaveAttribute("href", "/elaboraciones/31/registro");
    expect(
      within(items[1]).getByRole("link", { name: "Continuar elaboración P-001 de Pan amasado" }),
    ).toHaveAttribute("href", "/elaboraciones/32/registro");
  });

  it("el enlace abre el registro de ese borrador", async () => {
    vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue([borrador(31, "E-004", "2026-10-06")]);
    const user = userEvent.setup();
    abrirDashboard();

    await user.click(await screen.findByRole("link", { name: "Continuar elaboración E-004 de Queque de vainilla" }));

    expect(await screen.findByRole("heading", { name: "Elaboración E-001", level: 1 })).toBeInTheDocument();
    expect(elaboracionService.getElaboracion).toHaveBeenCalledWith(31);
  });

  it("sin borradores la sección no se muestra", async () => {
    vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue([]);
    abrirDashboard();
    await screen.findByText("Productos registrados");
    await waitFor(() => expect(elaboracionService.listElaboraciones).toHaveBeenCalled());

    expect(screen.queryByRole("region", { name: "Elaboraciones en curso" })).not.toBeInTheDocument();
    expect(screen.queryByText("Elaboraciones en curso")).not.toBeInTheDocument();
  });

  it("muestra como máximo 5, los más recientes primero (por fecha y, a igual fecha, el último registrado)", async () => {
    vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue([
      borrador(1, "E-001", "2026-09-01"),
      borrador(2, "E-002", "2026-10-02"),
      borrador(3, "E-003", "2026-09-20"),
      borrador(4, "E-004", "2026-10-05"),
      borrador(5, "E-005", "2026-10-05"),
      borrador(6, "E-006", "2026-08-15"),
      borrador(7, "E-007", "2026-10-03"),
    ]);
    abrirDashboard();

    const region = await screen.findByRole("region", { name: "Elaboraciones en curso" });

    const codigos = within(region)
      .getAllByRole("listitem")
      .map((item) => within(item).getByText(/^E-\d{3} · /).textContent?.slice(0, 5));
    expect(codigos).toEqual(["E-005", "E-004", "E-007", "E-002", "E-003"]);
    expect(within(region).getByText("Mostrando las 5 más recientes de 7.")).toBeInTheDocument();
  });

  it("con 5 o menos no avisa que hay más", async () => {
    vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue([
      borrador(1, "E-001", "2026-10-01"),
      borrador(2, "E-002", "2026-10-02"),
    ]);
    abrirDashboard();

    const region = await screen.findByRole("region", { name: "Elaboraciones en curso" });

    expect(within(region).queryByText(/Mostrando las/)).not.toBeInTheDocument();
  });

  it("si falla la carga de los borradores la sección no se muestra y el resto del Dashboard sigue", async () => {
    vi.mocked(elaboracionService.listElaboraciones).mockRejectedValue(new ApiError("falla", 500));
    abrirDashboard();

    expect(await screen.findByText("Productos registrados")).toBeInTheDocument();
    await waitFor(() => expect(elaboracionService.listElaboraciones).toHaveBeenCalled());
    expect(screen.queryByRole("region", { name: "Elaboraciones en curso" })).not.toBeInTheDocument();
    expect(screen.queryByText("No pudimos cargar tus productos.")).not.toBeInTheDocument();
  });
});

// --- «Registrar otra elaboración» en el detalle de una finalizada ---

describe("Detalle de una elaboración finalizada: «Registrar otra elaboración» (HT06-07)", () => {
  beforeEach(() => {
    vi.mocked(elaboracionService.getElaboracion).mockImplementation(async (id) =>
      id === 31 ? elaboracionCreada(31, "E-010", "finalizada") : elaboracionCreada(id, "E-011"),
    );
  });

  async function abrirDetalle() {
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones/31"] });
    return screen.findByRole("heading", { name: "Elaboración E-010", level: 1 });
  }

  it("ofrece el botón junto a «Volver al producto»", async () => {
    await abrirDetalle();

    expect(screen.getByRole("button", { name: "Registrar otra elaboración" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver al producto" })).toBeInTheDocument();
  });

  it("abre el diálogo con el producto ya fijado: sin selector y con el nombre del producto", async () => {
    const user = userEvent.setup();
    await abrirDetalle();

    await user.click(screen.getByRole("button", { name: "Registrar otra elaboración" }));

    const dialogo = await screen.findByRole("dialog", { name: "Registrar elaboración" });
    expect(within(dialogo).getByText("Producto: Queque de vainilla")).toBeInTheDocument();
    expect(within(dialogo).queryByLabelText("Producto")).not.toBeInTheDocument();
    await waitFor(() => expect(elaboracionService.getCodigoSugerido).toHaveBeenCalledWith(5));
  });

  it("al crear navega al registro de la nueva elaboración", async () => {
    const user = userEvent.setup();
    await abrirDetalle();
    await user.click(screen.getByRole("button", { name: "Registrar otra elaboración" }));
    const dialogo = await screen.findByRole("dialog", { name: "Registrar elaboración" });
    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-001"));

    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));

    await waitFor(() =>
      expect(elaboracionService.createElaboracion).toHaveBeenCalledWith(5, { codigo: "E-001", fecha: hoyChile() }),
    );
    // The registro of the NEW elaboración (the mock answers E-011 for any id but 31).
    expect(await screen.findByRole("heading", { name: "Elaboración E-011", level: 1 })).toBeInTheDocument();
    expect(elaboracionService.getElaboracion).toHaveBeenCalledWith(77);
  });

  it("cancelar cierra el diálogo y no crea nada", async () => {
    const user = userEvent.setup();
    await abrirDetalle();
    await user.click(screen.getByRole("button", { name: "Registrar otra elaboración" }));
    const dialogo = await screen.findByRole("dialog", { name: "Registrar elaboración" });

    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(elaboracionService.createElaboracion).not.toHaveBeenCalled();
  });

  it("si el producto ya no se puede elaborar, el error se ve dentro del diálogo", async () => {
    vi.mocked(elaboracionService.createElaboracion).mockRejectedValue(
      new ApiError("El producto no tiene formulación.", 409, {}, { mensaje: "El producto no tiene formulación." }),
    );
    const user = userEvent.setup();
    await abrirDetalle();
    await user.click(screen.getByRole("button", { name: "Registrar otra elaboración" }));
    const dialogo = await screen.findByRole("dialog", { name: "Registrar elaboración" });
    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-001"));

    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));

    expect(await within(dialogo).findByText("El producto no tiene formulación.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Registrar elaboración" })).toBeInTheDocument();
  });
});
