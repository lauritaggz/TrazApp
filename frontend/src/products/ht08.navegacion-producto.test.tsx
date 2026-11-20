/**
 * «Anterior» / «Siguiente» del detalle del producto (T-HT08-04 / HT08, CA8–CA10).
 * PT-HT08-09: recorrido del primero al último y de vuelta, en el orden de la lista, con los extremos no
 * activos; un solo producto sin botones activos; mientras cargan los vecinos nuevos los enlaces siguen en
 * su lugar, aria-disabled, sin navegar y sin perder el foco; si falla la consulta, no se muestra.
 * (PT-HT08-10 y los archivados se prueban en el backend: el endpoint solo devuelve vecinos propios y activos.)
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as productService from "@/services/productService";
import {
  EMPTY_PRODUCT_COMMERCIAL_FIELDS,
  mockCategories,
  mockProductor,
  paginaElaboraciones,
  renderWithProviders,
} from "@/test/testUtils";
import type { Product } from "@/types/product";
import type { Vecinos as ProductoVecinos } from "@/types/vecinos";

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
  getProductNeighbors: vi.fn(),
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
  // HT08: the elaboración detail loads its «Anterior» / «Siguiente» neighbours.
  getElaboracionNeighbors: vi.fn().mockResolvedValue({ anterior: null, siguiente: null }),
}));

function producto(id: number, nombre: string): Product {
  return {
    id,
    productor_id: 1,
    codigo_interno: `COD-${id}`,
    nombre,
    descripcion: null,
    contenido_neto: "250.000",
    unidad_medida: "g",
    presentacion: null,
    ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
    categorias: [],
    costo_produccion: null,
    precio_venta: null,
    activo: true,
    created_at: "2026-11-01T12:00:00Z",
    tiene_formulacion: true,
  };
}

/** The order of the list as the backend gives it (most recent first). */
const LISTA = [producto(40, "Donut"), producto(30, "Chilenito"), producto(20, "Berlín"), producto(10, "Alfajor")];

function vecinosEn(lista: Product[], id: number): ProductoVecinos {
  const i = lista.findIndex((p) => p.id === id);
  const fila = (p: Product | undefined) => (p ? { id: p.id, nombre: p.nombre } : null);
  return { anterior: fila(lista[i - 1]), siguiente: fila(lista[i + 1]) };
}

function usarLista(lista: Product[]) {
  vi.mocked(productService.getProduct).mockImplementation(async (id) => {
    const encontrado = lista.find((p) => p.id === id);
    if (!encontrado) throw new Error("no encontrado");
    return encontrado;
  });
  vi.mocked(productService.getProductNeighbors).mockImplementation(async (id) => vecinosEn(lista, id));
}

const navegacion = () => screen.getByRole("navigation", { name: "Navegación entre productos" });
const titulo = (nombre: string) => screen.findByRole("heading", { name: nombre, level: 1 });

/** «Anterior» or «Siguiente» when it is a link; null when it is not active (aria-disabled span). */
function enlace(direccion: "Anterior" | "Siguiente"): HTMLElement | null {
  return within(navegacion()).queryByRole("link", { name: new RegExp(`^${direccion}`) });
}

function extremoInactivo(direccion: "Anterior" | "Siguiente") {
  expect(enlace(direccion)).toBeNull();
  const marcado = within(navegacion()).getByText(direccion).closest("[aria-disabled='true']");
  expect(marcado).not.toBeNull();
  expect(marcado?.tagName).toBe("SPAN");
}

async function abrir(id: number) {
  renderWithProviders(<App />, { initialEntries: [`/productos/${id}`] });
  await titulo(LISTA.find((p) => p.id === id)?.nombre ?? "");
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(paginaElaboraciones([]));
  usarLista(LISTA);
});

describe("HT08 (PT-HT08-09) — «Anterior» y «Siguiente» en el detalle del producto", () => {
  it("recorre del primero al último con «Siguiente» y vuelve con «Anterior», en el orden de la lista", async () => {
    const user = userEvent.setup();
    await abrir(40);
    await waitFor(() => expect(enlace("Siguiente")).not.toBeNull());
    extremoInactivo("Anterior");

    for (const destino of LISTA.slice(1)) {
      const siguiente = enlace("Siguiente");
      expect(siguiente).toHaveAccessibleName(`Siguiente: ${destino.nombre}`);
      expect(siguiente).toHaveAttribute("href", `/productos/${destino.id}`);
      await user.click(siguiente as HTMLElement);
      await titulo(destino.nombre);
    }
    await waitFor(() => extremoInactivo("Siguiente"));

    for (const destino of [...LISTA].reverse().slice(1)) {
      await waitFor(() => expect(enlace("Anterior")).not.toHaveAttribute("aria-disabled"));
      const anterior = enlace("Anterior");
      expect(anterior).toHaveAccessibleName(`Anterior: ${destino.nombre}`);
      await user.click(anterior as HTMLElement);
      await titulo(destino.nombre);
    }
    await waitFor(() => extremoInactivo("Anterior"));
    expect(enlace("Siguiente")).toHaveAttribute("href", "/productos/30");
  });

  it("con un solo producto ningún botón está activo", async () => {
    usarLista([producto(10, "Alfajor")]);
    renderWithProviders(<App />, { initialEntries: ["/productos/10"] });
    await titulo("Alfajor");

    await waitFor(() => expect(within(navegacion()).getByText("Siguiente")).toBeInTheDocument());
    extremoInactivo("Anterior");
    extremoInactivo("Siguiente");
    expect(within(navegacion()).queryAllByRole("link")).toHaveLength(0);
  });

  it("mientras cargan los vecinos nuevos, los enlaces siguen en su lugar, aria-disabled y sin navegar; luego apuntan a los nuevos y el foco no se mueve", async () => {
    const user = userEvent.setup();
    let resolver: (v: ProductoVecinos) => void = () => {};
    vi.mocked(productService.getProductNeighbors).mockImplementation((id) =>
      id === 20
        ? new Promise<ProductoVecinos>((resolve) => {
            resolver = resolve;
          })
        : Promise.resolve(vecinosEn(LISTA, id)),
    );
    // Chilenito: «Anterior» Donut (40), «Siguiente» Berlín (20).
    await abrir(30);
    await waitFor(() => expect(enlace("Anterior")).not.toBeNull());

    const siguiente = enlace("Siguiente") as HTMLElement;
    const anterior = enlace("Anterior") as HTMLElement;
    await user.click(siguiente);
    await titulo("Berlín");

    // The same <a> elements stay (the pressed one keeps the focus), disabled while Berlín's neighbours load.
    expect(enlace("Siguiente")).toBe(siguiente);
    expect(enlace("Anterior")).toBe(anterior);
    expect(siguiente).toHaveFocus();
    expect(siguiente).toHaveAttribute("aria-disabled", "true");
    expect(anterior).toHaveAttribute("aria-disabled", "true");
    // «Anterior» still points to Donut (Chilenito's old neighbour): a click must not open it.
    fireEvent.click(anterior);
    await new Promise((r) => setTimeout(r, 50));
    expect(productService.getProduct).not.toHaveBeenCalledWith(40);
    expect(screen.getByRole("heading", { name: "Berlín", level: 1 })).toBeInTheDocument();

    resolver(vecinosEn(LISTA, 20));

    await waitFor(() => expect(siguiente).not.toHaveAttribute("aria-disabled"));
    expect(enlace("Siguiente")).toBe(siguiente);
    expect(siguiente).toHaveAttribute("href", "/productos/10");
    expect(siguiente).toHaveAccessibleName("Siguiente: Alfajor");
    expect(anterior).toHaveAttribute("href", "/productos/30");
    expect(anterior).toHaveAccessibleName("Anterior: Chilenito");
    expect(siguiente).toHaveFocus();
  });

  it("descarta la respuesta de un producto anterior que llega tarde", async () => {
    const user = userEvent.setup();
    const pendientes = new Map<number, (v: ProductoVecinos) => void>();
    vi.mocked(productService.getProductNeighbors).mockImplementation((id) =>
      id === 40
        ? Promise.resolve(vecinosEn(LISTA, 40))
        : new Promise<ProductoVecinos>((resolve) => pendientes.set(id, resolve)),
    );
    await abrir(40);
    await waitFor(() => expect(enlace("Siguiente")).not.toBeNull());
    await user.click(enlace("Siguiente") as HTMLElement);
    await titulo("Chilenito");
    // Chilenito answers with Berlín as «Siguiente»; move on to Berlín before Berlín's own answer.
    pendientes.get(30)?.(vecinosEn(LISTA, 30));
    await waitFor(() => expect(enlace("Siguiente")).toHaveAttribute("href", "/productos/20"));
    await user.click(enlace("Siguiente") as HTMLElement);
    await titulo("Berlín");

    // A late answer for Chilenito again must not enable the links for Berlín.
    pendientes.get(30)?.(vecinosEn(LISTA, 30));
    expect(enlace("Siguiente")).toHaveAttribute("aria-disabled", "true");

    pendientes.get(20)?.(vecinosEn(LISTA, 20));
    await waitFor(() => expect(enlace("Siguiente")).toHaveAttribute("href", "/productos/10"));
    expect(enlace("Siguiente")).not.toHaveAttribute("aria-disabled");
  });

  it("si falla la consulta de vecinos, la navegación no se muestra y el detalle sigue intacto", async () => {
    vi.mocked(productService.getProductNeighbors).mockRejectedValue(new Error("falla"));

    await abrir(30);

    await waitFor(() => expect(productService.getProductNeighbors).toHaveBeenCalledWith(30));
    expect(screen.queryByRole("navigation", { name: "Navegación entre productos" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar producto" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ruta de navegación" })).toBeInTheDocument();
  });

  it("el servicio pide los vecinos con GET y token", async () => {
    const real = await vi.importActual<typeof import("@/services/productService")>("@/services/productService");
    const apiClient = await import("@/lib/apiClient");
    const espia = vi.spyOn(apiClient, "apiRequest").mockResolvedValue({ anterior: null, siguiente: null });

    await real.getProductNeighbors(30);

    expect(espia).toHaveBeenCalledWith("/gestion/productos/30/vecinos", { method: "GET" }, true);
    espia.mockRestore();
  });
});
