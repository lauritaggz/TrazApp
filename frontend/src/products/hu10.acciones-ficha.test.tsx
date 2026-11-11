import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as productService from "@/services/productService";
import * as publicacionService from "@/services/publicacionService";
import {
  EMPTY_PRODUCT_COMMERCIAL_FIELDS,
  mockCategories,
  mockProductor,
  paginaElaboraciones,
  renderWithProviders,
} from "@/test/testUtils";
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
  previsualizarFichaPublica: vi.fn(),
}));

const URL_PUBLICA = "https://trazapp.ejemplo.test/p/abc123XYZ";

const SIN_PUBLICAR: Product = {
  id: 1,
  productor_id: 1,
  codigo_interno: "GAL-001",
  nombre: "Galleta de chocolate",
  descripcion: "Galleta con cobertura",
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
};

const PUBLICADO: Product = {
  ...SIN_PUBLICAR,
  publicado: true,
  id_publico: "abc123XYZ",
  publicado_en: "2026-11-07T12:00:00Z",
  url_publica: URL_PUBLICA,
};

const ESTADO_DESPUBLICADO: Publicacion = {
  producto_id: 1,
  publicado: false,
  id_publico: "abc123XYZ",
  publicado_en: "2026-11-07T12:00:00Z",
  url_publica: URL_PUBLICA,
};

async function abrirDetalle(producto: Product) {
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(paginaElaboraciones([]));
  vi.mocked(productService.getProduct).mockResolvedValue(producto);
  renderWithProviders(<App />, { initialEntries: ["/publicaciones/1"] });
  return screen.findByRole("region", { name: "Estado de publicación" });
}

const vistaPrevia = () => screen.getByRole("link", { name: "Vista previa pública" });
const comprobar = () => screen.queryByRole("link", { name: /Comprobar ficha pública/ });

describe("botones de la ficha pública en el detalle de Publicaciones (HU10, T10-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("«Vista previa pública» está disponible con el producto sin publicar y lleva a la vista previa", async () => {
    await abrirDetalle(SIN_PUBLICAR);

    expect(vistaPrevia()).toHaveAttribute("href", "/publicaciones/1/vista-previa");
  });

  it("«Vista previa pública» también está disponible con el producto publicado", async () => {
    await abrirDetalle(PUBLICADO);

    expect(vistaPrevia()).toHaveAttribute("href", "/publicaciones/1/vista-previa");
  });

  it("«Comprobar ficha pública» abre el enlace público en una pestaña nueva, con rel seguro", async () => {
    await abrirDetalle(PUBLICADO);

    const enlace = comprobar();
    expect(enlace).toHaveAttribute("href", URL_PUBLICA);
    expect(enlace).toHaveAttribute("target", "_blank");
    expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
    expect(enlace).toHaveTextContent(/se abre en una pestaña nueva/);
  });

  it("«Comprobar ficha pública» no aparece con el producto sin publicar", async () => {
    await abrirDetalle(SIN_PUBLICAR);

    expect(comprobar()).not.toBeInTheDocument();
  });

  it("no aparece si el producto fue despublicado, aunque conserve su enlace (url_publica no es null)", async () => {
    await abrirDetalle({ ...PUBLICADO, publicado: false });

    expect(PUBLICADO.url_publica).not.toBeNull();
    expect(comprobar()).not.toBeInTheDocument();
    expect(vistaPrevia()).toBeInTheDocument();
  });

  it("no aparece si está publicado pero el servidor no pudo armar el enlace (url_publica es null)", async () => {
    await abrirDetalle({ ...PUBLICADO, url_publica: null });

    expect(comprobar()).not.toBeInTheDocument();
    expect(vistaPrevia()).toBeInTheDocument();
  });

  it("al deshabilitar la publicación desaparece «Comprobar ficha pública» y queda la vista previa", async () => {
    const user = userEvent.setup();
    vi.mocked(publicacionService.deshabilitarPublicacion).mockResolvedValue(ESTADO_DESPUBLICADO);
    const seccion = await abrirDetalle(PUBLICADO);
    expect(comprobar()).toBeInTheDocument();

    await user.click(within(seccion).getByRole("switch", { name: "Deshabilitar publicación" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Deshabilitar publicación" }));

    await within(seccion).findByRole("switch", { name: "Habilitar publicación" });
    expect(comprobar()).not.toBeInTheDocument();
    expect(vistaPrevia()).toBeInTheDocument();
  });
});
