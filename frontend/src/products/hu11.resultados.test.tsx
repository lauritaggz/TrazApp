import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { textoUtilidad } from "@/lib/evaluacionTexto";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as evaluacionService from "@/services/evaluacionService";
import * as productService from "@/services/productService";
import {
  EMPTY_PRODUCT_COMMERCIAL_FIELDS,
  mockCategories,
  mockProductor,
  paginaElaboraciones,
  renderWithProviders,
} from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { Product, ResultadosEvaluacion } from "@/types/product";

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
  // HT08: the product detail loads its «Anterior» / «Siguiente» neighbours.
  getProductNeighbors: vi.fn().mockResolvedValue({ anterior: null, siguiente: null }),
}));

vi.mock("@/services/elaboracionService", () => ({
  listElaboraciones: vi.fn(),
  getCodigoSugerido: vi.fn(),
  createElaboracion: vi.fn(),
  getElaboracion: vi.fn(),
  // HT08: the elaboración detail loads its «Anterior» / «Siguiente» neighbours.
  getElaboracionNeighbors: vi.fn().mockResolvedValue({ anterior: null, siguiente: null }),
}));

vi.mock("@/services/evaluacionService", () => ({ obtenerResultadosEvaluacion: vi.fn() }));

const obtener = vi.mocked(evaluacionService.obtenerResultadosEvaluacion);

function producto(id: number, nombre: string, extra: Partial<Product> = {}): Product {
  return {
    id,
    productor_id: 1,
    codigo_interno: `P-00${id}`,
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
    publicado: true,
    id_publico: `tok${id}`,
    publicado_en: "2026-11-09T12:00:00Z",
    url_publica: `https://trazapp.ejemplo.test/p/tok${id}`,
    evaluacion_utilidad: { total: 0, positivas: 0, porcentaje: null },
    ...extra,
  };
}

const CON_RESPUESTAS = producto(1, "Mermelada de frutilla", {
  evaluacion_utilidad: { total: 4, positivas: 3, porcentaje: 75 },
});
const UNA_RESPUESTA = producto(2, "Queso crema", { evaluacion_utilidad: { total: 1, positivas: 0, porcentaje: 0 } });
const SIN_RESPUESTAS = producto(3, "Pan de campo");

const RESULTADOS: ResultadosEvaluacion = {
  producto_id: 1,
  total: 5,
  positivas: 4,
  porcentaje: 80,
  por_elaboracion: [
    { codigo: "MFRU-042", fecha: "2026-03-18", total: 3, positivas: 3, porcentaje: 100 },
    { codigo: "MFRU-037", fecha: "2026-03-06", total: 2, positivas: 1, porcentaje: 50 },
  ],
};
const VACIOS: ResultadosEvaluacion = { producto_id: 1, total: 0, positivas: 0, porcentaje: null, por_elaboracion: [] };

function iniciarSesion() {
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(paginaElaboraciones([]));
}

async function abrirGeneral(productos: Product[]) {
  iniciarSesion();
  vi.mocked(productService.listProducts).mockResolvedValue(productos);
  renderWithProviders(<App />, { initialEntries: ["/publicaciones"] });
  await screen.findByRole("heading", { name: "Publicaciones", level: 1 });
}

async function abrirDetalle(resultados: ResultadosEvaluacion | Error) {
  iniciarSesion();
  vi.mocked(productService.getProduct).mockResolvedValue(CON_RESPUESTAS);
  if (resultados instanceof Error) obtener.mockRejectedValue(resultados);
  else obtener.mockResolvedValue(resultados);
  renderWithProviders(<App />, { initialEntries: ["/publicaciones/1"] });
  return screen.findByRole("region", { name: "Evaluación de utilidad" });
}

const fila = (nombre: string) => screen.getByText(nombre).closest("li") as HTMLElement;

describe("HU11 — resultados de la evaluación en Publicaciones (T11-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // --- vista general ---------------------------------------------------------------------------

  it("cada fila muestra el porcentaje y el total de respuestas, con singular y sin respuestas", async () => {
    await abrirGeneral([CON_RESPUESTAS, UNA_RESPUESTA, SIN_RESPUESTAS]);
    await screen.findByText("Pan de campo");

    expect(within(fila("Mermelada de frutilla")).getByText("Utilidad: 75 % · 4 respuestas")).toBeInTheDocument();
    expect(within(fila("Queso crema")).getByText("Utilidad: 0 % · 1 respuesta")).toBeInTheDocument();
    expect(within(fila("Pan de campo")).getByText("Sin respuestas todavía")).toBeInTheDocument();
  });

  it("sin respuestas nunca aparece «0 %» (ni con la clave ausente)", async () => {
    await abrirGeneral([SIN_RESPUESTAS, producto(4, "Aceite", { evaluacion_utilidad: undefined })]);
    await screen.findByText("Aceite");

    expect(within(fila("Pan de campo")).queryByText(/\d+ %/)).not.toBeInTheDocument();
    expect(within(fila("Aceite")).getByText("Sin respuestas todavía")).toBeInTheDocument();
    expect(within(fila("Aceite")).queryByText(/\d+ %/)).not.toBeInTheDocument();
    expect(textoUtilidad({ total: 0, positivas: 0, porcentaje: null })).toBe("Sin respuestas todavía");
  });

  // --- detalle ---------------------------------------------------------------------------------

  it("el detalle muestra el porcentaje con su total y la tabla por elaboración", async () => {
    const tarjeta = await abrirDetalle(RESULTADOS);

    expect(await within(tarjeta).findByText("80 %")).toBeInTheDocument();
    expect(within(tarjeta).getByText(/de respuestas positivas · 5 respuestas/)).toBeInTheDocument();
    const tabla = within(tarjeta).getByRole("table", { name: "Evaluación por elaboración" });
    const filas = within(tabla).getAllByRole("row").slice(1);
    expect(filas.map((f) => within(f).getAllByRole("cell").map((c) => c.textContent))).toEqual([
      ["18-03-2026", "100 %", "3"],
      ["06-03-2026", "50 %", "2"],
    ]);
    expect(filas.map((f) => within(f).getByRole("rowheader").textContent)).toEqual(["MFRU-042", "MFRU-037"]);
    expect(obtener).toHaveBeenCalledWith(1);
  });

  it("sin respuestas el detalle dice «Sin respuestas todavía» y no muestra tabla ni porcentaje", async () => {
    const tarjeta = await abrirDetalle(VACIOS);

    expect(await within(tarjeta).findByText("Sin respuestas todavía")).toBeInTheDocument();
    expect(within(tarjeta).queryByRole("table")).not.toBeInTheDocument();
    expect(within(tarjeta).queryByText(/\d+ %/)).not.toBeInTheDocument();
  });

  it("un error al cargar las evaluaciones se queda en su tarjeta, con «Reintentar», y el resto de la página sigue", async () => {
    const user = userEvent.setup();
    const tarjeta = await abrirDetalle(new ApiError("No se pudo conectar con el servidor.", 0));

    expect(await within(tarjeta).findByText(/No pudimos cargar las evaluaciones/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Estado de publicación" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Elaboraciones finalizadas" })).toBeInTheDocument();
    expect(screen.queryByText(/No pudimos cargar el producto/)).not.toBeInTheDocument();

    obtener.mockResolvedValue(RESULTADOS);
    await user.click(within(tarjeta).getByRole("button", { name: "Reintentar" }));

    expect(await within(tarjeta).findByText("80 %")).toBeInTheDocument();
    await waitFor(() => expect(within(tarjeta).queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument());
    expect(obtener).toHaveBeenCalledTimes(2);
  });

  it("los textos son de al menos 12 px y los botones de 44 px (sin clases text-[10px] ni text-[11px])", async () => {
    const tarjeta = await abrirDetalle(new ApiError("x", 500));
    await within(tarjeta).findByRole("button", { name: "Reintentar" });

    expect(within(tarjeta).getByRole("button", { name: "Reintentar" })).toHaveClass("min-h-11");
    expect(tarjeta.innerHTML).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/);
  });
});
