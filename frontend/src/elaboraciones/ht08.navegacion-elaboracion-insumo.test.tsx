/**
 * «Anterior» / «Siguiente» en los detalles de la elaboración y del insumo (T-HT08-04B / PT-HT08-14).
 * Reutilizan DetailNeighborsNav y useDetailNeighbors: aquí se comprueba el render de cada detalle con el nav,
 * el recorrido con los extremos no activos, las migas de pan fuera de PageHeader (elaboración) y los dos
 * casos que ocultan el nav del insumo sin romper el detalle: 404 (insumo inactivo) y falla de red.
 * El orden, el filtro por productor y las exclusiones se prueban en el backend.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as ingredientService from "@/services/ingredientService";
import * as insumoService from "@/services/insumoService";
import * as relacionadasService from "@/services/relacionadasService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { Elaboracion } from "@/types/elaboracion";
import type { Insumo } from "@/types/insumo";
import type { Vecinos } from "@/types/vecinos";
import { LOTES, RESULTADO_INSUMO } from "@/elaboraciones/hu08.datos";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("@/services/elaboracionService", () => ({
  listElaboraciones: vi.fn(),
  getCodigoSugerido: vi.fn(),
  createElaboracion: vi.fn(),
  getElaboracion: vi.fn(),
  listLotesInsumo: vi.fn(),
  getElaboracionNeighbors: vi.fn(),
}));

vi.mock("@/services/insumoService", () => ({
  listInsumos: vi.fn(),
  getInsumo: vi.fn(),
  deactivateInsumo: vi.fn(),
  reactivateInsumo: vi.fn(),
  actualizarPrecioDesdeJumbo: vi.fn(),
  listInsumoAlergenos: vi.fn(),
  getInsumoNeighbors: vi.fn(),
}));

vi.mock("@/services/ingredientService", () => ({
  listIngredients: vi.fn(),
  listAlergenosCatalog: vi.fn(),
}));

vi.mock("@/services/relacionadasService", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/relacionadasService")>();
  return { ...real, getElaboracionesDeInsumo: vi.fn(), getElaboracionesDeLote: vi.fn() };
});

function elaboracion(id: number, codigo: string, producto = "Queque de vainilla"): Elaboracion {
  return {
    id,
    producto: { id: 5, nombre: producto },
    version: { id: 1, numero_version: 1 },
    codigo,
    fecha: "2026-10-06",
    estado: "finalizada",
    finalizada_at: "2026-10-06T18:30:00Z",
    created_at: "2026-10-06T12:00:00Z",
    updated_at: "2026-10-06T12:00:00Z",
    usos: [],
  } as unknown as Elaboracion;
}

function insumo(id: number, nombre: string, activo = true): Insumo {
  return {
    id,
    productor_id: 1,
    ingrediente_id: 1,
    ingrediente: { id: 1, nombre: "Harina" },
    nombre,
    marca_origen: "Selecta",
    presentacion: null,
    codigo_barras: null,
    ingredientes_declarados: null,
    advertencias: null,
    ficha: null,
    fuente: "manual",
    fecha_recuperacion: null,
    habitual: false,
    activo,
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    alergenos_revisados: true,
    alergenos_revisados_at: "2026-10-01T12:00:00Z",
    alergenos_declarados: [],
  } as unknown as Insumo;
}

/** The order of each list as the backend gives it (most recent first). */
const ELABORACIONES = [
  elaboracion(33, "E-033"),
  elaboracion(32, "E-032", "Pan amasado"),
  elaboracion(31, "E-031"),
];
const INSUMOS = [insumo(23, "Harina Selecta 1 kg"), insumo(22, "Harina Collico 1 kg"), insumo(21, "Harina Mont Blanc 1 kg")];

function vecinosEn<T extends { id: number }>(lista: T[], id: number, nombre: (x: T) => string): Vecinos {
  const i = lista.findIndex((x) => x.id === id);
  const fila = (x: T | undefined) => (x ? { id: x.id, nombre: nombre(x) } : null);
  return { anterior: fila(lista[i - 1]), siguiente: fila(lista[i + 1]) };
}

const nombreElaboracion = (e: Elaboracion) => `${e.codigo} · ${e.producto.nombre}`;

function nav(nombre: string) {
  return screen.getByRole("navigation", { name: nombre });
}

function enlace(nombreNav: string, direccion: "Anterior" | "Siguiente"): HTMLElement | null {
  return within(nav(nombreNav)).queryByRole("link", { name: new RegExp(`^${direccion}`) });
}

function extremoInactivo(nombreNav: string, direccion: "Anterior" | "Siguiente") {
  expect(enlace(nombreNav, direccion)).toBeNull();
  const marcado = within(nav(nombreNav)).getByText(direccion).closest("[aria-disabled='true']");
  expect(marcado?.tagName).toBe("SPAN");
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(elaboracionService.getElaboracion).mockImplementation(async (id) => {
    const encontrada = ELABORACIONES.find((e) => e.id === id);
    if (!encontrada) throw new ApiError("Elaboración no encontrada", 404);
    return encontrada;
  });
  vi.mocked(elaboracionService.getElaboracionNeighbors).mockImplementation(async (id) =>
    vecinosEn(ELABORACIONES, id, nombreElaboracion),
  );
  vi.mocked(elaboracionService.listLotesInsumo).mockResolvedValue(LOTES);
  vi.mocked(insumoService.getInsumo).mockImplementation(async (id) => {
    const encontrado = [...INSUMOS, insumo(20, "Harina de feria", false)].find((x) => x.id === id);
    if (!encontrado) throw new ApiError("Insumo no encontrado", 404);
    return encontrado;
  });
  vi.mocked(insumoService.getInsumoNeighbors).mockImplementation(async (id) => {
    if (!INSUMOS.some((x) => x.id === id)) throw new ApiError("Insumo no encontrado", 404);
    return vecinosEn(INSUMOS, id, (x) => x.nombre);
  });
  vi.mocked(insumoService.listInsumoAlergenos).mockResolvedValue([]);
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue([]);
  vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockResolvedValue(RESULTADO_INSUMO);
});

describe("HT08 (PT-HT08-14) — detalle de la elaboración", () => {
  const NAV = "Navegación entre elaboraciones";

  it("muestra el nav junto a las migas de pan, fuera de PageHeader, con el código y el producto en el nombre", async () => {
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones/32"] });
    await screen.findByRole("heading", { name: "Elaboración E-032", level: 1 });

    await waitFor(() => expect(enlace(NAV, "Anterior")).not.toBeNull());
    expect(enlace(NAV, "Anterior")).toHaveAccessibleName("Anterior: E-033 · Queque de vainilla");
    expect(enlace(NAV, "Anterior")).toHaveAttribute("href", "/elaboraciones/33");
    expect(enlace(NAV, "Siguiente")).toHaveAccessibleName("Siguiente: E-031 · Queque de vainilla");
    // The breadcrumbs share the row with the nav (no longer inside the page header).
    const migas = screen.getByRole("navigation", { name: "Ruta de navegación" });
    expect(migas.parentElement).toBe(nav(NAV).parentElement);
    expect(within(migas).getByRole("link", { name: "Elaboraciones" })).toHaveAttribute("href", "/elaboraciones");
  });

  it("recorre del primero al último y vuelve, con los extremos no activos", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones/33"] });
    await screen.findByRole("heading", { name: "Elaboración E-033", level: 1 });
    await waitFor(() => expect(enlace(NAV, "Siguiente")).not.toBeNull());
    extremoInactivo(NAV, "Anterior");

    for (const destino of ELABORACIONES.slice(1)) {
      await waitFor(() => expect(enlace(NAV, "Siguiente")).not.toHaveAttribute("aria-disabled"));
      await user.click(enlace(NAV, "Siguiente") as HTMLElement);
      await screen.findByRole("heading", { name: `Elaboración ${destino.codigo}`, level: 1 });
    }
    await waitFor(() => extremoInactivo(NAV, "Siguiente"));

    for (const destino of [...ELABORACIONES].reverse().slice(1)) {
      await waitFor(() => expect(enlace(NAV, "Anterior")).not.toHaveAttribute("aria-disabled"));
      await user.click(enlace(NAV, "Anterior") as HTMLElement);
      await screen.findByRole("heading", { name: `Elaboración ${destino.codigo}`, level: 1 });
    }
    await waitFor(() => extremoInactivo(NAV, "Anterior"));
  });

  it("una elaboración inexistente muestra «no disponible» sin nav", async () => {
    vi.mocked(elaboracionService.getElaboracionNeighbors).mockRejectedValue(new ApiError("Elaboración no encontrada", 404));
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones/999"] });

    expect(await screen.findByRole("heading", { name: "Elaboración no disponible" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: NAV })).not.toBeInTheDocument();
  });
});

describe("HT08 (PT-HT08-14) — detalle del insumo", () => {
  const NAV = "Navegación entre insumos";

  it("muestra el nav junto a las migas de pan y recorre los activos en el orden de la lista", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/insumos/23"] });
    await screen.findByRole("heading", { name: "Harina Selecta 1 kg", level: 1 });
    await waitFor(() => expect(enlace(NAV, "Siguiente")).not.toBeNull());
    extremoInactivo(NAV, "Anterior");
    const migas = screen.getByRole("navigation", { name: "Ruta de navegación" });
    expect(migas.parentElement).toBe(nav(NAV).parentElement);

    for (const destino of INSUMOS.slice(1)) {
      await waitFor(() => expect(enlace(NAV, "Siguiente")).not.toHaveAttribute("aria-disabled"));
      expect(enlace(NAV, "Siguiente")).toHaveAccessibleName(`Siguiente: ${destino.nombre}`);
      expect(enlace(NAV, "Siguiente")).toHaveAttribute("href", `/insumos/${destino.id}`);
      await user.click(enlace(NAV, "Siguiente") as HTMLElement);
      await screen.findByRole("heading", { name: destino.nombre, level: 1 });
    }
    await waitFor(() => extremoInactivo(NAV, "Siguiente"));
    expect(enlace(NAV, "Anterior")).toHaveAttribute("href", "/insumos/22");
  });

  it("en un insumo inactivo (404 de los vecinos) no hay nav y el detalle sigue intacto", async () => {
    renderWithProviders(<App />, { initialEntries: ["/insumos/20"] });
    await screen.findByRole("heading", { name: "Harina de feria", level: 1 });

    await waitFor(() => expect(insumoService.getInsumoNeighbors).toHaveBeenCalledWith(20));
    expect(screen.queryByRole("navigation", { name: NAV })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ruta de navegación" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivar insumo" })).toBeInTheDocument(); // an inactive one is reactivated, not edited
    expect(screen.getByRole("region", { name: "Uso reciente en elaboraciones" })).toBeInTheDocument();
  });

  it("si la consulta de vecinos falla por la red, no hay nav y el detalle sigue intacto", async () => {
    vi.mocked(insumoService.getInsumoNeighbors).mockRejectedValue(new TypeError("Failed to fetch"));
    renderWithProviders(<App />, { initialEntries: ["/insumos/22"] });
    await screen.findByRole("heading", { name: "Harina Collico 1 kg", level: 1 });

    await waitFor(() => expect(insumoService.getInsumoNeighbors).toHaveBeenCalledWith(22));
    expect(screen.queryByRole("navigation", { name: NAV })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar insumo" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Uso reciente en elaboraciones" })).toBeInTheDocument();
  });
});

describe("Servicios de vecinos (solo lectura)", () => {
  it("piden con GET y token a las rutas de cada recurso", async () => {
    const apiClient = await import("@/lib/apiClient");
    const espia = vi.spyOn(apiClient, "apiRequest").mockResolvedValue({ anterior: null, siguiente: null });
    const elab = await vi.importActual<typeof import("@/services/elaboracionService")>("@/services/elaboracionService");
    const ins = await vi.importActual<typeof import("@/services/insumoService")>("@/services/insumoService");

    await elab.getElaboracionNeighbors(32);
    await ins.getInsumoNeighbors(22);

    expect(espia).toHaveBeenCalledWith("/gestion/elaboraciones/32/vecinos", { method: "GET" }, true);
    expect(espia).toHaveBeenCalledWith("/gestion/insumos/22/vecinos", { method: "GET" }, true);
    espia.mockRestore();
  });
});
