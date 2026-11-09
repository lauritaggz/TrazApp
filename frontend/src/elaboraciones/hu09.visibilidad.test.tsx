import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as productService from "@/services/productService";
import * as visibilidadService from "@/services/visibilidadService";
import { EMPTY_PRODUCT_COMMERCIAL_FIELDS, mockCategories, mockProductor, paginaElaboraciones, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { Elaboracion, ElaboracionResumen, ElaboracionVisibilidad } from "@/types/elaboracion";
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

vi.mock("@/services/visibilidadService", () => ({
  ocultarElaboracion: vi.fn(),
  mostrarElaboracion: vi.fn(),
}));

const PRODUCTO: Product = {
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
  elaboraciones_finalizadas: 3,
  elaboraciones_visibles: 2,
  publicado: true,
  id_publico: "tok",
  publicado_en: "2026-11-09T12:00:00Z",
  url_publica: "https://trazapp.ejemplo.test/p/tok",
};

function resumen(id: number, oculta = false): ElaboracionResumen {
  return {
    id,
    producto: { id: 1, nombre: "Galleta de chocolate" },
    version: { id: 1, numero_version: 1 },
    codigo: `E-00${id}`,
    fecha: `2026-10-0${id}`,
    estado: "finalizada",
    finalizada_at: "2026-10-01T12:00:00Z",
    total_ingredientes: 2,
    pendientes: 0,
    oculta,
  };
}

function detalle(oculta: boolean): Elaboracion {
  return {
    id: 7,
    producto: { id: 1, nombre: "Galleta de chocolate" },
    version: { id: 1, numero_version: 1 },
    codigo: "E-007",
    fecha: "2026-10-06",
    estado: "finalizada",
    finalizada_at: "2026-10-06T18:30:00Z",
    created_at: "2026-10-06T12:00:00Z",
    updated_at: "2026-10-06T12:00:00Z",
    usos: [],
    oculta,
  };
}

function respuesta(id: number, oculta: boolean): ElaboracionVisibilidad {
  return { elaboracion_id: id, oculta, oculta_at: oculta ? "2026-11-09T12:00:00Z" : null };
}

function iniciar() {
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
  vi.mocked(productService.listProducts).mockResolvedValue([PRODUCTO]);
  vi.mocked(productService.getProduct).mockResolvedValue(PRODUCTO);
}

async function abrirPublicacion(items: ElaboracionResumen[], total = items.length) {
  iniciar();
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue({ items, total, limit: 20, offset: 0 });
  renderWithProviders(<App />, { initialEntries: ["/publicaciones/1"] });
  return screen.findByRole("region", { name: "Elaboraciones finalizadas" });
}

const fila = (seccion: HTMLElement, codigo: string) => within(seccion).getByText(codigo).closest("li") as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("HU09 — Publicaciones: elaboraciones finalizadas del producto", () => {
  it("pide al historial de HU06 las finalizadas del producto y las lista con Visible / Oculta", async () => {
    const seccion = await abrirPublicacion([resumen(3), resumen(2, true), resumen(1)]);

    expect(await within(seccion).findByText("E-003")).toBeInTheDocument();
    expect(elaboracionService.listElaboraciones).toHaveBeenCalledWith({
      productoId: 1,
      estado: "finalizada",
      limit: 20,
      offset: 0,
    });
    expect(within(fila(seccion, "E-003")).getByText("Visible")).toBeInTheDocument();
    expect(within(fila(seccion, "E-002")).getByText("Oculta")).toBeInTheDocument();
    expect(within(fila(seccion, "E-002")).getByRole("switch", { name: "Mostrar E-002" })).toHaveAttribute("aria-checked", "false");
    expect(within(fila(seccion, "E-003")).getByRole("switch", { name: "Ocultar E-003" })).toHaveAttribute("aria-checked", "true");
  });

  it("«Predeterminada» va en la primera visible del orden del historial", async () => {
    const seccion = await abrirPublicacion([resumen(3, true), resumen(2), resumen(1)]);
    await within(seccion).findByText("E-002");

    expect(within(fila(seccion, "E-002")).getByText("Predeterminada")).toBeInTheDocument();
    expect(within(seccion).getAllByText("Predeterminada")).toHaveLength(1);
  });

  it("no muestra «unidades» ni la vista previa pública (son de HU10)", async () => {
    const seccion = await abrirPublicacion([resumen(3)]);
    await within(seccion).findByText("E-003");

    expect(screen.queryByText(/unidades/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vista previa pública|Comprobar ficha pública/)).not.toBeInTheDocument();
    expect(screen.getByText("La ficha pública no se puede personalizar")).toBeInTheDocument();
  });

  it("ocultar SIEMPRE pide confirmación con el texto aprobado y solo entonces oculta", async () => {
    const user = userEvent.setup();
    vi.mocked(visibilidadService.ocultarElaboracion).mockResolvedValue(respuesta(2, true));
    const seccion = await abrirPublicacion([resumen(3), resumen(2)]);
    await within(seccion).findByText("E-002");

    await user.click(within(fila(seccion, "E-002")).getByRole("switch", { name: "Ocultar E-002" }));

    const dialogo = await screen.findByRole("alertdialog");
    expect(dialogo).toHaveTextContent(
      "El consumidor no verá esta elaboración. Si es la única visible del producto, la consulta pública mostrará «información no disponible».",
    );
    expect(visibilidadService.ocultarElaboracion).not.toHaveBeenCalled();

    await user.click(within(dialogo).getByRole("button", { name: "Ocultar elaboración" }));

    expect(visibilidadService.ocultarElaboracion).toHaveBeenCalledWith(2);
    expect(await within(fila(seccion, "E-002")).findByText("Oculta")).toBeInTheDocument();
    expect(within(fila(seccion, "E-002")).getByRole("switch", { name: "Mostrar E-002" })).toBeInTheDocument();
  });

  it("cancelar la confirmación no oculta nada", async () => {
    const user = userEvent.setup();
    const seccion = await abrirPublicacion([resumen(3)]);
    await within(seccion).findByText("E-003");

    await user.click(within(fila(seccion, "E-003")).getByRole("switch", { name: "Ocultar E-003" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));

    expect(visibilidadService.ocultarElaboracion).not.toHaveBeenCalled();
    expect(within(fila(seccion, "E-003")).getByText("Visible")).toBeInTheDocument();
  });

  it("mostrar NO pide confirmación", async () => {
    const user = userEvent.setup();
    vi.mocked(visibilidadService.mostrarElaboracion).mockResolvedValue(respuesta(2, false));
    const seccion = await abrirPublicacion([resumen(3), resumen(2, true)]);
    await within(seccion).findByText("E-002");

    await user.click(within(fila(seccion, "E-002")).getByRole("switch", { name: "Mostrar E-002" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(visibilidadService.mostrarElaboracion).toHaveBeenCalledWith(2);
    expect(await within(fila(seccion, "E-002")).findByText("Visible")).toBeInTheDocument();
  });

  it("al ocultar la predeterminada, la etiqueta pasa a la siguiente visible", async () => {
    const user = userEvent.setup();
    vi.mocked(visibilidadService.ocultarElaboracion).mockResolvedValue(respuesta(3, true));
    const seccion = await abrirPublicacion([resumen(3), resumen(2)]);
    await within(seccion).findByText("E-003");
    expect(within(fila(seccion, "E-003")).getByText("Predeterminada")).toBeInTheDocument();

    await user.click(within(fila(seccion, "E-003")).getByRole("switch", { name: "Ocultar E-003" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Ocultar elaboración" }));

    await waitFor(() => expect(within(fila(seccion, "E-002")).getByText("Predeterminada")).toBeInTheDocument());
    expect(within(fila(seccion, "E-003")).queryByText("Predeterminada")).not.toBeInTheDocument();
  });

  it("evita el doble envío al ocultar", async () => {
    const user = userEvent.setup();
    let resolver: (v: ElaboracionVisibilidad) => void = () => {};
    vi.mocked(visibilidadService.ocultarElaboracion).mockReturnValue(
      new Promise<ElaboracionVisibilidad>((resolve) => {
        resolver = resolve;
      }),
    );
    const seccion = await abrirPublicacion([resumen(3)]);
    await within(seccion).findByText("E-003");
    await user.click(within(fila(seccion, "E-003")).getByRole("switch", { name: "Ocultar E-003" }));
    const confirmar = within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Ocultar elaboración" });

    await user.click(confirmar);
    await user.click(confirmar);

    expect(visibilidadService.ocultarElaboracion).toHaveBeenCalledTimes(1);
    resolver(respuesta(3, true));
    expect(await within(fila(seccion, "E-003")).findByText("Oculta")).toBeInTheDocument();
  });

  it("un error de red deja la fila como estaba y lo dice en la fila", async () => {
    const user = userEvent.setup();
    vi.mocked(visibilidadService.mostrarElaboracion).mockRejectedValue(new ApiError("sin red", 0));
    const seccion = await abrirPublicacion([resumen(2, true)]);
    await within(seccion).findByText("E-002");

    await user.click(within(fila(seccion, "E-002")).getByRole("switch", { name: "Mostrar E-002" }));

    expect(await within(fila(seccion, "E-002")).findByRole("alert")).toHaveTextContent(/No pudimos cambiar la visibilidad/);
    expect(within(fila(seccion, "E-002")).getByText("Oculta")).toBeInTheDocument();
  });

  it("«Cargar más» trae la página siguiente sin repetir elaboraciones", async () => {
    const user = userEvent.setup();
    const primera = Array.from({ length: 20 }, (_, i) => ({ ...resumen(1), id: 100 - i, codigo: `E-${100 - i}` }));
    const segunda = [{ ...resumen(1), id: 80, codigo: "E-80" }, { ...resumen(1), id: 100, codigo: "E-100" }];
    iniciar();
    vi.mocked(elaboracionService.listElaboraciones)
      .mockResolvedValueOnce({ items: primera, total: 22, limit: 20, offset: 0 })
      .mockResolvedValueOnce({ items: segunda, total: 22, limit: 20, offset: 20 });
    renderWithProviders(<App />, { initialEntries: ["/publicaciones/1"] });
    const seccion = await screen.findByRole("region", { name: "Elaboraciones finalizadas" });
    await within(seccion).findByText("E-100");
    expect(within(seccion).getByText("Mostrando 20 de 22 elaboraciones.")).toBeInTheDocument();

    await user.click(within(seccion).getByRole("button", { name: "Cargar más" }));

    expect(await within(seccion).findByText("E-80")).toBeInTheDocument();
    expect(elaboracionService.listElaboraciones).toHaveBeenLastCalledWith({
      productoId: 1,
      estado: "finalizada",
      limit: 20,
      offset: 20,
    });
    expect(within(seccion).getAllByText("E-100")).toHaveLength(1);
    // The repeated one was dropped: 21 shown of 22, so there is still something to load.
    expect(within(seccion).getByText("Mostrando 21 de 22 elaboraciones.")).toBeInTheDocument();
  });

  it("sin elaboraciones finalizadas lo dice", async () => {
    const seccion = await abrirPublicacion([]);

    expect(await within(seccion).findByText("Este producto aún no tiene elaboraciones finalizadas.")).toBeInTheDocument();
  });

  it("si no puede cargar las elaboraciones permite reintentar", async () => {
    const user = userEvent.setup();
    iniciar();
    vi.mocked(elaboracionService.listElaboraciones)
      .mockRejectedValueOnce(new ApiError("x", 0))
      .mockResolvedValueOnce(paginaElaboraciones([resumen(3)]));
    renderWithProviders(<App />, { initialEntries: ["/publicaciones/1"] });
    const seccion = await screen.findByRole("region", { name: "Elaboraciones finalizadas" });

    await user.click(await within(seccion).findByRole("button", { name: "Reintentar" }));

    expect(await within(seccion).findByText("E-003")).toBeInTheDocument();
  });
});

describe("HU09 — «Oculta al público» es informativa y solo para el productor (CA7)", () => {
  it("el historial la muestra en las elaboraciones ocultas y en ninguna otra", async () => {
    iniciar();
    vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(paginaElaboraciones([resumen(2, true), resumen(1)]));
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones"] });

    const lista = await screen.findByRole("list", { name: "Elaboraciones" });
    const oculta = (await within(lista).findByText("E-002")).closest("li") as HTMLElement;
    const visible = within(lista).getByText("E-001").closest("li") as HTMLElement;
    expect(within(oculta).getByText("Oculta al público")).toBeInTheDocument();
    expect(within(oculta).getByText("Finalizada")).toBeInTheDocument();
    expect(within(visible).queryByText("Oculta al público")).not.toBeInTheDocument();
    expect(within(oculta).getByRole("link")).toHaveAttribute("href", "/elaboraciones/2");
  });

  it("la sección de elaboraciones del producto la muestra", async () => {
    iniciar();
    vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(paginaElaboraciones([resumen(2, true), resumen(1)]));
    renderWithProviders(<App />, { initialEntries: ["/productos/1"] });

    const seccion = await screen.findByRole("region", { name: "Elaboraciones" });
    expect(await within(seccion).findByText("Oculta al público")).toBeInTheDocument();
    expect(within(seccion).getAllByText("Oculta al público")).toHaveLength(1);
  });

  it("el detalle de una elaboración oculta la muestra, sigue completo y enlaza a Gestionar visibilidad", async () => {
    iniciar();
    vi.mocked(elaboracionService.getElaboracion).mockResolvedValue(detalle(true));
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones/7"] });

    expect(await screen.findByRole("heading", { name: "Elaboración E-007", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Oculta al público")).toBeInTheDocument();
    expect(screen.getByText("Finalizada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gestionar visibilidad" })).toHaveAttribute("href", "/publicaciones/1");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ocultar|Mostrar/ })).not.toBeInTheDocument();
  });

  it("el detalle de una elaboración visible no lleva la etiqueta pero sí el enlace", async () => {
    iniciar();
    vi.mocked(elaboracionService.getElaboracion).mockResolvedValue(detalle(false));
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones/7"] });

    await screen.findByRole("heading", { name: "Elaboración E-007", level: 1 });
    expect(screen.queryByText("Oculta al público")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gestionar visibilidad" })).toBeInTheDocument();
  });
});
