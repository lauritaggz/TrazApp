import { screen, waitFor, within } from "@testing-library/react";
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

const BASE: Product = {
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
  ...BASE,
  publicado: true,
  id_publico: "abc123XYZ",
  publicado_en: "2026-11-07T12:00:00Z",
  url_publica: "https://trazapp.ejemplo.test/p/abc123XYZ",
};

const ESTADO_PUBLICADO: Publicacion = {
  producto_id: 1,
  publicado: true,
  id_publico: "abc123XYZ",
  publicado_en: "2026-11-07T12:00:00Z",
  url_publica: "https://trazapp.ejemplo.test/p/abc123XYZ",
};

function iniciarSesion() {
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(paginaElaboraciones([]));
}

async function abrirDetallePublicacion(producto: Product) {
  iniciarSesion();
  vi.mocked(productService.getProduct).mockResolvedValue(producto);
  renderWithProviders(<App />, { initialEntries: ["/publicaciones/1"] });
  return screen.findByRole("region", { name: "Estado de publicación" });
}

function conflicto(faltantes: string[]) {
  return new ApiError("El producto aún no cumple los requisitos para publicarse.", 409, {}, {
    mensaje: "El producto aún no cumple los requisitos para publicarse.",
    faltantes,
  });
}

const interruptor = (seccion: HTMLElement, nombre: string | RegExp) => within(seccion).getByRole("switch", { name: nombre });

describe("HU09 — bloque de publicación en el detalle del producto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("muestra la insignia y un enlace a Gestionar publicación, sin controles duplicados", async () => {
    iniciarSesion();
    vi.mocked(productService.getProduct).mockResolvedValue(PUBLICADO);
    renderWithProviders(<App />, { initialEntries: ["/productos/1"] });

    const bloque = await screen.findByRole("region", { name: "Publicación" });

    expect(within(bloque).getByText("Publicado")).toBeInTheDocument();
    expect(within(bloque).getByRole("link", { name: "Gestionar publicación" })).toHaveAttribute("href", "/publicaciones/1");
    expect(within(bloque).queryByRole("switch")).not.toBeInTheDocument();
    expect(within(bloque).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ver QR/)).not.toBeInTheDocument();
  });

  it("un producto sin publicar muestra «No publicado»", async () => {
    iniciarSesion();
    vi.mocked(productService.getProduct).mockResolvedValue(BASE);
    renderWithProviders(<App />, { initialEntries: ["/productos/1"] });

    const bloque = await screen.findByRole("region", { name: "Publicación" });

    expect(within(bloque).getByText("No publicado")).toBeInTheDocument();
  });
});

describe("HU09 — detalle de la publicación de un producto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("tiene «Volver a Publicaciones», el título con su insignia y el interruptor", async () => {
    const seccion = await abrirDetallePublicacion(BASE);

    expect(screen.getByRole("link", { name: /Volver a Publicaciones/ })).toHaveAttribute("href", "/publicaciones");
    expect(screen.getByRole("heading", { name: "Galleta de chocolate", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("No publicado").length).toBeGreaterThan(0);
    expect(interruptor(seccion, "Habilitar publicación")).toHaveAttribute("aria-checked", "false");
    expect(interruptor(seccion, "Habilitar publicación")).toBeEnabled();
  });

  it("habilitar con éxito deja el producto publicado", async () => {
    const user = userEvent.setup();
    vi.mocked(publicacionService.habilitarPublicacion).mockResolvedValue(ESTADO_PUBLICADO);
    const seccion = await abrirDetallePublicacion(BASE);

    await user.click(interruptor(seccion, "Habilitar publicación"));

    expect(publicacionService.habilitarPublicacion).toHaveBeenCalledWith(1);
    expect(await within(seccion).findByRole("switch", { name: "Deshabilitar publicación" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(seccion).getByText("Visible para consumidores")).toBeInTheDocument();
  });

  it("el 409 lista TODOS los requisitos faltantes, cada uno con su enlace", async () => {
    const user = userEvent.setup();
    vi.mocked(publicacionService.habilitarPublicacion).mockRejectedValue(
      conflicto(["sin_formulacion", "sin_elaboracion_finalizada"]),
    );
    const seccion = await abrirDetallePublicacion(BASE);

    await user.click(interruptor(seccion, "Habilitar publicación"));

    const aviso = await within(seccion).findByRole("alert");
    expect(within(aviso).getByText("Este producto todavía no se puede publicar")).toBeInTheDocument();
    expect(within(aviso).getAllByRole("listitem")).toHaveLength(2);
    expect(within(aviso).getByRole("link", { name: /Falta la formulación/ })).toHaveAttribute(
      "href",
      "/productos/1#product-detail-formulation",
    );
    expect(within(aviso).getByRole("link", { name: /Falta una elaboración finalizada/ })).toHaveAttribute(
      "href",
      "/elaboraciones?producto=1",
    );
  });

  it("con un solo requisito faltante lista solo ese", async () => {
    const user = userEvent.setup();
    vi.mocked(publicacionService.habilitarPublicacion).mockRejectedValue(conflicto(["sin_elaboracion_finalizada"]));
    const seccion = await abrirDetallePublicacion(BASE);

    await user.click(interruptor(seccion, "Habilitar publicación"));

    const aviso = await within(seccion).findByRole("alert");
    expect(within(aviso).getAllByRole("listitem")).toHaveLength(1);
    expect(within(aviso).queryByText(/formulación/)).not.toBeInTheDocument();
  });

  it("un producto que no cumple los requisitos tiene el interruptor desactivado y dice qué falta", async () => {
    const seccion = await abrirDetallePublicacion({ ...BASE, tiene_formulacion: false, elaboraciones_finalizadas: 0, elaboraciones_visibles: 0 });

    expect(interruptor(seccion, "Habilitar publicación")).toBeDisabled();
    expect(within(within(seccion).getByRole("alert")).getAllByRole("listitem")).toHaveLength(2);
  });

  it("deshabilitar pide confirmación y explica que el QR impreso seguirá funcionando", async () => {
    const user = userEvent.setup();
    vi.mocked(publicacionService.deshabilitarPublicacion).mockResolvedValue({ ...ESTADO_PUBLICADO, publicado: false });
    const seccion = await abrirDetallePublicacion({ ...PUBLICADO, url_publica: PUBLICADO.url_publica });

    await user.click(interruptor(seccion, "Deshabilitar publicación"));

    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText(/seguirá funcionando/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/información no disponible/)).toBeInTheDocument();
    expect(publicacionService.deshabilitarPublicacion).not.toHaveBeenCalled();

    await user.click(within(dialogo).getByRole("button", { name: "Deshabilitar publicación" }));

    expect(publicacionService.deshabilitarPublicacion).toHaveBeenCalledWith(1);
    expect(await within(seccion).findByRole("switch", { name: "Habilitar publicación" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("cancelar la confirmación no deshabilita nada", async () => {
    const user = userEvent.setup();
    const seccion = await abrirDetallePublicacion(PUBLICADO);

    await user.click(interruptor(seccion, "Deshabilitar publicación"));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));

    expect(publicacionService.deshabilitarPublicacion).not.toHaveBeenCalled();
    expect(interruptor(seccion, "Deshabilitar publicación")).toHaveAttribute("aria-checked", "true");
  });

  it("despublicado con id_publico dice que el enlace no cambia y permite volver a habilitar", async () => {
    const seccion = await abrirDetallePublicacion({ ...PUBLICADO, publicado: false });

    expect(within(seccion).getByText(/El enlace del producto no cambia/)).toBeInTheDocument();
    expect(interruptor(seccion, "Habilitar publicación")).toBeEnabled();
    expect(within(seccion).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("id_publico con url_publica null es un error visible, no un estado normal", async () => {
    const seccion = await abrirDetallePublicacion({ ...PUBLICADO, url_publica: null });

    expect(within(seccion).getByRole("alert")).toHaveTextContent(
      /dirección pública de TrazApp no está configurada en el servidor/,
    );
  });

  it("sin id_publico y sin url_publica no hay error de configuración", async () => {
    const seccion = await abrirDetallePublicacion(BASE);

    expect(within(seccion).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("evita el doble envío al habilitar: el interruptor queda desactivado y se llama una sola vez", async () => {
    const user = userEvent.setup();
    let resolver: (estado: Publicacion) => void = () => {};
    vi.mocked(publicacionService.habilitarPublicacion).mockReturnValue(
      new Promise<Publicacion>((resolve) => {
        resolver = resolve;
      }),
    );
    const seccion = await abrirDetallePublicacion(BASE);
    const boton = interruptor(seccion, "Habilitar publicación");

    await user.click(boton);
    await user.click(boton);

    expect(boton).toBeDisabled();
    expect(publicacionService.habilitarPublicacion).toHaveBeenCalledTimes(1);
    resolver(ESTADO_PUBLICADO);
    expect(await within(seccion).findByRole("switch", { name: "Deshabilitar publicación" })).toBeEnabled();
  });

  it("evita el doble envío al deshabilitar", async () => {
    const user = userEvent.setup();
    let resolver: (estado: Publicacion) => void = () => {};
    vi.mocked(publicacionService.deshabilitarPublicacion).mockReturnValue(
      new Promise<Publicacion>((resolve) => {
        resolver = resolve;
      }),
    );
    const seccion = await abrirDetallePublicacion(PUBLICADO);
    await user.click(interruptor(seccion, "Deshabilitar publicación"));
    const confirmar = within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: "Deshabilitar publicación",
    });

    await user.click(confirmar);
    await user.click(confirmar);

    expect(publicacionService.deshabilitarPublicacion).toHaveBeenCalledTimes(1);
    resolver({ ...ESTADO_PUBLICADO, publicado: false });
    await waitFor(() => expect(interruptor(seccion, "Habilitar publicación")).toBeEnabled());
  });

  it("un error de red muestra un mensaje y deja reintentar", async () => {
    const user = userEvent.setup();
    vi.mocked(publicacionService.habilitarPublicacion)
      .mockRejectedValueOnce(new ApiError("sin red", 0))
      .mockResolvedValueOnce(ESTADO_PUBLICADO);
    const seccion = await abrirDetallePublicacion(BASE);

    await user.click(interruptor(seccion, "Habilitar publicación"));
    expect(await within(seccion).findByRole("alert")).toHaveTextContent(/No pudimos conectar con el servidor/);

    await user.click(interruptor(seccion, "Habilitar publicación"));
    expect(await within(seccion).findByRole("switch", { name: "Deshabilitar publicación" })).toBeInTheDocument();
    expect(within(seccion).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("un 404 al habilitar muestra el producto como no disponible", async () => {
    const user = userEvent.setup();
    vi.mocked(publicacionService.habilitarPublicacion).mockRejectedValue(new ApiError("x", 404));
    const seccion = await abrirDetallePublicacion(BASE);

    await user.click(interruptor(seccion, "Habilitar publicación"));

    expect(await screen.findByText("Producto no disponible.")).toBeInTheDocument();
  });

  it("un producto inexistente al abrir el detalle muestra «Producto no disponible»", async () => {
    iniciarSesion();
    vi.mocked(productService.getProduct).mockRejectedValue(new ApiError("x", 404));
    renderWithProviders(<App />, { initialEntries: ["/publicaciones/99"] });

    expect(await screen.findByText("Producto no disponible.")).toBeInTheDocument();
  });
});

describe("HU09 — estado de publicación en el listado de productos (PT09-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    iniciarSesion();
  });

  it("cada producto muestra si está publicado o no", async () => {
    vi.mocked(productService.listProducts).mockResolvedValue([
      { ...PUBLICADO, id: 2, nombre: "Pan integral", codigo_interno: "PAN-001" },
      { ...BASE, id: 1 },
    ]);
    renderWithProviders(<App />, { initialEntries: ["/productos"] });

    const cards = (await screen.findAllByRole("link", { name: "Ver producto Pan integral" }))
      .map((enlace) => enlace.closest("article, tr"))
      .filter((c): c is Element => c !== null);
    const otras = screen
      .getAllByRole("link", { name: "Ver producto Galleta de chocolate" })
      .map((enlace) => enlace.closest("article, tr"))
      .filter((c): c is Element => c !== null);
    expect(cards.length).toBeGreaterThan(0);
    for (const fila of cards) {
      expect(within(fila as HTMLElement).getByText("Publicado")).toBeInTheDocument();
    }
    for (const fila of otras) {
      expect(within(fila as HTMLElement).getByText("No publicado")).toBeInTheDocument();
    }
  });
});
