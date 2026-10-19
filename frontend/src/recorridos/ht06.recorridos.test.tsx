/**
 * HT06-08 — Measurement of the two frequent journeys, with a counter that fails if the flow grows.
 *
 * Counting rule: 1 interaction per click, per selection and per typed field (a field typed in full
 * counts 1, however many keys). Moving between pages with a link counts as a click. Waiting for
 * something to appear counts nothing.
 *
 * - "clic": a button, a link, a checkbox or a radio.
 * - "campo": a value the user types or chooses in a select (text, date, number, unit, product).
 *
 * The API is simulated by a small in-memory world that behaves like the real one on the points the
 * journeys rely on (formulation, supplies, lots, borrador prefilled from the last finalized
 * elaboración, suggested lot, finalization). The unit of measure is the screens, not the server.
 */
import { configure, getConfig, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { hoyChile } from "@/lib/elaboracionUtils";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as formulationService from "@/services/formulationService";
import * as ingredientService from "@/services/ingredientService";
import * as insumoService from "@/services/insumoService";
import * as productService from "@/services/productService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import type { Elaboracion, LoteInsumo, LoteUsado, UsoInsumo } from "@/types/elaboracion";
import type { FormulacionLinea, FormulacionVersion } from "@/types/formulation";
import type { Ingrediente } from "@/types/ingredient";
import type { Insumo } from "@/types/insumo";
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
  getProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  uploadProductImage: vi.fn(),
}));

vi.mock("@/services/ingredientService", () => ({
  listIngredients: vi.fn(),
  createIngredient: vi.fn(),
  listAlergenosCatalog: vi.fn(),
}));

vi.mock("@/services/formulationService", () => ({
  getProductFormulation: vi.fn(),
  saveProductFormulation: vi.fn(),
  listProductVersions: vi.fn(),
  getVersionFormulation: vi.fn(),
}));

vi.mock("@/services/insumoService", () => ({
  listInsumos: vi.fn(),
  createInsumo: vi.fn(),
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

// --- the counter -------------------------------------------------------------------------------

type Usuario = ReturnType<typeof userEvent.setup>;
type Tipo = "clic" | "campo";

interface Paso {
  etapa: string;
  tipo: Tipo;
  paso: string;
}

class Recorrido {
  readonly pasos: Paso[] = [];
  private etapaActual = "";
  private readonly user: Usuario;

  constructor(user: Usuario) {
    this.user = user;
  }

  etapa(nombre: string) {
    this.etapaActual = nombre;
  }

  async clic(paso: string, elemento: HTMLElement) {
    await this.user.click(elemento);
    this.pasos.push({ etapa: this.etapaActual, tipo: "clic", paso });
  }

  async escribir(paso: string, elemento: HTMLElement, texto: string) {
    await this.user.clear(elemento);
    await this.user.type(elemento, texto);
    this.pasos.push({ etapa: this.etapaActual, tipo: "campo", paso });
  }

  async elegir(paso: string, elemento: HTMLElement, valor: string) {
    await this.user.selectOptions(elemento, valor);
    this.pasos.push({ etapa: this.etapaActual, tipo: "campo", paso });
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

  /** etapa -> { clics, campos }, in the order the stages happened. */
  desglose(): Record<string, { clics: number; campos: number }> {
    const resultado: Record<string, { clics: number; campos: number }> = {};
    for (const paso of this.pasos) {
      const etapa = (resultado[paso.etapa] ??= { clics: 0, campos: 0 });
      if (paso.tipo === "clic") etapa.clics += 1;
      else etapa.campos += 1;
    }
    return resultado;
  }
}

// --- the simulated world -------------------------------------------------------------------------

interface Mundo {
  siguiente: { producto: number; ingrediente: number; insumo: number; lote: number; elaboracion: number };
  productos: Product[];
  ingredientes: Ingrediente[];
  /** product id -> ingredient ids, in order */
  formulaciones: Record<number, number[]>;
  insumos: Insumo[];
  lotes: LoteInsumo[];
  elaboraciones: Elaboracion[];
}

function mundoVacio(): Mundo {
  return {
    siguiente: { producto: 1, ingrediente: 1, insumo: 1, lote: 1, elaboracion: 1 },
    productos: [],
    ingredientes: [],
    formulaciones: {},
    insumos: [],
    lotes: [],
    elaboraciones: [],
  };
}

function productoDe(mundo: Mundo, producto: Product): Product {
  return { ...producto, tiene_formulacion: (mundo.formulaciones[producto.id] ?? []).length > 0 };
}

function versionDe(mundo: Mundo, productoId: number): FormulacionVersion {
  const lineas: FormulacionLinea[] = (mundo.formulaciones[productoId] ?? []).map((ingredienteId, indice) => {
    const ingrediente = mundo.ingredientes.find((item) => item.id === ingredienteId)!;
    return {
      id: indice + 1,
      ingrediente_id: ingrediente.id,
      ingrediente_nombre: ingrediente.nombre,
      ingrediente_codigo_interno: ingrediente.codigo_interno,
      ingrediente_tipo: null,
      porcentaje: null,
      cantidad: null,
      unidad: null,
      orden: indice + 1,
      notas: null,
      ingrediente_desactivado: false,
    };
  });
  return {
    id: 100 + productoId,
    producto_id: productoId,
    numero_version: 1,
    descripcion: "Versión 1",
    fecha_creacion: "2026-10-01T12:00:00Z",
    vigente: true,
    usada_en_elaboracion: false,
    lineas,
  };
}

function armarUso(
  mundo: Mundo,
  ingredienteId: number,
  orden: number,
  insumo: Insumo | null,
  lote: LoteInsumo | null,
  sinLote: boolean,
  sugerido: LoteInsumo | null,
): UsoInsumo {
  const ingrediente = mundo.ingredientes.find((item) => item.id === ingredienteId)!;
  const falta: ("insumo" | "lote")[] = [];
  if (!insumo) falta.push("insumo");
  if (!lote && !sinLote) falta.push("lote");
  const comoLoteUsado = (item: LoteInsumo): LoteUsado => ({
    id: item.id,
    codigo: item.codigo,
    fecha_vencimiento: item.fecha_vencimiento,
  });
  return {
    ingrediente_id: ingredienteId,
    ingrediente_nombre: ingrediente.nombre,
    orden,
    cantidad: null,
    unidad: null,
    insumo: insumo
      ? {
          id: insumo.id,
          nombre: insumo.nombre,
          marca_origen: insumo.marca_origen,
          presentacion: insumo.presentacion,
          codigo_barras: insumo.codigo_barras,
          ingredientes_declarados: insumo.ingredientes_declarados,
          advertencias: insumo.advertencias,
          alergenos: [],
          alergenos_revisados_at: insumo.alergenos_revisados_at,
          activo: insumo.activo,
          habitual: insumo.habitual,
        }
      : null,
    lote: lote ? comoLoteUsado(lote) : null,
    lote_sugerido: sugerido ? comoLoteUsado(sugerido) : null,
    sin_lote: sinLote,
    alergenos_revisados: insumo ? insumo.alergenos_revisados : false,
    pendiente: falta.length > 0,
    falta,
    insumo_desactivado: false,
    ingrediente_desactivado: false,
  };
}

function ultimaFinalizada(mundo: Mundo, productoId: number): Elaboracion | undefined {
  return mundo.elaboraciones
    .filter((item) => item.producto.id === productoId && item.estado === "finalizada")
    .sort((a, b) => (a.fecha === b.fecha ? b.id - a.id : a.fecha < b.fecha ? 1 : -1))[0];
}

/** Like the backend: starts from the last finalized elaboración and only SUGGESTS the lot. */
function crearBorrador(mundo: Mundo, productoId: number, codigo: string, fecha: string): Elaboracion {
  const producto = mundo.productos.find((item) => item.id === productoId)!;
  const anterior = ultimaFinalizada(mundo, productoId);
  const usos = (mundo.formulaciones[productoId] ?? []).map((ingredienteId, indice) => {
    const previo = anterior?.usos.find((uso) => uso.ingrediente_id === ingredienteId);
    const insumo =
      mundo.insumos.find(
        (item) =>
          item.id === previo?.insumo?.id && item.activo && item.ingrediente_id === ingredienteId,
      ) ??
      mundo.insumos.find((item) => item.ingrediente_id === ingredienteId && item.habitual && item.activo) ??
      null;
    const sugerido =
      insumo && previo?.lote
        ? mundo.lotes.find(
            (lote) =>
              lote.id === previo.lote!.id &&
              lote.insumo_id === insumo.id &&
              (lote.fecha_vencimiento === null || lote.fecha_vencimiento >= fecha),
          ) ?? null
        : null;
    return armarUso(mundo, ingredienteId, indice + 1, insumo, null, false, sugerido);
  });
  const borrador: Elaboracion = {
    id: mundo.siguiente.elaboracion++,
    producto: { id: producto.id, nombre: producto.nombre },
    version: { id: 100 + productoId, numero_version: 1 },
    codigo,
    fecha,
    estado: "borrador",
    finalizada_at: null,
    created_at: "2026-10-16T12:00:00Z",
    updated_at: "2026-10-16T12:00:00Z",
    usos,
  };
  mundo.elaboraciones.push(borrador);
  return borrador;
}

function instalarApi(mundo: Mundo) {
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listCategories).mockResolvedValue([]);
  vi.mocked(productService.listProducts).mockImplementation(async () =>
    mundo.productos.map((producto) => productoDe(mundo, producto)),
  );
  vi.mocked(productService.getProduct).mockImplementation(async (id) =>
    productoDe(mundo, mundo.productos.find((item) => item.id === id)!),
  );
  vi.mocked(productService.createProduct).mockImplementation(async (payload) => {
    const producto: Product = {
      id: mundo.siguiente.producto++,
      productor_id: 1,
      codigo_interno: payload.codigo_interno,
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      contenido_neto: payload.contenido_neto,
      unidad_medida: payload.unidad_medida,
      presentacion: payload.presentacion ?? null,
      costo_produccion: null,
      precio_venta: null,
      imagen_url: null,
      categorias: [],
      activo: true,
      created_at: "2026-10-16T12:00:00Z",
      tiene_formulacion: false,
    };
    mundo.productos.push(producto);
    return producto;
  });

  vi.mocked(ingredientService.listIngredients).mockImplementation(async () => [...mundo.ingredientes]);
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue([]);
  vi.mocked(ingredientService.createIngredient).mockImplementation(async (payload) => {
    const ingrediente: Ingrediente = {
      id: mundo.siguiente.ingrediente++,
      productor_id: 1,
      codigo_interno: payload.codigo_interno,
      nombre: payload.nombre,
      descripcion: null,
      tipo: null,
      activo: true,
      created_at: "2026-10-16T12:00:00Z",
    };
    mundo.ingredientes.push(ingrediente);
    return ingrediente;
  });

  vi.mocked(formulationService.getProductFormulation).mockImplementation(async (productoId) => {
    const existe = (mundo.formulaciones[productoId] ?? []).length > 0;
    return { existe, version: existe ? versionDe(mundo, productoId) : null };
  });
  vi.mocked(formulationService.listProductVersions).mockResolvedValue([]);
  vi.mocked(formulationService.saveProductFormulation).mockImplementation(async (productoId, payload) => {
    mundo.formulaciones[productoId] = payload.lineas.map((linea) => linea.ingrediente_id);
    return { resultado: "version_creada", version: versionDe(mundo, productoId) };
  });

  vi.mocked(insumoService.listInsumos).mockImplementation(async () =>
    mundo.insumos.filter((insumo) => insumo.activo),
  );
  vi.mocked(insumoService.createInsumo).mockImplementation(async (payload) => {
    const ingrediente = mundo.ingredientes.find((item) => item.id === payload.ingrediente_id)!;
    const revisado = payload.alergenos !== undefined;
    const insumo: Insumo = {
      id: mundo.siguiente.insumo++,
      productor_id: 1,
      ingrediente_id: ingrediente.id,
      ingrediente: { id: ingrediente.id, nombre: ingrediente.nombre },
      nombre: payload.nombre,
      marca_origen: payload.marca_origen,
      presentacion: null,
      codigo_barras: null,
      ingredientes_declarados: null,
      advertencias: null,
      ficha: null,
      fuente: "manual",
      fecha_recuperacion: null,
      habitual: Boolean(payload.habitual),
      activo: true,
      created_at: "2026-10-16T12:00:00Z",
      updated_at: "2026-10-16T12:00:00Z",
      alergenos_revisados: revisado,
      alergenos_revisados_at: revisado ? "2026-10-16T12:00:00Z" : null,
      alergenos_declarados: [],
    };
    mundo.insumos.push(insumo);
    return insumo;
  });

  vi.mocked(elaboracionService.getCodigoSugerido).mockImplementation(async (productoId) => {
    const cantidad = mundo.elaboraciones.filter((item) => item.producto.id === productoId).length;
    return { codigo: `E-${String(cantidad + 1).padStart(3, "0")}` };
  });
  vi.mocked(elaboracionService.listElaboraciones).mockImplementation(async (params = {}) =>
    mundo.elaboraciones
      .filter((item) => (params.estado ? item.estado === params.estado : true))
      .filter((item) => (params.productoId ? item.producto.id === params.productoId : true))
      .map((item) => ({
        id: item.id,
        producto: item.producto,
        version: item.version,
        codigo: item.codigo,
        fecha: item.fecha,
        estado: item.estado,
        finalizada_at: item.finalizada_at,
        total_ingredientes: item.usos.length,
        pendientes: item.usos.filter((uso) => uso.pendiente).length,
      })),
  );
  vi.mocked(elaboracionService.createElaboracion).mockImplementation(async (productoId, payload) =>
    crearBorrador(mundo, productoId, payload?.codigo ?? "E-001", payload?.fecha ?? hoyChile()),
  );
  vi.mocked(elaboracionService.getElaboracion).mockImplementation(async (id) =>
    mundo.elaboraciones.find((item) => item.id === id)!,
  );
  vi.mocked(elaboracionService.listLotesInsumo).mockImplementation(async (insumoId) =>
    mundo.lotes.filter((lote) => lote.insumo_id === insumoId),
  );
  vi.mocked(elaboracionService.replaceUsos).mockImplementation(async (id, usos) => {
    const elaboracion = mundo.elaboraciones.find((item) => item.id === id)!;
    elaboracion.usos = usos.map((item, indice) => {
      const insumo = item.insumo_id ? mundo.insumos.find((candidato) => candidato.id === item.insumo_id)! : null;
      let lote: LoteInsumo | null = null;
      if (insumo && item.lote?.tipo === "nuevo") {
        lote = {
          id: mundo.siguiente.lote++,
          insumo_id: insumo.id,
          codigo: item.lote.codigo,
          fecha_vencimiento: item.lote.fecha_vencimiento,
          created_at: "2026-10-16T12:00:00Z",
        };
        mundo.lotes.push(lote);
      } else if (insumo && item.lote?.tipo === "existente") {
        lote = mundo.lotes.find((candidato) => candidato.id === (item.lote as { lote_id: number }).lote_id)!;
      }
      return armarUso(mundo, item.ingrediente_id, indice + 1, insumo, lote, item.lote?.tipo === "sin_lote", null);
    });
    return elaboracion;
  });
  vi.mocked(elaboracionService.finalizarElaboracion).mockImplementation(async (id) => {
    const elaboracion = mundo.elaboraciones.find((item) => item.id === id)!;
    if (elaboracion.usos.some((uso) => uso.pendiente)) throw new Error("incompleta");
    elaboracion.estado = "finalizada";
    elaboracion.finalizada_at = "2026-10-16T18:30:00Z";
    elaboracion.usos = elaboracion.usos.map((uso) => ({
      ...uso,
      lote_sugerido: null,
      insumo: uso.insumo ? { ...uso.insumo, activo: null, habitual: null } : null,
      alergenos_revisados: true,
    }));
    return elaboracion;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setAccessToken("valid-token");
});

const linea = (nombre: string) => screen.getByRole("region", { name: nombre });

/*
 * Waiting time. These journeys cross whole pages of the App (mount + simulated API + render), so one
 * wait is a page transition, not a field. Measured with every core busy, 1,020 waits of the two
 * journeys: median 0.2 s, 29 waits over 2 s and 5 over 3 s, up to 5.1 s, past the 4 s of the rest of
 * the suite (setup.ts); two of six runs failed on it. 15 s is three times the worst wait seen. The
 * rest of the suite keeps 4 s: this only applies to this file.
 */
const ESPERA_TRANSICION_MS = 15_000;
/** The B journeys took up to 15.3 s in total under the same load, over the 15 s default; A has 120 s. */
const TIEMPO_MAXIMO_RECORRIDO_B_MS = 60_000;

const ESPERA_ASYNC_DE_LA_SUITE = getConfig().asyncUtilTimeout;
beforeAll(() => {
  configure({ asyncUtilTimeout: ESPERA_TRANSICION_MS });
});
afterAll(() => {
  configure({ asyncUtilTimeout: ESPERA_ASYNC_DE_LA_SUITE });
});

/**
 * Arrival at the detail of a FINALIZED elaboración. The registro screen and the detail share the
 * same title («Elaboración E-002»), so the title alone proves nothing: it is found on the registro
 * screen right before that screen is replaced, and the node it returns can be gone by the time it is
 * asserted. The «Finalizada» badge exists only in the detail, so it is awaited first.
 */
async function esperarDetalleDeFinalizada(codigo: string, espera?: number) {
  const opciones = espera === undefined ? undefined : { timeout: espera };
  expect(await screen.findByText("Finalizada", undefined, opciones)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: `Elaboración ${codigo}`, level: 1 })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Finalizar elaboración" })).not.toBeInTheDocument();
}

// =============================================================================================
// Escenario B: segunda elaboración del mismo producto, con los mismos insumos y los mismos lotes.
// =============================================================================================

describe("Escenario B (HT06-08): segunda elaboración con los mismos insumos y lotes", () => {
  function mundoConUnaElaboracionAnterior(harinaSinLote = false): Mundo {
    const mundo = mundoVacio();
    const queque = {
      id: 5,
      nombre: "Queque de vainilla",
    };
    for (const [id, nombre] of [
      [5, queque.nombre],
      [6, "Pan amasado"],
    ] as const) {
      mundo.productos.push({
        id,
        productor_id: 1,
        codigo_interno: `P-${id}`,
        nombre,
        descripcion: "Producto",
        contenido_neto: "250.000",
        unidad_medida: "g",
        presentacion: null,
        costo_produccion: null,
        precio_venta: "1000",
        imagen_url: "/uploads/x.png",
        categorias: [{ id: 1, nombre: "Pastelería" }],
        activo: true,
        created_at: "2026-08-10T12:00:00Z",
        tiene_formulacion: true,
      });
    }
    for (const [id, nombre, codigo] of [
      [1, "Harina", "har-001"],
      [2, "Leche", "lec-001"],
    ] as const) {
      mundo.ingredientes.push({
        id,
        productor_id: 1,
        codigo_interno: codigo,
        nombre,
        descripcion: null,
        tipo: null,
        activo: true,
        created_at: "2026-08-01T12:00:00Z",
      });
    }
    mundo.formulaciones[5] = [1, 2];
    mundo.formulaciones[6] = [1];
    mundo.siguiente = { producto: 7, ingrediente: 3, insumo: 30, lote: 70, elaboracion: 20 };
    const insumo = (id: number, ingredienteId: number, nombre: string): Insumo => ({
      id,
      productor_id: 1,
      ingrediente_id: ingredienteId,
      ingrediente: { id: ingredienteId, nombre: ingredienteId === 1 ? "Harina" : "Leche" },
      nombre,
      marca_origen: "Marca",
      presentacion: null,
      codigo_barras: null,
      ingredientes_declarados: null,
      advertencias: null,
      ficha: null,
      fuente: "manual",
      fecha_recuperacion: null,
      habitual: false,
      activo: true,
      created_at: "2026-08-02T12:00:00Z",
      updated_at: "2026-08-02T12:00:00Z",
      alergenos_revisados: true,
      alergenos_revisados_at: "2026-08-02T12:00:00Z",
      alergenos_declarados: [],
    });
    const harina = insumo(20, 1, "Harina Selecta 1 kg");
    const leche = insumo(10, 2, "Leche Colun 1 L");
    mundo.insumos.push(harina, leche);
    const loteHarina: LoteInsumo = { id: 60, insumo_id: 20, codigo: "H-77", fecha_vencimiento: "2099-12-31", created_at: "2026-08-03T12:00:00Z" };
    const loteLeche: LoteInsumo = { id: 50, insumo_id: 10, codigo: "X123", fecha_vencimiento: "2099-12-31", created_at: "2026-08-03T12:00:00Z" };
    mundo.lotes.push(loteHarina, loteLeche);
    // E-001: finalized, with the supplies and lots the next one will repeat.
    mundo.elaboraciones.push({
      id: 19,
      producto: { id: 5, nombre: queque.nombre },
      version: { id: 105, numero_version: 1 },
      codigo: "E-001",
      fecha: "2026-09-01",
      estado: "finalizada",
      finalizada_at: "2026-09-01T18:00:00Z",
      created_at: "2026-09-01T12:00:00Z",
      updated_at: "2026-09-01T18:00:00Z",
      usos: [
        armarUso(mundo, 1, 1, harina, harinaSinLote ? null : loteHarina, harinaSinLote, null),
        armarUso(mundo, 2, 2, leche, loteLeche, false, null),
      ],
    });
    return mundo;
  }

  async function recorrer(mundo: Mundo, harinaSinLote: boolean) {
    instalarApi(mundo);
    const user = userEvent.setup();
    const r = new Recorrido(user);
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });
    await screen.findByRole("heading", { name: /Bienvenida/ });

    r.etapa("Dashboard → crear el borrador");
    await waitFor(() => expect(screen.getByRole("button", { name: "Nueva elaboración" })).toBeEnabled());
    await r.clic("«Nueva elaboración»", screen.getByRole("button", { name: "Nueva elaboración" }));
    const dialogo = await screen.findByRole("dialog", { name: "Registrar elaboración" });
    await r.elegir("Producto: Queque de vainilla", within(dialogo).getByLabelText("Producto"), "5");
    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-002"));
    await r.clic("«Crear borrador» (código y fecha ya sugeridos)", within(dialogo).getByRole("button", { name: "Crear borrador" }));

    r.etapa("Registro: lotes");
    await screen.findByRole("heading", { name: "Elaboración E-002", level: 1 });
    // Both supplies come preselected from the last finalized elaboración; no lot is assigned by itself.
    await waitFor(() => expect(screen.getByLabelText("Insumo de Harina")).toHaveValue("20"));
    expect(screen.getByLabelText("Insumo de Leche")).toHaveValue("10");
    await r.clic("«Usar los mismos lotes»", await screen.findByRole("button", { name: "Usar los mismos lotes" }));
    if (harinaSinLote) {
      // The last time, Harina had no lot: there is nothing to suggest and the line asks for its choice.
      await r.clic("Harina: «Sin lote»", within(linea("Harina")).getByRole("radio", { name: "Sin lote" }));
    }

    r.etapa("Finalizar");
    await r.clic("«Finalizar elaboración» (guarda el borrador por sí sola)", screen.getByRole("button", { name: "Finalizar elaboración" }));
    await r.clic("Confirmar «Finalizar»", await screen.findByRole("button", { name: "Finalizar" }));

    // The goal of the journey: the detail of the finalized elaboración.
    await esperarDetalleDeFinalizada("E-002");
    return r;
  }

  it("con los mismos insumos y lotes toma 6 interacciones desde el Dashboard hasta el detalle de la finalizada (meta CA11: 7 o menos)", async () => {
    const mundo = mundoConUnaElaboracionAnterior();

    const r = await recorrer(mundo, false);

    expect(r.desglose()).toEqual({
      "Dashboard → crear el borrador": { clics: 2, campos: 1 },
      "Registro: lotes": { clics: 1, campos: 0 },
      Finalizar: { clics: 2, campos: 0 },
    });
    expect(r.total).toBe(6);
    expect(r.total).toBeLessThanOrEqual(7);
    // What was finalized is what the journey meant: the same supplies and the same lots.
    const finalizada = mundo.elaboraciones.find((item) => item.codigo === "E-002")!;
    expect(finalizada.estado).toBe("finalizada");
    expect(finalizada.usos.map((uso) => [uso.insumo?.id, uso.lote?.id])).toEqual([
      [20, 60],
      [10, 50],
    ]);
    // No new lot was created: the existing ones were reused.
    expect(mundo.lotes).toHaveLength(2);
  }, TIEMPO_MAXIMO_RECORRIDO_B_MS);

  it("si en la anterior un ingrediente no tenía lote, solo suma el «Sin lote» de esa línea: 7 interacciones", async () => {
    const mundo = mundoConUnaElaboracionAnterior(true);

    const r = await recorrer(mundo, true);

    expect(r.desglose()).toEqual({
      "Dashboard → crear el borrador": { clics: 2, campos: 1 },
      "Registro: lotes": { clics: 2, campos: 0 },
      Finalizar: { clics: 2, campos: 0 },
    });
    expect(r.total).toBe(7);
    expect(r.total).toBeLessThanOrEqual(7);
  }, TIEMPO_MAXIMO_RECORRIDO_B_MS);

  // The cause of the intermittent failure of the two journeys above, pinned down without any load.
  it("el registro y el detalle comparten el título: solo la insignia «Finalizada» identifica el detalle", async () => {
    const mundo = mundoConUnaElaboracionAnterior();
    crearBorrador(mundo, 5, "E-002", "2026-10-16");
    instalarApi(mundo);
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones/20/registro"] });

    // On the registro screen the title is already there...
    expect(await screen.findByRole("heading", { name: "Elaboración E-002", level: 1 })).toBeInTheDocument();
    // ...and that must not count as having arrived at the detail.
    await expect(esperarDetalleDeFinalizada("E-002", 300)).rejects.toThrow();
  });

  it("reconoce el detalle de una elaboración finalizada", async () => {
    const mundo = mundoConUnaElaboracionAnterior();
    instalarApi(mundo);
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones/19"] });

    await esperarDetalleDeFinalizada("E-001");
  });
});

// =============================================================================================
// Escenario A: producto nuevo con 5 ingredientes que no existen, hasta finalizar su primera elaboración.
// =============================================================================================

describe("Escenario A (HT06-08): producto nuevo con 5 ingredientes nuevos, hasta finalizar la primera elaboración", () => {
  const INGREDIENTES = [
    ["HAR-001", "Harina"],
    ["LEC-001", "Leche"],
    ["HUE-001", "Huevos"],
    ["AZU-001", "Azúcar"],
    ["MAN-001", "Mantequilla"],
  ] as const;

  it("mide el recorrido completo tal cual está hoy, con la declaración de alérgenos de cada insumo nuevo", async () => {
    const mundo = mundoVacio();
    instalarApi(mundo);
    const user = userEvent.setup();
    const r = new Recorrido(user);
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });
    await screen.findByRole("heading", { name: /Bienvenida/ });

    // 1. The product.
    r.etapa("Producto nuevo");
    await r.clic("«+ Nuevo producto»", screen.getByRole("link", { name: "+ Nuevo producto" }));
    await screen.findByRole("heading", { name: "Nuevo producto", level: 1 });
    await r.escribir("Código interno", screen.getByLabelText(/Código interno/), "QUE-001");
    await r.escribir("Nombre", screen.getByLabelText(/^Nombre/), "Queque de vainilla");
    await r.escribir("Descripción", screen.getByLabelText(/Descripción/), "Queque casero");
    await r.escribir("Contenido neto", screen.getByLabelText(/Contenido neto/), "500");
    await r.elegir("Unidad de medida", screen.getByLabelText(/Unidad de medida/), "g");
    await r.clic("«Guardar producto»", screen.getByRole("button", { name: "Guardar producto" }));
    // A created product opens its own detail (HT06-07): no extra click to get to it.
    await screen.findByRole("heading", { name: "Queque de vainilla", level: 1 });

    // 2. The formulation, creating its 5 ingredients on the spot.
    r.etapa("Formulación (5 ingredientes nuevos)");
    await r.clic("«Definir formulación»", await screen.findByRole("button", { name: "Definir formulación" }));
    for (const [codigo, nombre] of INGREDIENTES) {
      await waitFor(() => expect(screen.queryByText("Cargando ingredientes...")).not.toBeInTheDocument());
      await r.clic(`${nombre}: «Crear ingrediente nuevo»`, screen.getByRole("button", { name: "Crear ingrediente nuevo" }));
      const dialogo = screen.getByRole("dialog", { name: "Nuevo ingrediente" });
      await r.escribir(`${nombre}: código interno`, within(dialogo).getByRole("textbox", { name: /Código interno/ }), codigo);
      await r.escribir(`${nombre}: nombre`, within(dialogo).getByRole("textbox", { name: /^Nombre/ }), nombre);
      await r.clic(`${nombre}: «Crear ingrediente»`, within(dialogo).getByRole("button", { name: "Crear ingrediente" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    }
    await r.clic("«Guardar formulación»", screen.getByRole("button", { name: "Guardar formulación" }));

    // 3. The borrador.
    r.etapa("Crear el borrador");
    await r.clic("«Registrar elaboración»", await screen.findByRole("button", { name: "Registrar elaboración" }));
    const dialogoElaboracion = await screen.findByRole("dialog", { name: "Registrar elaboración" });
    await waitFor(() => expect(within(dialogoElaboracion).getByLabelText("Código de la elaboración")).toHaveValue("E-001"));
    await r.clic("«Crear borrador» (código y fecha ya sugeridos)", within(dialogoElaboracion).getByRole("button", { name: "Crear borrador" }));
    await screen.findByRole("heading", { name: "Elaboración E-001", level: 1 });

    // 4. Each line: a new supply (with its allergens confirmed) and a new lot.
    r.etapa("Insumos y lotes (5 líneas)");
    for (const [, nombre] of INGREDIENTES) {
      await r.clic(`${nombre}: «Registrar insumo nuevo»`, within(await waitForLinea(nombre)).getByRole("button", { name: /Registrar insumo nuevo/ }));
      const dialogo = await screen.findByRole("dialog", { name: "Registrar insumo nuevo" });
      await r.escribir(`${nombre}: nombre del insumo`, within(dialogo).getByLabelText("Nombre"), `${nombre} Selecta`);
      await r.escribir(`${nombre}: marca u origen`, within(dialogo).getByLabelText("Marca u origen"), "Selecta");
      await r.clic(`${nombre}: «Este insumo no contiene alérgenos»`, within(dialogo).getByLabelText("Este insumo no contiene alérgenos"));
      await r.clic(`${nombre}: «Registrar insumo»`, within(dialogo).getByRole("button", { name: "Registrar insumo" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await r.clic(`${nombre}: «Lote nuevo»`, await within(linea(nombre)).findByRole("radio", { name: "Lote nuevo" }));
      await r.escribir(`${nombre}: código del lote`, within(linea(nombre)).getByLabelText("Código del lote"), `L-${nombre.slice(0, 3).toUpperCase()}`);
    }

    // 5. Finalize.
    r.etapa("Finalizar");
    await r.clic("«Finalizar elaboración» (guarda el borrador por sí sola)", screen.getByRole("button", { name: "Finalizar elaboración" }));
    await r.clic("Confirmar «Finalizar»", await screen.findByRole("button", { name: "Finalizar" }));
    await esperarDetalleDeFinalizada("E-001");

    // The count. Every stage is asserted, so the test fails if any of them grows.
    expect(r.desglose()).toEqual({
      "Producto nuevo": { clics: 2, campos: 5 },
      "Formulación (5 ingredientes nuevos)": { clics: 12, campos: 10 },
      "Crear el borrador": { clics: 2, campos: 0 },
      "Insumos y lotes (5 líneas)": { clics: 20, campos: 15 },
      Finalizar: { clics: 2, campos: 0 },
    });
    expect(r.clics).toBe(38);
    expect(r.campos).toBe(30);
    expect(r.total).toBe(68);
    // What the journey built.
    const finalizada = mundo.elaboraciones[0];
    expect(finalizada.estado).toBe("finalizada");
    expect(finalizada.usos).toHaveLength(5);
    expect(finalizada.usos.every((uso) => uso.alergenos_revisados === true && uso.lote !== null)).toBe(true);
    expect(mundo.insumos).toHaveLength(5);
    expect(mundo.insumos.every((insumo) => insumo.alergenos_revisados)).toBe(true);
  }, 120_000);

  async function waitForLinea(nombre: string) {
    return screen.findByRole("region", { name: nombre });
  }
});
