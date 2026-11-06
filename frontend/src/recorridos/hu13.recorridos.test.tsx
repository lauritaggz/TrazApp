/**
 * HU13 (T13-05) — Journey «new supply by barcode vs by hand», with an explicit counter that fails if a
 * flow grows. Same counting rule as the HT06 journeys: 1 interaction per click, per selection and per
 * typed field (a field typed in full counts 1, however many keys); waiting counts nothing.
 *
 * - "clic": a button, a link, a checkbox.
 * - "campo": a value the productor types or chooses in a select.
 *
 * The scanner is optional: it adds a path, it does not add a step to the manual one. The HT06
 * journeys B and B′ (6 and 7 interactions) live in ht06.recorridos.test.tsx and are not touched.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as ingredientService from "@/services/ingredientService";
import * as insumoService from "@/services/insumoService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import type { ConsultaCodigo } from "@/types/consultaCodigo";
import type { AlergenoCatalogo, Ingrediente } from "@/types/ingredient";
import type { Insumo, InsumoCreatePayload } from "@/types/insumo";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("@/services/insumoService", () => ({
  listInsumos: vi.fn(),
  getInsumo: vi.fn(),
  createInsumo: vi.fn(),
  consultarCodigoBarras: vi.fn(),
}));

vi.mock("@/services/ingredientService", () => ({
  listIngredients: vi.fn(),
  listAlergenosCatalog: vi.fn(),
  createIngredient: vi.fn(),
}));

// --- the counter ---------------------------------------------------------------------------------

type Usuario = ReturnType<typeof userEvent.setup>;
type Tipo = "clic" | "campo";

class Recorrido {
  readonly pasos: { tipo: Tipo; paso: string }[] = [];
  private readonly user: Usuario;

  constructor(user: Usuario) {
    this.user = user;
  }

  async clic(paso: string, elemento: HTMLElement) {
    await this.user.click(elemento);
    this.pasos.push({ tipo: "clic", paso });
  }

  async escribir(paso: string, elemento: HTMLElement, texto: string) {
    await this.user.clear(elemento);
    await this.user.type(elemento, texto);
    this.pasos.push({ tipo: "campo", paso });
  }

  /** T07-07: the ingredient is a group of options (radio buttons); choosing one counts as filling a field. */
  async elegir(paso: string, nombre: string) {
    await this.user.click(await screen.findByRole("radio", { name: nombre }));
    this.pasos.push({ tipo: "campo", paso });
  }

  get clics() {
    return this.pasos.filter((p) => p.tipo === "clic").length;
  }

  get campos() {
    return this.pasos.filter((p) => p.tipo === "campo").length;
  }

  get total() {
    return this.pasos.length;
  }
}

// --- data ----------------------------------------------------------------------------------------

const CODIGO = "7802910000971";

const INGREDIENTE_LECHE: Ingrediente = {
  id: 1,
  productor_id: 1,
  codigo_interno: "LEC-001",
  nombre: "Leche",
  descripcion: null,
  tipo: null,
  activo: true,
  created_at: "2026-10-01T12:00:00Z",
};

const CATALOGO: AlergenoCatalogo[] = [
  { id: 1, codigo: "lacteos", nombre: "Leche", obligatorio_chile: true },
  { id: 2, codigo: "cacahuetes", nombre: "Maní", obligatorio_chile: true },
];

const NOMBRE = "LONCO LECHE SIN LACTOSA";
const MARCA = "Lonco Leche";
const PRESENTACION = "1L";
const INGREDIENTES_DECLARADOS = "Leche fluida natural entera, enzima lactasa y vitamina D3.";

const ENCONTRADO: ConsultaCodigo = {
  codigo_barras: CODIGO,
  encontrado: true,
  fuente: "open_food_facts",
  fecha_recuperacion: "2026-10-19T15:00:00Z",
  producto: {
    nombre: NOMBRE,
    marca_origen: MARCA,
    presentacion: PRESENTACION,
    ingredientes_declarados: INGREDIENTES_DECLARADOS,
  },
  alergenos: {
    contiene: [{ alergeno_id: 1, codigo: "lacteos", nombre: "Leche", origen: "texto" }],
    trazas: [{ alergeno_id: 2, codigo: "cacahuetes", nombre: "Maní", origen: "etiqueta" }],
    sin_reconocer: [],
  },
  ficha: { product_name: NOMBRE },
};

const INSUMO_CREADO: Insumo = {
  id: 99,
  productor_id: 1,
  ingrediente_id: 1,
  ingrediente: { id: 1, nombre: "Leche" },
  nombre: NOMBRE,
  marca_origen: MARCA,
  presentacion: null,
  codigo_barras: null,
  ingredientes_declarados: null,
  advertencias: null,
  ficha: null,
  fuente: "manual",
  fecha_recuperacion: null,
  habitual: false,
  activo: true,
  created_at: "2026-10-19T12:00:00Z",
  updated_at: "2026-10-19T12:00:00Z",
  alergenos_revisados: true,
  alergenos_revisados_at: "2026-10-19T12:00:00Z",
  alergenos_declarados: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([INGREDIENTE_LECHE]);
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue(CATALOGO);
  vi.mocked(insumoService.listInsumos).mockResolvedValue([]);
  vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(ENCONTRADO);
  vi.mocked(insumoService.createInsumo).mockResolvedValue(INSUMO_CREADO);
});

async function abrirNuevoInsumo(ruta = "/insumos/nuevo/codigo") {
  const user = userEvent.setup();
  renderWithProviders(<App />, { initialEntries: [ruta] });
  await screen.findByRole("heading", { name: "Nuevo insumo", level: 1 });
  if (ruta.endsWith("/manual")) await screen.findByRole("radio", { name: "Leche" });
  return { user, r: new Recorrido(user) };
}

async function guardadoUnaVez(): Promise<InsumoCreatePayload> {
  await waitFor(() => expect(insumoService.createInsumo).toHaveBeenCalledTimes(1));
  expect(await screen.findByRole("heading", { name: "Insumos", level: 1 })).toBeInTheDocument();
  return vi.mocked(insumoService.createInsumo).mock.calls[0][0];
}

// =============================================================================================

describe("Insumo nuevo: por código de barras vs a mano (HU13)", () => {
  it("a mano, solo lo obligatorio: 6 interacciones (3 campos y 3 clics; antes 5: ahora se responde por «puede contener», CA17)", async () => {
    const { r } = await abrirNuevoInsumo("/insumos/nuevo/manual");

    await r.escribir("Nombre", screen.getByLabelText("Nombre"), NOMBRE);
    await r.escribir("Marca u origen", screen.getByLabelText("Marca u origen"), MARCA);
    await r.elegir("Ingrediente", "Leche");
    await r.clic("«Este insumo no contiene alérgenos»", screen.getByLabelText("Este insumo no contiene alérgenos"));
    await r.clic("«El envase no indica puede contener»", screen.getByRole("button", { name: "El envase no indica “puede contener”" }));
    await r.clic("«Confirmar registro»", screen.getByRole("button", { name: "Confirmar registro" }));

    const payload = await guardadoUnaVez();
    expect({ campos: r.campos, clics: r.clics, total: r.total }).toEqual({ campos: 3, clics: 3, total: 6 });
    // And that is all it registers: no presentation, no barcode, no declared ingredients, no allergens.
    expect(payload.codigo_barras).toBeNull();
    expect(payload.ingredientes_declarados).toBeNull();
    expect(payload.alergenos).toEqual([]);
  });

  it("a mano, con la misma información que trae el código: 9 interacciones (6 campos y 3 clics; antes 14: los alérgenos son un clic cada uno)", async () => {
    const { r } = await abrirNuevoInsumo("/insumos/nuevo/manual");

    await r.escribir("Nombre", screen.getByLabelText("Nombre"), NOMBRE);
    await r.escribir("Marca u origen", screen.getByLabelText("Marca u origen"), MARCA);
    await r.elegir("Ingrediente", "Leche");
    await r.escribir("Presentación", screen.getByLabelText("Presentación"), PRESENTACION);
    await r.escribir("Código de barras", screen.getByLabelText("Código de barras"), CODIGO);
    await r.escribir("Ingredientes declarados", screen.getByLabelText("Ingredientes declarados"), INGREDIENTES_DECLARADOS);
    // Leche: contains. Maní: traces. One click each, in the column of its class.
    await r.clic("+ Leche (Contiene)", await screen.findByRole("button", { name: "Agregar Leche a Contiene" }));
    await r.clic("+ Maní (Puede contener)", screen.getByRole("button", { name: "Agregar Maní a Puede contener" }));
    await r.clic("«Confirmar registro»", screen.getByRole("button", { name: "Confirmar registro" }));

    const payload = await guardadoUnaVez();
    expect({ campos: r.campos, clics: r.clics, total: r.total }).toEqual({ campos: 6, clics: 3, total: 9 });
    expect(payload).not.toHaveProperty("fuente");
    expect(payload.alergenos).toEqual([
      { alergeno_id: 1, tipo: "contiene" },
      { alergeno_id: 2, tipo: "trazas" },
    ]);
  });

  it("por código de barras: 5 interacciones (2 campos y 3 clics) y trae toda la información", async () => {
    const { r } = await abrirNuevoInsumo();

    await r.clic("«Abrir cámara»", screen.getByRole("button", { name: "Abrir cámara" }));
    const escaner = await screen.findByRole("dialog", { name: "Escanear código de barras" });
    await r.escribir("Número del código", within(escaner).getByLabelText("Número del código de barras"), CODIGO);
    await r.clic("«Buscar»", within(escaner).getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toHaveValue(NOMBRE));
    await r.elegir("Ingrediente", "Leche");
    await r.clic("«Confirmar registro»", screen.getByRole("button", { name: "Confirmar registro" }));

    const payload = await guardadoUnaVez();
    expect({ campos: r.campos, clics: r.clics, total: r.total }).toEqual({ campos: 2, clics: 3, total: 5 });
    // The same information the 14-interaction manual journey typed, plus where it came from.
    expect(payload).toEqual({
      ingrediente_id: 1,
      nombre: NOMBRE,
      marca_origen: MARCA,
      presentacion: PRESENTACION,
      codigo_barras: CODIGO,
      ingredientes_declarados: INGREDIENTES_DECLARADOS,
      advertencias: null,
      habitual: false,
      fuente: "open_food_facts",
      fecha_recuperacion: "2026-10-19T15:00:00Z",
      ficha: { product_name: NOMBRE },
      alergenos: [
        { alergeno_id: 1, tipo: "contiene" },
        { alergeno_id: 2, tipo: "trazas" },
      ],
    });
  });

  it("por código, el ingrediente elegido en la revisión queda marcado al guardar: son las mismas 5 interacciones", async () => {
    // T07-07: search and review are separate screens, so the ingredient can no longer be chosen BEFORE the lookup;
    // it is chosen on the review, and the journey costs the same 5 interactions.
    const { r } = await abrirNuevoInsumo();

    await r.clic("«Abrir cámara»", screen.getByRole("button", { name: "Abrir cámara" }));
    const escaner = await screen.findByRole("dialog", { name: "Escanear código de barras" });
    await r.escribir("Número del código", within(escaner).getByLabelText("Número del código de barras"), CODIGO);
    await r.clic("«Buscar»", within(escaner).getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toHaveValue(NOMBRE));
    await r.elegir("Ingrediente", "Leche");
    expect(screen.getByRole("radio", { name: "Leche" })).toBeChecked();
    await r.clic("«Confirmar registro»", screen.getByRole("button", { name: "Confirmar registro" }));

    await guardadoUnaVez();
    expect(r.total).toBe(5);
  });

  it("por código, cuyo ingrediente no existe: 8 interacciones (3 campos y 5 clics), sin salir de la página", async () => {
    vi.mocked(ingredientService.listIngredients).mockResolvedValue([]);
    vi.mocked(ingredientService.createIngredient).mockResolvedValue({
      ...INGREDIENTE_LECHE,
      id: 5,
      codigo_interno: "LEC-005",
      nombre: "Leche sin lactosa",
    });
    const { r } = await abrirNuevoInsumo();

    await r.clic("«Abrir cámara»", screen.getByRole("button", { name: "Abrir cámara" }));
    const escaner = await screen.findByRole("dialog", { name: "Escanear código de barras" });
    await r.escribir("Número del código", within(escaner).getByLabelText("Número del código de barras"), CODIGO);
    await r.clic("«Buscar»", within(escaner).getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toHaveValue(NOMBRE));
    // The ingredient does not exist: it is created from here, with the retrieved data still in the form.
    await r.clic("«Crear ingrediente»", screen.getByRole("button", { name: "Crear ingrediente" }));
    const dialogo = await screen.findByRole("dialog", { name: "Nuevo ingrediente" });
    await r.escribir("Código interno", dialogo.querySelector<HTMLElement>('[name="codigo_interno"]')!, "LEC-005");
    await r.escribir("Nombre del ingrediente", dialogo.querySelector<HTMLElement>('[name="nombre"]')!, "Leche sin lactosa");
    await r.clic("«Crear ingrediente» (diálogo)", within(dialogo).getByRole("button", { name: "Crear ingrediente" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nuevo ingrediente" })).not.toBeInTheDocument());
    expect(await screen.findByRole("radio", { name: "Leche sin lactosa" })).toBeChecked();
    expect(screen.getByLabelText("Nombre")).toHaveValue(NOMBRE);
    await r.clic("«Confirmar registro»", screen.getByRole("button", { name: "Confirmar registro" }));

    const payload = await guardadoUnaVez();
    expect({ campos: r.campos, clics: r.clics, total: r.total }).toEqual({ campos: 3, clics: 5, total: 8 });
    expect(payload.ingrediente_id).toBe(5);
    expect(payload.fuente).toBe("open_food_facts");
    expect(payload.alergenos).toHaveLength(2);
  });

  it("el escáner es opcional: el camino a mano no tiene ningún paso más por existir el bloque", async () => {
    const { r } = await abrirNuevoInsumo();
    // The block is there, but the manual journey above (5 interactions) never has to touch it.
    expect(screen.getByRole("button", { name: "Abrir cámara" })).toBeEnabled();
    expect(r.total).toBe(0);
    expect(insumoService.consultarCodigoBarras).not.toHaveBeenCalled();
  });
});
