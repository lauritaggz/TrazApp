import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as productService from "@/services/productService";
import * as publicacionService from "@/services/publicacionService";
import { EMPTY_PRODUCT_COMMERCIAL_FIELDS, mockCategories, mockProductor, paginaElaboraciones, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { Product, Publicacion } from "@/types/product";

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
}));

vi.mock("@/services/publicacionService", () => ({
  habilitarPublicacion: vi.fn(),
  deshabilitarPublicacion: vi.fn(),
}));

function producto(id: number, nombre: string, extra: Partial<Product> = {}): Product {
  return {
    id,
    productor_id: 1,
    codigo_interno: `COD-00${id}`,
    nombre,
    descripcion: null,
    contenido_neto: "250.000",
    unidad_medida: "g",
    presentacion: null,
    ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
    activo: true,
    created_at: "2026-08-23T12:00:00Z",
    tiene_formulacion: true,
    elaboraciones_finalizadas: 2,
    elaboraciones_visibles: 2,
    publicado: false,
    id_publico: null,
    publicado_en: null,
    url_publica: null,
    ...extra,
  };
}

const LISTO = producto(1, "Mermelada de frutilla");
const PUBLICADO = producto(2, "Queso crema", {
  publicado: true,
  id_publico: "tok2",
  url_publica: "https://trazapp.ejemplo.test/p/tok2",
  elaboraciones_finalizadas: 3,
  elaboraciones_visibles: 1,
});
const SIN_FORMULACION = producto(3, "Pan de campo", { tiene_formulacion: false, elaboraciones_finalizadas: 1, elaboraciones_visibles: 1 });
const SIN_ELABORACION = producto(4, "Aceite de oliva", { elaboraciones_finalizadas: 0, elaboraciones_visibles: 0 });
const SOLO_UNA = producto(5, "Galletas", { elaboraciones_finalizadas: 1, elaboraciones_visibles: 1 });

const ESTADO: Publicacion = {
  producto_id: 1,
  publicado: true,
  id_publico: "tok1",
  publicado_en: "2026-11-09T12:00:00Z",
  url_publica: "https://trazapp.ejemplo.test/p/tok1",
};

async function abrir(productos: Product[]) {
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
  vi.mocked(productService.listProducts).mockResolvedValue(productos);
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(paginaElaboraciones([]));
  renderWithProviders(<App />, { initialEntries: ["/publicaciones"] });
  return screen.findByRole("heading", { name: "Publicaciones", level: 1 });
}

function fila(nombre: string): HTMLElement {
  return screen.getByText(nombre).closest("li") as HTMLElement;
}

describe("HU09 — menú: grupo «Herramientas»", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("«Publicaciones» está en el grupo «Herramientas» y lleva a /publicaciones; no hay Calculadora de costos", async () => {
    const user = userEvent.setup();
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
    vi.mocked(productService.listProducts).mockResolvedValue([]);
    vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
    renderWithProviders(<App />, { initialEntries: ["/productos"] });

    const nav = await screen.findByRole("navigation", { name: "Secciones" });
    expect(within(nav).getByText("Herramientas")).toBeInTheDocument();
    expect(within(nav).queryByText(/Calculadora/)).not.toBeInTheDocument();
    await user.click(within(nav).getByRole("link", { name: "Publicaciones" }));

    expect(await screen.findByRole("heading", { name: "Publicaciones", level: 1 })).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Secciones" })).getByRole("link", { name: "Publicaciones" }),
    ).toHaveAttribute("aria-current", "page");
  });
});

describe("HU09 — Publicaciones: vista general", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("muestra las tres métricas y el aviso del QR único", async () => {
    await abrir([LISTO, PUBLICADO, SIN_FORMULACION, SIN_ELABORACION]);

    expect(await screen.findByText("Productos publicados")).toBeInTheDocument();
    const metricas = screen.getAllByRole("definition").map((d) => d.textContent);
    // publicados de total · listos para publicar (formulación + al menos una finalizada) · visibles (suma)
    expect(metricas).toEqual(["1 de 4", "2", "4"]);
    expect(screen.getByText("Un QR único para toda la vida del producto")).toBeInTheDocument();
  });

  it("lista cada producto con su insignia, las elaboraciones finalizadas y «Gestionar»", async () => {
    await abrir([LISTO, PUBLICADO]);
    await screen.findByText("Queso crema");

    expect(within(fila("Queso crema")).getByText("Publicado")).toBeInTheDocument();
    expect(within(fila("Queso crema")).getByText(/3 elaboraciones finalizadas/)).toBeInTheDocument();
    expect(within(fila("Mermelada de frutilla")).getByText("No publicado")).toBeInTheDocument();
    expect(within(fila("Mermelada de frutilla")).getByText(/2 elaboraciones finalizadas/)).toBeInTheDocument();
    expect(within(fila("Queso crema")).getByRole("link", { name: /Gestionar/ })).toHaveAttribute("href", "/publicaciones/2");
  });

  it("usa el singular con una sola elaboración finalizada", async () => {
    await abrir([SOLO_UNA]);

    expect(await screen.findByText(/1 elaboración finalizada/)).toBeInTheDocument();
  });

  it("el interruptor se desactiva si falta la formulación o no hay elaboraciones finalizadas, y los indicadores son enlaces a la acción", async () => {
    await abrir([LISTO, SIN_FORMULACION, SIN_ELABORACION]);
    await screen.findByText("Pan de campo");

    expect(within(fila("Mermelada de frutilla")).getByRole("switch")).toBeEnabled();
    expect(within(fila("Pan de campo")).getByRole("switch")).toBeDisabled();
    expect(within(fila("Pan de campo")).getByRole("link", { name: /Falta la formulación/ })).toHaveAttribute(
      "href",
      "/productos/3#product-detail-formulation",
    );
    expect(within(fila("Aceite de oliva")).getByRole("switch")).toBeDisabled();
    expect(within(fila("Aceite de oliva")).getByRole("link", { name: /Falta una elaboración finalizada/ })).toHaveAttribute(
      "href",
      "/elaboraciones?producto=4",
    );
    expect(within(fila("Mermelada de frutilla")).queryByRole("link", { name: /Falta/ })).not.toBeInTheDocument();
  });

  it("un producto publicado conserva el interruptor activo aunque ya no cumpla", async () => {
    await abrir([{ ...PUBLICADO, elaboraciones_finalizadas: 0, elaboraciones_visibles: 0 }]);

    expect(await within(await screen.findByRole("list")).findByRole("switch")).toBeEnabled();
  });

  it("habilitar desde la fila deja el producto publicado y actualiza las métricas", async () => {
    const user = userEvent.setup();
    vi.mocked(publicacionService.habilitarPublicacion).mockResolvedValue(ESTADO);
    await abrir([LISTO]);

    await user.click(await within(await screen.findByText("Mermelada de frutilla").then((e) => e.closest("li") as HTMLElement)).findByRole("switch"));

    expect(publicacionService.habilitarPublicacion).toHaveBeenCalledWith(1);
    expect(await within(fila("Mermelada de frutilla")).findByText("Publicado")).toBeInTheDocument();
    expect(screen.getAllByRole("definition")[0]).toHaveTextContent("1 de 1");
  });

  it("si el 409 trae faltantes por datos que cambiaron, los muestra junto a la fila", async () => {
    const user = userEvent.setup();
    vi.mocked(publicacionService.habilitarPublicacion).mockRejectedValue(
      new ApiError("x", 409, {}, { mensaje: "x", faltantes: ["sin_formulacion", "sin_elaboracion_finalizada"] }),
    );
    await abrir([LISTO]);

    await user.click(await within((await screen.findByText("Mermelada de frutilla")).closest("li") as HTMLElement).findByRole("switch"));

    const aviso = await within(fila("Mermelada de frutilla")).findByRole("alert");
    expect(within(aviso).getAllByRole("listitem")).toHaveLength(2);
    expect(within(fila("Mermelada de frutilla")).getByText("No publicado")).toBeInTheDocument();
  });

  it("deshabilitar desde la fila pide confirmación", async () => {
    const user = userEvent.setup();
    vi.mocked(publicacionService.deshabilitarPublicacion).mockResolvedValue({ ...ESTADO, producto_id: 2, publicado: false });
    await abrir([PUBLICADO]);

    await user.click(await within((await screen.findByText("Queso crema")).closest("li") as HTMLElement).findByRole("switch"));
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText(/seguirá funcionando/)).toBeInTheDocument();
    expect(publicacionService.deshabilitarPublicacion).not.toHaveBeenCalled();

    await user.click(within(dialogo).getByRole("button", { name: "Deshabilitar publicación" }));

    expect(publicacionService.deshabilitarPublicacion).toHaveBeenCalledWith(2);
    expect(await within(fila("Queso crema")).findByText("No publicado")).toBeInTheDocument();
  });

  it("sin productos muestra el estado vacío", async () => {
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
    vi.mocked(productService.listProducts).mockResolvedValue([]);
    renderWithProviders(<App />, { initialEntries: ["/publicaciones"] });

    expect(await screen.findByText("Aún no tienes productos")).toBeInTheDocument();
  });

  it("si no puede cargar los productos lo dice y permite reintentar", async () => {
    const user = userEvent.setup();
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
    vi.mocked(productService.listProducts).mockRejectedValueOnce(new ApiError("x", 0)).mockResolvedValueOnce([LISTO]);
    renderWithProviders(<App />, { initialEntries: ["/publicaciones"] });

    expect(await screen.findByRole("alert")).toHaveTextContent(/No pudimos cargar tus productos/);
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Mermelada de frutilla")).toBeInTheDocument();
  });
});
