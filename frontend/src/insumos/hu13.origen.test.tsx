/**
 * Where the information of a supply comes from, in its detail (T13-06 / HU13, CA11), and the
 * map of sources that names them. The API is simulated.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { esFuenteManual, nombreFuente, urlDeLaFicha } from "@/lib/fuentesInsumo";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as ingredientService from "@/services/ingredientService";
import * as insumoService from "@/services/insumoService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import type { Insumo } from "@/types/insumo";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("@/services/insumoService", () => ({
  listInsumos: vi.fn(),
  getInsumo: vi.fn(),
  deactivateInsumo: vi.fn(),
  reactivateInsumo: vi.fn(),
  listInsumoAlergenos: vi.fn(),
}));

vi.mock("@/services/ingredientService", () => ({
  listAlergenosCatalog: vi.fn(),
}));

const URL_FICHA = "https://fuente.ejemplo.test/producto/7802910000971";

function insumo(overrides: Partial<Insumo> = {}): Insumo {
  return {
    id: 10,
    productor_id: 1,
    ingrediente_id: 1,
    ingrediente: { id: 1, nombre: "Leche" },
    nombre: "Leche Lonco 1 L",
    marca_origen: "Lonco",
    presentacion: "1L",
    codigo_barras: "7802910000971",
    ingredientes_declarados: "Leche",
    advertencias: null,
    ficha: null,
    fuente: "manual",
    fecha_recuperacion: null,
    habitual: false,
    activo: true,
    created_at: "2026-10-04T12:00:00Z",
    updated_at: "2026-10-04T12:00:00Z",
    alergenos_revisados: true,
    alergenos_revisados_at: "2026-10-04T12:00:00Z",
    alergenos_declarados: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue([]);
  vi.mocked(insumoService.listInsumoAlergenos).mockResolvedValue([]);
});

async function abrirDetalle(datos: Insumo) {
  vi.mocked(insumoService.getInsumo).mockResolvedValue(datos);
  renderWithProviders(<App />, { initialEntries: [`/insumos/${datos.id}`] });
  expect(await screen.findByRole("heading", { name: datos.nombre, level: 1 })).toBeInTheDocument();
  return screen.getByRole("region", { name: "Origen de la información" });
}

// =============================================================================================

describe("Origen de la información en el detalle del insumo", () => {
  it("un insumo manual dice «Creado manualmente» y no ofrece ninguna ficha", async () => {
    const origen = await abrirDetalle(insumo());

    expect(within(origen).getByText("Creado manualmente")).toBeInTheDocument();
    expect(within(origen).queryByText(/Obtenido de/)).not.toBeInTheDocument();
    expect(within(origen).queryByRole("link")).not.toBeInTheDocument();
  });

  it("un insumo recuperado dice de dónde y cuándo se obtuvo, con la fecha como dd-mm-aaaa", async () => {
    const origen = await abrirDetalle(
      insumo({ fuente: "open_food_facts", fecha_recuperacion: "2026-10-19T15:00:00Z", ficha: { url: URL_FICHA } }),
    );

    expect(within(origen).getByText("Obtenido de Open Food Facts el 19-10-2026")).toBeInTheDocument();
    expect(within(origen).queryByText("Creado manualmente")).not.toBeInTheDocument();
  });

  it("la fecha se cuenta en la hora de Chile, no en UTC", async () => {
    // 02:30 UTC of the 20th is still the 19th at night in Santiago.
    const origen = await abrirDetalle(
      insumo({ fuente: "open_food_facts", fecha_recuperacion: "2026-10-20T02:30:00Z" }),
    );

    expect(within(origen).getByText("Obtenido de Open Food Facts el 19-10-2026")).toBeInTheDocument();
  });

  it("enlaza a la ficha de la fuente, en otra pestaña y sin darle acceso a esta página", async () => {
    const origen = await abrirDetalle(
      insumo({ fuente: "open_food_facts", fecha_recuperacion: "2026-10-19T15:00:00Z", ficha: { url: URL_FICHA } }),
    );

    const enlace = within(origen).getByRole("link", { name: /Ver la ficha en Open Food Facts/ });
    expect(enlace).toHaveAttribute("href", URL_FICHA);
    expect(enlace).toHaveAttribute("target", "_blank");
    expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
    expect(enlace).toHaveAccessibleName(/se abre en otra pestaña/);
  });

  it.each([
    ["sin ficha", null],
    ["con una ficha sin dirección", { product_name: "Leche" }],
    ["con una dirección que no es un texto", { url: 42 }],
    ["con una dirección inválida", { url: "no es una url" }],
    ["con una dirección javascript:", { url: "javascript:alert(1)" }],
    ["con una dirección data:", { url: "data:text/html,<script>alert(1)</script>" }],
  ])("recuperado %s: dice el origen pero no ofrece ningún enlace", async (_caso, ficha) => {
    const origen = await abrirDetalle(
      insumo({ fuente: "open_food_facts", fecha_recuperacion: "2026-10-19T15:00:00Z", ficha }),
    );

    expect(within(origen).getByText("Obtenido de Open Food Facts el 19-10-2026")).toBeInTheDocument();
    expect(within(origen).queryByRole("link")).not.toBeInTheDocument();
  });

  it("recuperado sin fecha (registros anteriores): no inventa una", async () => {
    const origen = await abrirDetalle(insumo({ fuente: "open_food_facts", fecha_recuperacion: null }));

    expect(within(origen).getByText("Obtenido de Open Food Facts")).toBeInTheDocument();
    expect(within(origen).queryByText(/ el \d/)).not.toBeInTheDocument();
  });

  it("una fuente que la aplicación aún no conoce se muestra tal como viene", async () => {
    const origen = await abrirDetalle(
      insumo({ fuente: "otra_fuente", fecha_recuperacion: "2026-10-19T15:00:00Z", ficha: { url: URL_FICHA } }),
    );

    expect(within(origen).getByText("Obtenido de otra_fuente el 19-10-2026")).toBeInTheDocument();
    expect(within(origen).getByRole("link", { name: /Ver la ficha en otra_fuente/ })).toBeInTheDocument();
  });

  it("el código de barras sigue mostrándose en la información general", async () => {
    await abrirDetalle(insumo({ fuente: "open_food_facts", fecha_recuperacion: "2026-10-19T15:00:00Z" }));

    const general = screen.getByRole("region", { name: "Información general" });
    expect(within(general).getByText("7802910000971")).toBeInTheDocument();
  });

  it("el estado lo dice la insignia del título: ya no hay una sección «Estado» que la repita (HT07)", async () => {
    await abrirDetalle(insumo({ activo: false }));

    expect(screen.queryByRole("region", { name: "Estado" })).not.toBeInTheDocument();
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
  });

  it("habla en segunda persona: «confirmaste estos datos al crear el insumo» (HT07)", async () => {
    await abrirDetalle(insumo({ fuente: "open_food_facts", fecha_recuperacion: "2026-10-19T15:00:00Z" }));

    expect(
      screen.getByText("Los datos se completaron desde esa fuente y confirmaste estos datos al crear el insumo."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/el productor/)).not.toBeInTheDocument();
  });
});

// =============================================================================================

describe("Mapa de fuentes", () => {
  it("nombra las fuentes conocidas", () => {
    expect(nombreFuente("manual")).toBe("Registro manual");
    expect(nombreFuente("open_food_facts")).toBe("Open Food Facts");
  });

  it("una fuente desconocida se devuelve como llegó", () => {
    expect(nombreFuente("scraping_x")).toBe("scraping_x");
  });

  it("solo «manual» es manual", () => {
    expect(esFuenteManual("manual")).toBe(true);
    expect(esFuenteManual("open_food_facts")).toBe(false);
    expect(esFuenteManual("")).toBe(false);
  });

  it.each([
    [{ url: "https://fuente.ejemplo.test/p/1" }, "https://fuente.ejemplo.test/p/1"],
    [{ url: "http://fuente.ejemplo.test/p/1" }, "http://fuente.ejemplo.test/p/1"],
    [{ url: "https://fuente.ejemplo.test/p/1?a=1&b=2#x" }, "https://fuente.ejemplo.test/p/1?a=1&b=2#x"],
    [{ url: "javascript:alert(1)" }, null],
    [{ url: "JaVaScRiPt:alert(1)" }, null],
    [{ url: "data:text/plain,hola" }, null],
    [{ url: "ftp://fuente.ejemplo.test/p" }, null],
    [{ url: "/ruta/relativa" }, null],
    [{ url: "" }, null],
    [{ url: null }, null],
    [{}, null],
    [null, null],
    [undefined, null],
  ])("urlDeLaFicha(%j) es %j", (ficha, esperado) => {
    expect(urlDeLaFicha(ficha)).toBe(esperado);
  });
});
