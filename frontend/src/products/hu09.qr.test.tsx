import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as productService from "@/services/productService";
import * as publicacionService from "@/services/publicacionService";
import * as qrService from "@/services/qrService";
import { EMPTY_PRODUCT_COMMERCIAL_FIELDS, mockCategories, mockProductor, paginaElaboraciones, renderWithProviders } from "@/test/testUtils";
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

vi.mock("@/services/qrService", () => ({
  obtenerQr: vi.fn(),
}));

const URL_PUBLICA = "https://trazapp.ejemplo.test/p/tok123";

const PUBLICADO: Product = {
  id: 1,
  productor_id: 1,
  codigo_interno: "GAL-001",
  nombre: "Galleta de chocolate",
  descripcion: "Galleta",
  contenido_neto: "250.000",
  unidad_medida: "g",
  presentacion: null,
  ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
  activo: true,
  created_at: "2026-08-23T12:00:00Z",
  tiene_formulacion: true,
  elaboraciones_finalizadas: 1,
  elaboraciones_visibles: 1,
  publicado: true,
  id_publico: "tok123",
  publicado_en: "2026-11-09T12:00:00Z",
  url_publica: URL_PUBLICA,
};

const DESPUBLICADO: Product = { ...PUBLICADO, publicado: false };
const NUNCA: Product = { ...PUBLICADO, publicado: false, id_publico: null, publicado_en: null, url_publica: null };
const SIN_CONFIGURACION: Product = { ...PUBLICADO, url_publica: null };

const creadas: string[] = [];
const revocadas: string[] = [];
let descargas: { download: string; href: string }[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  creadas.length = 0;
  revocadas.length = 0;
  descargas = [];
  let n = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => {
      const url = `blob:qr-${++n}`;
      creadas.push(url);
      return url;
    }),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn((url: string) => revocadas.push(url)),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    descargas.push({ download: this.download, href: this.href });
  });
  vi.mocked(qrService.obtenerQr).mockResolvedValue({ blob: new Blob(["x"], { type: "image/png" }), nombre: "qr-GAL-001.png" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function abrir(producto: Product) {
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
  vi.mocked(productService.getProduct).mockResolvedValue(producto);
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(paginaElaboraciones([]));
  const vista = renderWithProviders(<App />, { initialEntries: ["/publicaciones/1"] });
  return screen.findByRole("region", { name: "Código QR permanente" }).then((panel) => ({ panel, ...vista }));
}

describe("HU09 — panel «Código QR permanente»", () => {
  it("un producto publicado muestra la vista previa en PNG, el enlace, el ID y las dos descargas", async () => {
    const { panel } = await abrir(PUBLICADO);

    const imagen = await within(panel).findByRole("img", { name: "Código QR de Galleta de chocolate" });
    expect(imagen).toHaveAttribute("src", creadas[0]);
    expect(qrService.obtenerQr).toHaveBeenCalledWith(1, "png");
    expect(qrService.obtenerQr).not.toHaveBeenCalledWith(1, "svg");
    expect(within(panel).getByText(URL_PUBLICA)).toBeInTheDocument();
    expect(within(panel).getByText("tok123")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Descargar PNG" })).toBeEnabled();
    expect(within(panel).getByRole("button", { name: "Descargar SVG" })).toBeEnabled();
    expect(within(panel).getByRole("button", { name: "Copiar enlace" })).toBeEnabled();
  });

  it("la nota de descarga para pantallas pequeñas está bajo los botones", async () => {
    const { panel } = await abrir(PUBLICADO);

    const nota = within(panel).getByText(
      "Si la descarga no comienza, mantén presionada la imagen del QR y elige «Guardar imagen».",
    );
    expect(nota).toHaveClass("sm:hidden");
    const botones = within(panel).getByRole("button", { name: "Descargar SVG" });
    expect(botones.compareDocumentPosition(nota) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Descargar PNG descarga con el nombre que manda la API, sin abrir pestañas", async () => {
    const user = userEvent.setup();
    const abrirVentana = vi.spyOn(window, "open").mockImplementation(() => null);
    const { panel } = await abrir(PUBLICADO);
    await within(panel).findByRole("img");

    await user.click(within(panel).getByRole("button", { name: "Descargar PNG" }));

    await waitFor(() => expect(descargas).toHaveLength(1));
    expect(qrService.obtenerQr).toHaveBeenLastCalledWith(1, "png");
    expect(descargas[0].download).toBe("qr-GAL-001.png");
    expect(descargas[0].href).toMatch(/^blob:qr-/);
    expect(abrirVentana).not.toHaveBeenCalled();
  });

  it("Descargar SVG pide el SVG y, si la página no puede leer el nombre, usa el código del producto", async () => {
    const user = userEvent.setup();
    const { panel } = await abrir(PUBLICADO);
    await within(panel).findByRole("img");
    vi.mocked(qrService.obtenerQr).mockResolvedValueOnce({ blob: new Blob(["<svg/>"]), nombre: null });

    await user.click(within(panel).getByRole("button", { name: "Descargar SVG" }));

    await waitFor(() => expect(descargas).toHaveLength(1));
    expect(qrService.obtenerQr).toHaveBeenLastCalledWith(1, "svg");
    expect(descargas[0].download).toBe("qr-GAL-001.svg");
  });

  it("evita el doble envío de la descarga", async () => {
    const user = userEvent.setup();
    const { panel } = await abrir(PUBLICADO);
    await within(panel).findByRole("img");
    let resolver: (v: qrService.ArchivoQr) => void = () => {};
    vi.mocked(qrService.obtenerQr).mockReturnValueOnce(
      new Promise<qrService.ArchivoQr>((resolve) => {
        resolver = resolve;
      }),
    );

    await user.click(within(panel).getByRole("button", { name: "Descargar PNG" }));
    await user.click(within(panel).getByRole("button", { name: /Descargando/ }));

    expect(qrService.obtenerQr).toHaveBeenCalledTimes(2); // la vista previa y una sola descarga
    expect(within(panel).getByRole("button", { name: "Descargar SVG" })).toBeDisabled();
    resolver({ blob: new Blob(["x"]), nombre: "qr-GAL-001.png" });
    await waitFor(() => expect(descargas).toHaveLength(1));
  });

  it("un error al descargar se muestra en el panel", async () => {
    const user = userEvent.setup();
    const { panel } = await abrir(PUBLICADO);
    await within(panel).findByRole("img");
    vi.mocked(qrService.obtenerQr).mockRejectedValueOnce(new ApiError("x", 0));

    await user.click(within(panel).getByRole("button", { name: "Descargar PNG" }));

    expect(await within(panel).findByRole("alert")).toHaveTextContent(/No pudimos conectar con el servidor/);
    expect(descargas).toHaveLength(0);
  });

  it("copia el enlace público y lo avisa", async () => {
    const user = userEvent.setup();
    const copiar = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const { panel } = await abrir(PUBLICADO);

    await user.click(within(panel).getByRole("button", { name: "Copiar enlace" }));

    expect(copiar).toHaveBeenCalledWith(URL_PUBLICA);
    expect(await screen.findByText("Enlace copiado.")).toBeInTheDocument();
  });

  it("si no puede copiar, lo dice y deja el enlace a la vista", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denegado"));
    const { panel } = await abrir(PUBLICADO);

    await user.click(within(panel).getByRole("button", { name: "Copiar enlace" }));

    expect(await within(panel).findByRole("alert")).toHaveTextContent(/No pudimos copiar el enlace/);
    expect(within(panel).getByText(URL_PUBLICA)).toBeInTheDocument();
  });

  it("despublicado conserva el mismo enlace e ID, pero no hay imagen ni descargas", async () => {
    const { panel } = await abrir(DESPUBLICADO);

    expect(within(panel).getByText(URL_PUBLICA)).toBeInTheDocument();
    expect(within(panel).getByText("tok123")).toBeInTheDocument();
    expect(within(panel).queryByRole("img")).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Descargar PNG" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Descargar SVG" })).toBeDisabled();
    expect(within(panel).getByText(/solo se puede ver y descargar mientras el producto está publicado/)).toBeInTheDocument();
    expect(qrService.obtenerQr).not.toHaveBeenCalled();
  });

  it("un producto que nunca se publicó explica que el QR se genera al habilitar", async () => {
    const { panel } = await abrir(NUNCA);

    expect(within(panel).getByText(/se genera al habilitar la publicación/)).toBeInTheDocument();
    expect(within(panel).queryByRole("button")).not.toBeInTheDocument();
    expect(qrService.obtenerQr).not.toHaveBeenCalled();
  });

  it("con id_publico y url_publica null desactiva la vista previa, la copia y las descargas", async () => {
    const { panel } = await abrir(SIN_CONFIGURACION);

    expect(within(panel).getByRole("alert")).toHaveTextContent(/dirección pública de TrazApp no está configurada/);
    expect(within(panel).queryByRole("img")).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Copiar enlace" })).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Descargar PNG" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Descargar SVG" })).toBeDisabled();
    expect(qrService.obtenerQr).not.toHaveBeenCalled();
  });

  it("si la vista previa falla lo dice y permite reintentar", async () => {
    const user = userEvent.setup();
    vi.mocked(qrService.obtenerQr).mockReset();
    vi.mocked(qrService.obtenerQr)
      .mockRejectedValueOnce(new ApiError("x", 500))
      .mockResolvedValueOnce({ blob: new Blob(["x"]), nombre: null });
    const { panel } = await abrir(PUBLICADO);

    expect(await within(panel).findByRole("alert")).toHaveTextContent(/no pudo generar el QR/);
    await user.click(within(panel).getByRole("button", { name: "Reintentar" }));

    expect(await within(panel).findByRole("img")).toBeInTheDocument();
  });

  it("libera la dirección del blob de la vista previa al salir de la pantalla", async () => {
    const { panel, unmount } = await abrir(PUBLICADO);
    await within(panel).findByRole("img");

    unmount();

    expect(revocadas).toContain(creadas[0]);
  });

  it("al habilitar la publicación desde la misma pantalla aparece el QR", async () => {
    const user = userEvent.setup();
    vi.mocked(publicacionService.habilitarPublicacion).mockResolvedValue({
      producto_id: 1,
      publicado: true,
      id_publico: "tok123",
      publicado_en: "2026-11-09T12:00:00Z",
      url_publica: URL_PUBLICA,
    });
    const { panel } = await abrir(DESPUBLICADO);
    expect(qrService.obtenerQr).not.toHaveBeenCalled();

    await user.click(screen.getByRole("switch", { name: "Habilitar publicación" }));

    expect(await within(panel).findByRole("img")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Descargar PNG" })).toBeEnabled();
  });

  it("al deshabilitar la publicación la imagen desaparece y se libera", async () => {
    const user = userEvent.setup();
    vi.mocked(publicacionService.deshabilitarPublicacion).mockResolvedValue({
      producto_id: 1,
      publicado: false,
      id_publico: "tok123",
      publicado_en: "2026-11-09T12:00:00Z",
      url_publica: URL_PUBLICA,
    });
    const { panel } = await abrir(PUBLICADO);
    await within(panel).findByRole("img");

    await user.click(screen.getByRole("switch", { name: "Deshabilitar publicación" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Deshabilitar publicación" }));

    await waitFor(() => expect(within(panel).queryByRole("img")).not.toBeInTheDocument());
    await waitFor(() => expect(revocadas).toContain(creadas[0]));
    expect(within(panel).getByText(URL_PUBLICA)).toBeInTheDocument();
  });
});
