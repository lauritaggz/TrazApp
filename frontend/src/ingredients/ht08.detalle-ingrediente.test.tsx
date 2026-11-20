/**
 * «Uso en formulaciones» e «Insumos asociados» del detalle del ingrediente (T-HT08-02 / HT08).
 * PT-HT08-01/03/04: listas con datos y enlaces al detalle; PT-HT08-05: estados vacíos sin «Próximamente»;
 * un error en una sección no afecta a la otra ni al resto del detalle; el servicio solo lee.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import {
  IngredientProductsSection,
  IngredientSuppliesSection,
} from "@/components/ingredients/IngredientUsageSections";
import { apiRequest } from "@/lib/apiClient";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as ingredientService from "@/services/ingredientService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import type {
  Ingrediente,
  IngredienteInsumoAsociado,
  IngredienteUsoProducto,
} from "@/types/ingredient";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("@/services/ingredientService", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/ingredientService")>();
  return {
    ...real,
    getIngredient: vi.fn(),
    listIngredientAllergens: vi.fn(),
    listAlergenosCatalog: vi.fn(),
    listIngredientProducts: vi.fn(),
    listIngredientSupplies: vi.fn(),
  };
});

vi.mock("@/lib/apiClient", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/apiClient")>();
  return { ...real, apiRequest: vi.fn() };
});

const INGREDIENTE: Ingrediente = {
  id: 7,
  productor_id: 1,
  codigo_interno: "HAR-001",
  nombre: "Harina",
  descripcion: null,
  tipo: "simple",
  activo: true,
  created_at: "2026-11-01T10:00:00Z",
};

const PRODUCTOS: IngredienteUsoProducto[] = [
  { id: 11, nombre: "Pan amasado", numero_version: 1 },
  { id: 12, nombre: "Queque de vainilla con un nombre muy largo para el ancho de un teléfono", numero_version: 3 },
];

const INSUMOS: IngredienteInsumoAsociado[] = [
  { id: 21, nombre: "Harina Selecta 1 kg", marca_origen: "Selecta", activo: true },
  { id: 22, nombre: "Harina de feria", marca_origen: "Feria local", activo: false },
];

const seccionUso = () => screen.getByRole("region", { name: /^Uso en formulaciones/ });
const seccionInsumos = () => screen.getByRole("region", { name: /^Insumos asociados/ });

function montarSecciones() {
  return render(
    <MemoryRouter>
      <IngredientProductsSection ingredienteId={INGREDIENTE.id} />
      <IngredientSuppliesSection ingredienteId={INGREDIENTE.id} />
    </MemoryRouter>,
  );
}

async function abrirDetalle() {
  setAccessToken("token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  renderWithProviders(<App />, { initialEntries: [`/ingredientes/${INGREDIENTE.id}`] });
  await screen.findByRole("heading", { name: "Harina", level: 1 });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(ingredientService.getIngredient).mockResolvedValue(INGREDIENTE);
  vi.mocked(ingredientService.listIngredientAllergens).mockResolvedValue([]);
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue([]);
  vi.mocked(ingredientService.listIngredientProducts).mockResolvedValue(PRODUCTOS);
  vi.mocked(ingredientService.listIngredientSupplies).mockResolvedValue(INSUMOS);
});

describe("Detalle del ingrediente: uso en formulaciones e insumos asociados", () => {
  it("PT-HT08-01/04: lista los productos con su versión y enlaza a su detalle", async () => {
    montarSecciones();

    const lista = await within(seccionUso()).findByRole("list", { name: "Productos que usan este ingrediente" });
    const enlaces = within(lista).getAllByRole("link");
    expect(enlaces).toHaveLength(2);
    expect(enlaces[0]).toHaveAttribute("href", "/productos/11");
    expect(enlaces[0]).toHaveTextContent("Pan amasado");
    expect(enlaces[0]).toHaveTextContent("Versión 1");
    expect(enlaces[1]).toHaveAttribute("href", "/productos/12");
    expect(enlaces[1]).toHaveTextContent("Versión 3");
    expect(within(seccionUso()).getByRole("heading", { name: "Uso en formulaciones (2)" })).toBeInTheDocument();
    expect(ingredientService.listIngredientProducts).toHaveBeenCalledWith(INGREDIENTE.id);
  });

  it("PT-HT08-03/04: lista insumos activos e inactivos con marca, estado y enlace a su detalle", async () => {
    montarSecciones();

    const lista = await within(seccionInsumos()).findByRole("list", { name: "Insumos de este ingrediente" });
    const [activo, inactivo] = within(lista).getAllByRole("link");
    expect(activo).toHaveAttribute("href", "/insumos/21");
    expect(activo).toHaveTextContent("Harina Selecta 1 kg");
    expect(activo).toHaveTextContent("Selecta");
    expect(within(activo).getByText("Activo")).toBeInTheDocument();
    expect(inactivo).toHaveAttribute("href", "/insumos/22");
    expect(inactivo).toHaveTextContent("Feria local");
    expect(within(inactivo).getByText("Inactivo")).toBeInTheDocument();
    expect(within(inactivo).getByText("Harina de feria")).toHaveClass("text-text-secondary");
    expect(within(seccionInsumos()).getByRole("heading", { name: "Insumos asociados (2)" })).toBeInTheDocument();
  });

  it("PT-HT08-05: sin datos muestra estados vacíos con texto y ningún «Próximamente»", async () => {
    vi.mocked(ingredientService.listIngredientProducts).mockResolvedValue([]);
    vi.mocked(ingredientService.listIngredientSupplies).mockResolvedValue([]);

    await abrirDetalle();

    expect(
      await screen.findByText("Este ingrediente no está en la formulación vigente de ningún producto."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Este ingrediente no tiene insumos asociados.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Uso en formulaciones (0)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Insumos asociados (0)" })).toBeInTheDocument();
    expect(screen.queryByText(/Próximamente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/podrás/i)).not.toBeInTheDocument();
    expect(document.querySelector("[data-proximamente]")).toBeNull();
  });

  it("muestra el texto de carga mientras llegan las listas, sin contador", async () => {
    vi.mocked(ingredientService.listIngredientProducts).mockReturnValue(new Promise(() => {}));
    vi.mocked(ingredientService.listIngredientSupplies).mockReturnValue(new Promise(() => {}));

    montarSecciones();

    expect(screen.getByText("Cargando productos...")).toBeInTheDocument();
    expect(screen.getByText("Cargando insumos...")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Uso en formulaciones" })).toBeInTheDocument();
  });

  it("un error en una sección no afecta a la otra ni al resto del detalle; «Reintentar» vuelve a pedir", async () => {
    vi.mocked(ingredientService.listIngredientProducts)
      .mockRejectedValueOnce(new Error("falla"))
      .mockResolvedValueOnce(PRODUCTOS);

    await abrirDetalle();

    const error = await within(seccionUso()).findByText("No pudimos cargar los productos.");
    expect(error).toBeInTheDocument();
    expect(within(seccionUso()).queryByText(/conexión/)).not.toBeInTheDocument();
    // The other section and the rest of the detail are intact.
    expect(await within(seccionInsumos()).findByRole("link", { name: /Harina Selecta 1 kg/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Información general" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar ingrediente" })).toBeInTheDocument();

    await userEvent.click(within(seccionUso()).getByRole("button", { name: "Reintentar" }));

    expect(await within(seccionUso()).findByRole("link", { name: /Pan amasado/ })).toHaveAttribute(
      "href",
      "/productos/11",
    );
    expect(ingredientService.listIngredientProducts).toHaveBeenCalledTimes(2);
  });

  it("si falla la sección de insumos, la de productos sigue mostrando sus datos", async () => {
    vi.mocked(ingredientService.listIngredientSupplies).mockRejectedValue(new Error("falla"));

    montarSecciones();

    expect(await within(seccionInsumos()).findByText("No pudimos cargar los insumos.")).toBeInTheDocument();
    expect(await within(seccionUso()).findByRole("link", { name: /Pan amasado/ })).toBeInTheDocument();
  });
});

describe("Listas largas: las primeras 5 y «Ver todos (n)»", () => {
  const productos = (n: number): IngredienteUsoProducto[] =>
    Array.from({ length: n }, (_, i) => ({ id: 100 + i, nombre: `Producto ${i + 1}`, numero_version: 1 }));
  const insumos = (n: number): IngredienteInsumoAsociado[] =>
    Array.from({ length: n }, (_, i) => ({ id: 200 + i, nombre: `Insumo ${i + 1}`, marca_origen: "Marca", activo: true }));

  it("con 7 filas se ven 5; «Ver todos (7)» muestra las 7 y «Ver menos» vuelve a 5", async () => {
    vi.mocked(ingredientService.listIngredientProducts).mockResolvedValue(productos(7));
    vi.mocked(ingredientService.listIngredientSupplies).mockResolvedValue(insumos(7));
    const user = userEvent.setup();
    montarSecciones();

    for (const [region, nombreLista] of [
      [seccionUso, "Productos que usan este ingrediente"],
      [seccionInsumos, "Insumos de este ingrediente"],
    ] as const) {
      const lista = await within(region()).findByRole("list", { name: nombreLista });
      expect(within(lista).getAllByRole("listitem")).toHaveLength(5);
      expect(within(region()).getByRole("heading", { name: /\(7\)$/ })).toBeInTheDocument();

      const boton = within(region()).getByRole("button", { name: "Ver todos (7)" });
      expect(boton.tagName).toBe("BUTTON");
      expect(boton).toHaveAttribute("aria-expanded", "false");
      expect(boton).toHaveAttribute("aria-controls", lista.id);
      expect(boton).toHaveClass("min-h-11");

      await user.click(boton);
      expect(within(lista).getAllByRole("listitem")).toHaveLength(7);
      expect(boton).toHaveTextContent("Ver menos");
      expect(boton).toHaveAttribute("aria-expanded", "true");
      expect(boton).toHaveFocus();

      await user.click(boton);
      expect(within(lista).getAllByRole("listitem")).toHaveLength(5);
      expect(boton).toHaveTextContent("Ver todos (7)");
      expect(boton).toHaveFocus();
    }
  });

  it("con 5 filas se ven todas y no hay botón", async () => {
    vi.mocked(ingredientService.listIngredientProducts).mockResolvedValue(productos(5));
    vi.mocked(ingredientService.listIngredientSupplies).mockResolvedValue(insumos(5));
    montarSecciones();

    const listaUso = await within(seccionUso()).findByRole("list");
    const listaInsumos = await within(seccionInsumos()).findByRole("list");
    expect(within(listaUso).getAllByRole("listitem")).toHaveLength(5);
    expect(within(listaInsumos).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /Ver todos|Ver menos/ })).not.toBeInTheDocument();
  });
});

describe("Servicio del detalle del ingrediente (solo lectura)", () => {
  it("pide las dos listas con GET y token a sus subrecursos", async () => {
    const real = await vi.importActual<typeof import("@/services/ingredientService")>("@/services/ingredientService");
    vi.mocked(apiRequest).mockResolvedValue([]);

    await real.listIngredientProducts(7);
    await real.listIngredientSupplies(7);

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/gestion/ingredientes/7/productos", { method: "GET" }, true);
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/gestion/ingredientes/7/insumos", { method: "GET" }, true);
  });
});
