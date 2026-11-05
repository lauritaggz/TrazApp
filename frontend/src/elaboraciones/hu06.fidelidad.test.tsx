/**
 * Fidelity to the Sprint 3 design (T06-06 / HU06): the history (filters in a row, rows, cards) and the
 * detail of an elaboración (breadcrumbs, accordion of supplies).
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as ingredientService from "@/services/ingredientService";
import * as insumoService from "@/services/insumoService";
import * as productService from "@/services/productService";
import { mockProductor, paginaElaboraciones, renderWithProviders } from "@/test/testUtils";
import type { Elaboracion, ElaboracionResumen, UsoInsumo } from "@/types/elaboracion";

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

function resumen(id: number, estado: "borrador" | "finalizada", pendientes = 0): ElaboracionResumen {
  return {
    id,
    producto: { id: 5, nombre: "Queque de vainilla" },
    version: { id: 1, numero_version: 1 },
    codigo: `E-00${id}`,
    fecha: "2026-10-06",
    estado,
    finalizada_at: estado === "finalizada" ? "2026-10-06T18:30:00Z" : null,
    total_ingredientes: 3,
    pendientes,
  };
}

function uso(id: number, nombre: string, insumo: string, marca: string, lote: UsoInsumo["lote"]): UsoInsumo {
  return {
    ingrediente_id: id,
    ingrediente_nombre: nombre,
    orden: id,
    cantidad: null,
    unidad: null,
    insumo: {
      id: 100 + id,
      nombre: insumo,
      marca_origen: marca,
      presentacion: null,
      codigo_barras: null,
      ingredientes_declarados: `Declarados de ${insumo}`,
      advertencias: null,
      alergenos: [],
      alergenos_revisados_at: "2026-10-01T12:00:00Z",
      activo: null,
      habitual: null,
    },
    lote,
    lote_sugerido: null,
    sin_lote: lote === null,
    alergenos_revisados: true,
    pendiente: false,
    falta: [],
    insumo_desactivado: false,
    ingrediente_desactivado: false,
  };
}

const FINALIZADA: Elaboracion = {
  id: 31,
  producto: { id: 5, nombre: "Queque de vainilla" },
  version: { id: 1, numero_version: 2 },
  codigo: "E-031",
  fecha: "2026-10-06",
  estado: "finalizada",
  finalizada_at: "2026-10-06T18:30:00Z",
  created_at: "2026-10-06T12:00:00Z",
  updated_at: "2026-10-06T12:00:00Z",
  usos: [
    uso(1, "Harina", "Harina Selecta 1 kg", "Selecta", { id: 9, codigo: "H-77", fecha_vencimiento: "2027-01-15" }),
    uso(2, "Leche", "Leche Colun 1 L", "Colun", null),
    uso(3, "Azúcar", "Azúcar Iansa 1 kg", "Iansa", { id: 10, codigo: "A-12", fecha_vencimiento: null }),
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listProducts).mockResolvedValue([]);
  vi.mocked(productService.listCategories).mockResolvedValue([]);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([]);
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue([]);
  vi.mocked(insumoService.listInsumos).mockResolvedValue([]);
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(
    paginaElaboraciones([resumen(2, "finalizada"), resumen(1, "borrador", 2), resumen(3, "borrador", 0)]),
  );
  vi.mocked(elaboracionService.getElaboracion).mockResolvedValue(FINALIZADA);
});

// --- historial ---

describe("Historial: fidelidad al diseño", () => {
  async function abrirHistorial() {
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones"] });
    await screen.findByRole("list", { name: "Elaboraciones" });
  }

  it("filtros: en escritorio la búsqueda, el producto y el estado van sin etiqueta visible; «Desde» y «Hasta» se ven junto a su campo", async () => {
    await abrirHistorial();

    // Las etiquetas siguen ahí (son el nombre accesible), pero ocultas a la vista desde lg.
    expect(screen.getByText("Buscar", { selector: "label" })).toHaveClass("lg:sr-only");
    expect(screen.getByText("Producto", { selector: "label" })).toHaveClass("lg:sr-only");
    expect(screen.getByText("Estado", { selector: "label" })).toHaveClass("lg:sr-only");
    expect(screen.getByText("Desde", { selector: "label" })).not.toHaveClass("lg:sr-only");
    expect(screen.getByText("Hasta", { selector: "label" })).not.toHaveClass("lg:sr-only");
    // Cada fecha tiene la etiqueta al lado (lg), en la misma fila.
    expect(screen.getByLabelText("Desde").closest("div[class*='lg:flex-row']")).not.toBeNull();
    expect(screen.getByLabelText("Hasta").closest("div[class*='lg:flex-row']")).not.toBeNull();
    // Todo comparte una sola fila desde lg.
    const barra = screen.getByRole("searchbox", { name: "Buscar elaboración por código" }).closest("div[class*='lg:items-end']");
    expect(barra).toHaveClass("lg:flex");
    expect(barra).toContainElement(screen.getByLabelText("Hasta"));
    expect(barra).toContainElement(screen.getByLabelText("Producto"));
  });

  it("filtros: la opción «todos» de producto y estado dice «Todos» (no cabe más largo en una fila a 1280 px)", async () => {
    await abrirHistorial();

    expect(within(screen.getByLabelText("Producto")).getAllByRole("option")[0]).toHaveTextContent(/^Todos$/);
    expect(within(screen.getByLabelText("Estado")).getAllByRole("option")[0]).toHaveTextContent(/^Todos$/);
  });

  it("filtros: la fila nunca se desborda: los controles pueden pasar a otra línea y los selectores tienen ancho fijo", async () => {
    await abrirHistorial();

    // El contenedor de los controles permite el salto de línea desde lg (sin «nowrap» en ningún ancho).
    const controles = screen.getByLabelText("Estado").closest("div[class*='lg:flex-wrap']");
    expect(controles).not.toBeNull();
    expect(controles!.className).not.toMatch(/nowrap/);
    // El ancho de cada selector no depende de su contenido (un producto de nombre largo): ancho fijo que no crece.
    const producto = screen.getByLabelText("Producto").closest("div[class*='lg:w-']");
    const estado = screen.getByLabelText("Estado").closest("div[class*='lg:w-']");
    for (const envoltorio of [producto, estado]) {
      expect(envoltorio!.className).toMatch(/lg:w-\d+/);
      expect(envoltorio).toHaveClass("lg:shrink-0");
    }
  });

  it("filtros: siguen todos accesibles por su nombre", async () => {
    await abrirHistorial();

    for (const nombre of ["Producto", "Estado", "Desde", "Hasta"]) {
      expect(screen.getByLabelText(nombre)).toBeInTheDocument();
    }
    expect(screen.getByRole("searchbox", { name: "Buscar elaboración por código" })).toBeInTheDocument();
  });

  it("fila: ícono de estado a la izquierda, producto con la insignia, código · fecha debajo y una flecha", async () => {
    await abrirHistorial();

    const finalizada = within(screen.getByRole("list", { name: "Elaboraciones" })).getByRole("link", { name: /E-002/ });
    expect(finalizada.querySelector("[data-icono]")).toHaveAttribute("data-icono", "finalizada");
    expect(within(finalizada).getByText("Queque de vainilla")).toBeInTheDocument();
    expect(within(finalizada).getByText("Finalizada")).toBeInTheDocument();
    const codigo = within(finalizada).getByText("E-002");
    expect(codigo).toHaveClass("font-mono");
    expect(within(finalizada).getByText("06-10-2026")).toBeInTheDocument();
    // Orden: ícono, producto, código y fecha.
    const orden = [
      finalizada.querySelector("[data-icono]"),
      within(finalizada).getByText("Queque de vainilla"),
      codigo,
      within(finalizada).getByText("06-10-2026"),
    ] as Element[];
    for (let i = 0; i < orden.length - 1; i += 1) {
      expect(orden[i].compareDocumentPosition(orden[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("fila: un borrador lleva el ícono de borrador y debajo «Faltan N de M» o «Lista para finalizar»", async () => {
    await abrirHistorial();

    const lista = screen.getByRole("list", { name: "Elaboraciones" });
    const faltan = within(lista).getByRole("link", { name: /E-001/ });
    expect(faltan.querySelector("[data-icono]")).toHaveAttribute("data-icono", "borrador");
    expect(within(faltan).getByText("Faltan 2 de 3 ingredientes")).toBeInTheDocument();
    const lista3 = within(lista).getByRole("link", { name: /E-003/ });
    expect(within(lista3).getByText("Lista para finalizar")).toBeInTheDocument();
  });

  it("fila: el formato de la fecha sigue siendo dd-mm-aaaa", async () => {
    await abrirHistorial();

    expect(screen.queryByText(/6 oct|oct 2026/i)).not.toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Elaboraciones" })).getAllByText("06-10-2026")).toHaveLength(3);
  });

  it("tarjetas: cada cifra lleva su ícono a la derecha", async () => {
    await abrirHistorial();

    const resumenCifras = screen.getByRole("group", { name: "Resumen de elaboraciones" });
    expect(resumenCifras.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(3);
    expect(within(resumenCifras).getByText("Elaboraciones totales")).toBeInTheDocument();
    expect(within(resumenCifras).getByText("Finalizadas")).toBeInTheDocument();
    expect(within(resumenCifras).getByText("En borrador")).toBeInTheDocument();
  });
});

// --- detalle ---

describe("Detalle de la elaboración: migas y acordeón de insumos (T06-06)", () => {
  async function abrirDetalle() {
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones/31"] });
    await screen.findByRole("heading", { name: "Elaboración E-031", level: 1 });
  }
  const fila = (ingrediente: string) => within(screen.getByRole("region", { name: ingrediente })).getByRole("button");

  it("las migas son «Elaboraciones / código» y el enlace al producto sigue en el bloque de datos", async () => {
    await abrirDetalle();

    const migas = screen.getByRole("navigation", { name: "Ruta de navegación" });
    expect(within(migas).getByRole("link", { name: "Elaboraciones" })).toHaveAttribute("href", "/elaboraciones");
    expect(within(migas).getByText("E-031")).toHaveAttribute("aria-current", "page");
    expect(within(migas).queryByText("Productos")).not.toBeInTheDocument();
    expect(within(migas).queryByText("Queque de vainilla")).not.toBeInTheDocument();
    const datos = screen.getByRole("region", { name: "Datos de la elaboración" });
    expect(within(datos).getByRole("link", { name: "Queque de vainilla" })).toHaveAttribute("href", "/productos/5");
  });

  it("el primer ingrediente parte abierto y los demás cerrados", async () => {
    await abrirDetalle();

    expect(fila("Harina")).toHaveAttribute("aria-expanded", "true");
    expect(fila("Leche")).toHaveAttribute("aria-expanded", "false");
    expect(fila("Azúcar")).toHaveAttribute("aria-expanded", "false");
    expect(within(screen.getByRole("region", { name: "Harina" })).getByText("Declarados de Harina Selecta 1 kg")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Leche" })).queryByText("Ingredientes declarados")).not.toBeInTheDocument();
  });

  it("cada fila dice el ingrediente, «insumo · marca» y el lote o «Sin lote»", async () => {
    await abrirDetalle();

    const harina = fila("Harina");
    expect(within(harina).getByText("Harina")).toBeInTheDocument();
    expect(within(harina).getByText("Harina Selecta 1 kg · Selecta")).toBeInTheDocument();
    expect(within(harina).getByText("Lote H-77")).toBeInTheDocument();
    expect(within(fila("Leche")).getByText("Sin lote")).toBeInTheDocument();
    expect(within(fila("Leche")).getByText("Leche Colun 1 L · Colun")).toBeInTheDocument();
  });

  it("es accesible: un botón con aria-expanded y aria-controls que apunta al panel", async () => {
    await abrirDetalle();

    const boton = fila("Harina");
    expect(boton.tagName).toBe("BUTTON");
    const panel = document.getElementById(boton.getAttribute("aria-controls") ?? "");
    expect(panel).not.toBeNull();
    expect(panel).toHaveTextContent("Declarados de Harina Selecta 1 kg");
    expect(boton).toHaveClass("min-h-11");
  });

  it("al abrirlo muestra la grilla completa: insumo, marca, lote, vencimiento, declarados y alérgenos", async () => {
    const user = userEvent.setup();
    await abrirDetalle();

    await user.click(fila("Azúcar"));

    const panel = screen.getByRole("region", { name: "Azúcar" });
    expect(fila("Azúcar")).toHaveAttribute("aria-expanded", "true");
    for (const titulo of ["Insumo", "Marca u origen", "Lote", "Vencimiento"]) {
      expect(within(panel).getByText(titulo)).toBeInTheDocument();
    }
    expect(within(panel).getByText("Azúcar Iansa 1 kg")).toBeInTheDocument();
    expect(within(panel).getByText("Iansa")).toBeInTheDocument();
    expect(within(panel).getByText("A-12")).toBeInTheDocument();
    expect(within(panel).getByText("No registrado")).toBeInTheDocument();
    expect(within(panel).getByText("Ingredientes declarados")).toBeInTheDocument();
    expect(within(panel).getByText("Declarados de Azúcar Iansa 1 kg")).toBeInTheDocument();
    expect(within(panel).getByText("Sin alérgenos (revisado el 01-10-2026)")).toBeInTheDocument();
  });

  it("se abre y se cierra con clic y con teclado", async () => {
    const user = userEvent.setup();
    await abrirDetalle();

    fila("Leche").focus();
    await user.keyboard("{Enter}");
    expect(fila("Leche")).toHaveAttribute("aria-expanded", "true");
    await user.keyboard(" ");
    expect(fila("Leche")).toHaveAttribute("aria-expanded", "false");
    await user.click(fila("Harina"));
    expect(fila("Harina")).toHaveAttribute("aria-expanded", "false");
  });

  it("el resumen «Alérgenos de la elaboración» se mantiene arriba de los insumos", async () => {
    await abrirDetalle();

    const resumenAlergenos = screen.getByRole("region", { name: "Alérgenos de la elaboración" });
    const insumos = screen.getByRole("heading", { name: "Insumos utilizados" });
    expect(resumenAlergenos.compareDocumentPosition(insumos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
