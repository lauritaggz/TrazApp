import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { hoyChile, TEXTO_CONFIRMAR_FINALIZACION } from "@/lib/elaboracionUtils";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as formulationService from "@/services/formulationService";
import * as insumoService from "@/services/insumoService";
import * as productService from "@/services/productService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type {
  Elaboracion,
  ElaboracionResumen,
  LoteInsumo,
  UsoInsumo,
  UsoPayload,
} from "@/types/elaboracion";
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
  createProduct: vi.fn(),
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  uploadProductImage: vi.fn(),
  deleteProduct: vi.fn(),
}));

vi.mock("@/services/formulationService", () => ({
  getProductFormulation: vi.fn(),
  saveProductFormulation: vi.fn(),
  listProductVersions: vi.fn(),
  getVersionFormulation: vi.fn(),
}));

vi.mock("@/services/insumoService", () => ({
  listInsumos: vi.fn(),
  getInsumo: vi.fn(),
  createInsumo: vi.fn(),
  updateInsumo: vi.fn(),
  deactivateInsumo: vi.fn(),
  reactivateInsumo: vi.fn(),
  listInsumoAlergenos: vi.fn(),
  addInsumoAlergeno: vi.fn(),
  updateInsumoAlergenoTipo: vi.fn(),
  deleteInsumoAlergeno: vi.fn(),
}));

vi.mock("@/services/ingredientService", () => ({
  listIngredients: vi.fn().mockResolvedValue([]),
  getIngredient: vi.fn(),
  createIngredient: vi.fn(),
  updateIngredient: vi.fn(),
  deleteIngredient: vi.fn(),
  listIngredientComposition: vi.fn(),
  addCompositionComponent: vi.fn(),
  updateCompositionComponent: vi.fn(),
  deleteCompositionComponent: vi.fn(),
  listIngredientAllergens: vi.fn(),
  addIngredientAllergen: vi.fn(),
  deleteIngredientAllergen: vi.fn(),
  listAlergenosCatalog: vi.fn(),
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

// --- datos ---

const HARINA = 1;
const LECHE = 2;

const PRODUCTO: Product = {
  id: 5,
  productor_id: 1,
  codigo_interno: "QUE-001",
  nombre: "Queque de vainilla",
  descripcion: "Queque casero",
  contenido_neto: "500.000",
  unidad_medida: "g",
  presentacion: null,
  costo_produccion: null,
  precio_venta: null,
  imagen_url: null,
  categorias: [],
  activo: true,
  created_at: "2026-09-01T12:00:00Z",
};

function insumo(overrides: Partial<Insumo> & { id: number; ingrediente_id: number }): Insumo {
  return {
    productor_id: 1,
    ingrediente: { id: overrides.ingrediente_id, nombre: overrides.ingrediente_id === LECHE ? "Leche" : "Harina" },
    nombre: "Insumo",
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
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    alergenos_declarados: [],
    ...overrides,
  };
}

const INS_HABITUAL = insumo({ id: 10, ingrediente_id: LECHE, nombre: "Leche Colun Semidescremada 1 L", marca_origen: "Colun", habitual: true });
const INS_OTRO = insumo({ id: 11, ingrediente_id: LECHE, nombre: "Leche Soprole Entera 1 L", marca_origen: "Soprole" });
const INSUMOS_ACTIVOS = [INS_HABITUAL, INS_OTRO];

const LOTE_X: LoteInsumo = { id: 50, insumo_id: 10, codigo: "X123", fecha_vencimiento: "2026-10-15", created_at: "2026-10-01T12:00:00Z" };

function insumoUsado(i: Insumo) {
  return {
    id: i.id,
    nombre: i.nombre,
    marca_origen: i.marca_origen,
    presentacion: i.presentacion,
    codigo_barras: i.codigo_barras,
    ingredientes_declarados: i.ingredientes_declarados,
    advertencias: i.advertencias,
    alergenos: [],
    activo: i.activo,
    habitual: i.habitual,
  };
}

function uso(overrides: Partial<UsoInsumo> & { ingrediente_id: number }): UsoInsumo {
  return {
    ingrediente_nombre: overrides.ingrediente_id === LECHE ? "Leche" : "Harina",
    orden: overrides.ingrediente_id === HARINA ? 1 : 2,
    cantidad: null,
    unidad: null,
    insumo: null,
    lote: null,
    sin_lote: false,
    pendiente: true,
    falta: ["insumo", "lote"],
    insumo_desactivado: false,
    ingrediente_desactivado: false,
    ...overrides,
  };
}

function elaboracion(overrides: Partial<Elaboracion> = {}): Elaboracion {
  return {
    id: 30,
    producto: { id: 5, nombre: "Queque de vainilla" },
    version: { id: 1, numero_version: 1 },
    codigo: "E-001",
    fecha: "2026-10-06",
    estado: "borrador",
    finalizada_at: null,
    created_at: "2026-10-06T12:00:00Z",
    updated_at: "2026-10-06T12:00:00Z",
    usos: [
      uso({ ingrediente_id: HARINA, cantidad: "500", unidad: "g" }),
      uso({ ingrediente_id: LECHE, insumo: insumoUsado(INS_HABITUAL), falta: ["lote"] }),
    ],
    ...overrides,
  };
}

const BORRADOR = elaboracion();

/** Both lines complete (what the server answers after saving a full assignment). */
const BORRADOR_COMPLETO = elaboracion({
  usos: [
    uso({ ingrediente_id: HARINA, cantidad: "500", unidad: "g", insumo: insumoUsado(insumo({ id: 20, ingrediente_id: HARINA, nombre: "Harina Selecta 1 kg" })), sin_lote: true, pendiente: false, falta: [] }),
    uso({ ingrediente_id: LECHE, insumo: insumoUsado(INS_HABITUAL), lote: { id: 50, codigo: "X123", fecha_vencimiento: "2026-10-15" }, pendiente: false, falta: [] }),
  ],
});

const INS_HARINA = insumo({ id: 20, ingrediente_id: HARINA, nombre: "Harina Selecta 1 kg", marca_origen: "Selecta", habitual: true });

const FINALIZADA: Elaboracion = elaboracion({
  id: 31,
  estado: "finalizada",
  finalizada_at: "2026-10-06T18:30:00Z",
  usos: [
    uso({ ingrediente_id: HARINA, insumo: { ...insumoUsado(INS_HARINA), activo: null, habitual: null }, sin_lote: true, pendiente: false, falta: [] }),
    uso({ ingrediente_id: LECHE, insumo: { ...insumoUsado(INS_HABITUAL), activo: null, habitual: null }, lote: { id: 50, codigo: "X123", fecha_vencimiento: "2026-10-15" }, pendiente: false, falta: [] }),
  ],
});

function resumen(id: number, codigo: string, fecha: string, estado: "borrador" | "finalizada"): ElaboracionResumen {
  return {
    id,
    producto: { id: 5, nombre: "Queque de vainilla" },
    version: { id: 1, numero_version: 1 },
    codigo,
    fecha,
    estado,
    finalizada_at: estado === "finalizada" ? "2026-10-01T12:00:00Z" : null,
    total_ingredientes: 2,
    pendientes: estado === "borrador" ? 1 : 0,
  };
}

const FORMULACION = {
  existe: true,
  version: {
    id: 1,
    producto_id: 5,
    numero_version: 1,
    descripcion: "Versión 1",
    fecha_creacion: "2026-09-01T12:00:00Z",
    vigente: true,
    usada_en_elaboracion: false,
    lineas: [],
  },
};

function openPage(path: string) {
  return renderWithProviders(<App />, { initialEntries: [path] });
}

async function openRegistro() {
  openPage("/elaboraciones/30/registro");
  await screen.findByRole("heading", { name: "Elaboración E-001", level: 1 });
  await screen.findByLabelText("Insumo de Leche");
}

function linea(nombre: string) {
  return screen.getByRole("region", { name: nombre });
}

/** What the server would answer for a full assignment: built from the PUT payload. */
function respuestaDe(usos: UsoPayload[]): Elaboracion {
  const catalogo = [...INSUMOS_ACTIVOS, INS_HARINA];
  return elaboracion({
    usos: usos.map((item) => {
      const i = catalogo.find((candidato) => candidato.id === item.insumo_id) ?? null;
      const lote =
        item.lote?.tipo === "nuevo"
          ? { id: 99, codigo: item.lote.codigo, fecha_vencimiento: item.lote.fecha_vencimiento }
          : item.lote?.tipo === "existente"
            ? { id: item.lote.lote_id, codigo: "X123", fecha_vencimiento: "2026-10-15" }
            : null;
      const sinLote = item.lote?.tipo === "sin_lote";
      return uso({
        ingrediente_id: item.ingrediente_id,
        insumo: i ? insumoUsado(i) : null,
        lote,
        sin_lote: sinLote,
        pendiente: !i || (!lote && !sinLote),
        falta: [],
      });
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.getProduct).mockResolvedValue(PRODUCTO);
  vi.mocked(productService.listProducts).mockResolvedValue([PRODUCTO]);
  vi.mocked(productService.listCategories).mockResolvedValue([]);
  vi.mocked(formulationService.getProductFormulation).mockResolvedValue(FORMULACION);
  vi.mocked(formulationService.listProductVersions).mockResolvedValue([]);
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue([]);
  vi.mocked(elaboracionService.getElaboracion).mockImplementation(async (id) => {
    if (id === 30) return BORRADOR;
    if (id === 31) return FINALIZADA;
    throw new ApiError("Elaboración no encontrada", 404);
  });
  vi.mocked(insumoService.listInsumos).mockResolvedValue(INSUMOS_ACTIVOS);
  vi.mocked(elaboracionService.listLotesInsumo).mockImplementation(async (insumoId) =>
    insumoId === 10 ? [LOTE_X] : [],
  );
  vi.mocked(elaboracionService.replaceUsos).mockImplementation(async (_id, usos) => respuestaDe(usos));
  vi.mocked(elaboracionService.updateElaboracion).mockImplementation(async (_id, payload) =>
    elaboracion({ codigo: payload.codigo ?? "E-001", fecha: payload.fecha ?? "2026-10-06" }),
  );
  vi.mocked(elaboracionService.finalizarElaboracion).mockResolvedValue(FINALIZADA);
  vi.mocked(elaboracionService.deleteElaboracion).mockResolvedValue(undefined);
});

// --- acceso desde el producto ---

describe("Detalle del producto: elaboraciones", () => {
  it("muestra «Registrar elaboración» solo si el producto tiene formulación", async () => {
    openPage("/productos/5");
    expect(await screen.findByRole("button", { name: "Registrar elaboración" })).toBeInTheDocument();
  });

  it("sin formulación no ofrece el botón y lo explica", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue({ existe: false, version: null });
    openPage("/productos/5");

    expect(
      await screen.findByText("Define la formulación del producto para poder registrar elaboraciones."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar elaboración" })).not.toBeInTheDocument();
  });

  it("lista las elaboraciones más recientes con código, fecha y estado, y enlaza cada una", async () => {
    vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue([
      resumen(32, "E-003", "2026-10-05", "borrador"),
      resumen(31, "E-002", "2026-10-01", "finalizada"),
    ]);
    openPage("/productos/5");

    const borrador = await screen.findByRole("link", { name: /E-003/ });
    expect(borrador).toHaveTextContent("05-10-2026");
    expect(borrador).toHaveTextContent("Borrador");
    // Los borradores se abren en la pantalla de registro; las finalizadas, en su detalle.
    expect(borrador).toHaveAttribute("href", "/elaboraciones/32/registro");
    const finalizada = screen.getByRole("link", { name: /E-002/ });
    expect(finalizada).toHaveTextContent("Finalizada");
    expect(finalizada).toHaveAttribute("href", "/elaboraciones/31");
    expect(elaboracionService.listElaboraciones).toHaveBeenCalledWith({ productoId: 5 });
  });

  it("muestra solo las cinco más recientes", async () => {
    vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => resumen(100 + i, `E-0${7 - i}`, "2026-10-01", "finalizada")),
    );
    openPage("/productos/5");

    await screen.findByRole("link", { name: /E-07/ });
    expect(screen.getAllByRole("link", { name: /^E-0\d/ })).toHaveLength(5);
  });

  it("sin elaboraciones lo dice", async () => {
    openPage("/productos/5");

    expect(await screen.findByText("Aún no hay elaboraciones de este producto.")).toBeInTheDocument();
  });

  it("muestra el estado de carga y el error con reintento", async () => {
    vi.mocked(elaboracionService.listElaboraciones).mockRejectedValueOnce(new ApiError("falla", 500));
    const user = userEvent.setup();
    openPage("/productos/5");

    expect(await screen.findByText("No pudimos cargar las elaboraciones.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Aún no hay elaboraciones de este producto.")).toBeInTheDocument();
  });
});

// --- diálogo «Registrar elaboración» ---

describe("Diálogo «Registrar elaboración»", () => {
  beforeEach(() => {
    vi.mocked(elaboracionService.getCodigoSugerido).mockResolvedValue({ codigo: "E-001" });
    vi.mocked(elaboracionService.createElaboracion).mockResolvedValue(BORRADOR);
  });

  async function abrirDialogo(user: ReturnType<typeof userEvent.setup>) {
    openPage("/productos/5");
    await user.click(await screen.findByRole("button", { name: "Registrar elaboración" }));
    return screen.findByRole("dialog", { name: "Registrar elaboración" });
  }

  it("el botón solo abre el diálogo: todavía no se crea nada", async () => {
    const user = userEvent.setup();
    await abrirDialogo(user);

    expect(elaboracionService.createElaboracion).not.toHaveBeenCalled();
  });

  it("abre con el código sugerido (editable) y la fecha de hoy sin fechas futuras", async () => {
    const user = userEvent.setup();
    const dialogo = await abrirDialogo(user);

    expect(elaboracionService.getCodigoSugerido).toHaveBeenCalledWith(5);
    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-001"));
    const fecha = within(dialogo).getByLabelText("Fecha de elaboración");
    expect(fecha).toHaveValue(hoyChile());
    expect(fecha).toHaveAttribute("max", hoyChile());
  });

  it("abrir y cancelar no crea nada y no deja rastro", async () => {
    const user = userEvent.setup();
    const dialogo = await abrirDialogo(user);
    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-001"));

    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(elaboracionService.createElaboracion).not.toHaveBeenCalled();
    expect(elaboracionService.replaceUsos).not.toHaveBeenCalled();
    expect(elaboracionService.deleteElaboracion).not.toHaveBeenCalled();
    // Seguimos en el detalle del producto.
    expect(screen.getByRole("heading", { name: "Queque de vainilla", level: 1 })).toBeInTheDocument();
  });

  it("Escape también cierra sin crear", async () => {
    const user = userEvent.setup();
    await abrirDialogo(user);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(elaboracionService.createElaboracion).not.toHaveBeenCalled();
  });

  it("cada vez que se abre pide un código sugerido nuevo", async () => {
    const user = userEvent.setup();
    let dialogo = await abrirDialogo(user);
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    vi.mocked(elaboracionService.getCodigoSugerido).mockResolvedValue({ codigo: "E-002" });

    await user.click(screen.getByRole("button", { name: "Registrar elaboración" }));
    dialogo = await screen.findByRole("dialog", { name: "Registrar elaboración" });

    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-002"));
    expect(elaboracionService.getCodigoSugerido).toHaveBeenCalledTimes(2);
  });

  it("al confirmar crea el borrador con el código y la fecha y abre la pantalla de registro", async () => {
    const user = userEvent.setup();
    const dialogo = await abrirDialogo(user);
    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-001"));

    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));

    await waitFor(() =>
      expect(elaboracionService.createElaboracion).toHaveBeenCalledWith(5, {
        codigo: "E-001",
        fecha: hoyChile(),
      }),
    );
    expect(elaboracionService.createElaboracion).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: "Elaboración E-001", level: 1 })).toBeInTheDocument();
  });

  it("el código y la fecha se pueden cambiar antes de crear", async () => {
    const user = userEvent.setup();
    const dialogo = await abrirDialogo(user);
    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-001"));

    await user.clear(within(dialogo).getByLabelText("Código de la elaboración"));
    await user.type(within(dialogo).getByLabelText("Código de la elaboración"), "  LOTE-77 ");
    fireEvent.change(within(dialogo).getByLabelText("Fecha de elaboración"), { target: { value: "2026-09-15" } });
    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));

    await waitFor(() =>
      expect(elaboracionService.createElaboracion).toHaveBeenCalledWith(5, {
        codigo: "LOTE-77",
        fecha: "2026-09-15",
      }),
    );
  });

  it("no crea con el código vacío ni con una fecha futura", async () => {
    const user = userEvent.setup();
    const dialogo = await abrirDialogo(user);
    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-001"));

    await user.clear(within(dialogo).getByLabelText("Código de la elaboración"));
    fireEvent.change(within(dialogo).getByLabelText("Fecha de elaboración"), { target: { value: "2999-01-01" } });
    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));

    expect(await within(dialogo).findByText("El código de la elaboración es obligatorio.")).toBeInTheDocument();
    expect(within(dialogo).getByText("La fecha no puede ser futura.")).toBeInTheDocument();
    expect(elaboracionService.createElaboracion).not.toHaveBeenCalled();
  });

  it("un código repetido se muestra dentro del diálogo con su sugerido y se puede corregir", async () => {
    vi.mocked(elaboracionService.createElaboracion).mockRejectedValueOnce(
      new ApiError("Ya existe una elaboración con el código «E-001» para este producto.", 409, {}, {
        mensaje: "Ya existe una elaboración con el código «E-001» para este producto.",
        codigo_sugerido: "E-002",
      }),
    );
    const user = userEvent.setup();
    const dialogo = await abrirDialogo(user);
    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-001"));

    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));

    expect(await within(dialogo).findByText(/Ya existe una elaboración con el código «E-001».*Prueba con E-002\./)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Registrar elaboración" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Elaboración E-001" })).not.toBeInTheDocument();

    await user.clear(within(dialogo).getByLabelText("Código de la elaboración"));
    await user.type(within(dialogo).getByLabelText("Código de la elaboración"), "E-002");
    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));

    await waitFor(() => expect(elaboracionService.createElaboracion).toHaveBeenCalledTimes(2));
    expect(vi.mocked(elaboracionService.createElaboracion).mock.calls[1]).toEqual([5, { codigo: "E-002", fecha: hoyChile() }]);
  });

  it("una fecha rechazada por el servidor se muestra en el campo de la fecha", async () => {
    vi.mocked(elaboracionService.createElaboracion).mockRejectedValue(
      new ApiError("La fecha de elaboración no puede ser futura.", 422),
    );
    const user = userEvent.setup();
    const dialogo = await abrirDialogo(user);
    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-001"));

    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));

    expect(await within(dialogo).findByText("La fecha de elaboración no puede ser futura.")).toBeInTheDocument();
    expect(within(dialogo).getByLabelText("Fecha de elaboración")).toHaveAttribute("aria-invalid", "true");
  });

  it("los ingredientes desactivados se listan dentro del diálogo", async () => {
    vi.mocked(elaboracionService.createElaboracion).mockRejectedValue(
      new ApiError("La formulación vigente incluye ingredientes desactivados: «Harina».", 409, {}, {
        mensaje: "La formulación vigente incluye ingredientes desactivados: «Harina».",
        ingredientes: [{ id: 1, nombre: "Harina" }],
      }),
    );
    const user = userEvent.setup();
    const dialogo = await abrirDialogo(user);
    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-001"));

    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));

    expect(await within(dialogo).findByText(/ingredientes desactivados: «Harina»/)).toBeInTheDocument();
    expect(within(dialogo).getByRole("listitem")).toHaveTextContent("Harina");
    expect(screen.getByRole("dialog", { name: "Registrar elaboración" })).toBeInTheDocument();
  });

  it("un producto sin formulación se informa dentro del diálogo", async () => {
    vi.mocked(elaboracionService.createElaboracion).mockRejectedValue(
      new ApiError("El producto no tiene una formulación vigente. Defínela antes de registrar una elaboración.", 409),
    );
    const user = userEvent.setup();
    const dialogo = await abrirDialogo(user);
    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-001"));

    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));

    expect(await within(dialogo).findByText(/no tiene una formulación vigente/)).toBeInTheDocument();
  });

  it("un error inesperado se informa dentro del diálogo y se puede reintentar", async () => {
    vi.mocked(elaboracionService.createElaboracion).mockRejectedValueOnce(new ApiError("falla", 500));
    const user = userEvent.setup();
    const dialogo = await abrirDialogo(user);
    await waitFor(() => expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("E-001"));

    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));
    expect(await within(dialogo).findByText("No pudimos crear la elaboración. Inténtalo nuevamente.")).toBeInTheDocument();
    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));

    expect(await screen.findByRole("heading", { name: "Elaboración E-001", level: 1 })).toBeInTheDocument();
  });

  it("si no llega el código sugerido, lo informa y se puede escribir uno", async () => {
    vi.mocked(elaboracionService.getCodigoSugerido).mockRejectedValue(new ApiError("falla", 500));
    const user = userEvent.setup();
    const dialogo = await abrirDialogo(user);

    expect(await within(dialogo).findByText(/No pudimos obtener un código sugerido/)).toBeInTheDocument();
    await user.type(within(dialogo).getByLabelText("Código de la elaboración"), "MANUAL-1");
    await user.click(within(dialogo).getByRole("button", { name: "Crear borrador" }));

    await waitFor(() =>
      expect(elaboracionService.createElaboracion).toHaveBeenCalledWith(5, { codigo: "MANUAL-1", fecha: hoyChile() }),
    );
  });

  it("un código sugerido que llega tarde no pisa lo que la persona ya escribió", async () => {
    let resolver: (valor: { codigo: string }) => void = () => {};
    vi.mocked(elaboracionService.getCodigoSugerido).mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      }),
    );
    const user = userEvent.setup();
    const dialogo = await abrirDialogo(user);

    await user.type(within(dialogo).getByLabelText("Código de la elaboración"), "MIO-1");
    await act(async () => {
      resolver({ codigo: "E-009" });
    });

    expect(within(dialogo).getByLabelText("Código de la elaboración")).toHaveValue("MIO-1");
  });

  it("sigue el patrón de IngredientCreateDialog: panel inferior en celular, centrado desde sm", async () => {
    const user = userEvent.setup();
    const dialogo = await abrirDialogo(user);

    expect(dialogo.parentElement).toHaveClass("items-end", "sm:items-center");
    expect(dialogo).toHaveClass("w-full", "sm:max-w-lg", "rounded-t-xl", "sm:rounded-xl", "max-h-[90dvh]", "overflow-y-auto");
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    for (const nombre of ["Cancelar", "Crear borrador"]) {
      expect(within(dialogo).getByRole("button", { name: nombre })).toHaveClass("w-full", "sm:w-auto", "min-h-11");
    }
  });
});

// --- pantalla de registro: carga y errores (PT05-17) ---

describe("Registro: estados de carga y de error (PT05-17)", () => {
  it("muestra el estado de carga", async () => {
    vi.mocked(elaboracionService.getElaboracion).mockReturnValue(new Promise(() => {}));
    openPage("/elaboraciones/30/registro");

    expect(await screen.findByText("Cargando elaboración...")).toBeInTheDocument();
  });

  it("una elaboración inexistente o ajena muestra el aviso de no disponible", async () => {
    openPage("/elaboraciones/99/registro");

    expect(await screen.findByRole("heading", { name: "Elaboración no disponible" })).toBeInTheDocument();
  });

  it("si fallan los insumos, lo informa y permite reintentar", async () => {
    vi.mocked(insumoService.listInsumos).mockRejectedValueOnce(new ApiError("falla", 500));
    const user = userEvent.setup();
    openPage("/elaboraciones/30/registro");

    expect(await screen.findByText("No pudimos cargar tus insumos.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByLabelText("Insumo de Leche")).toBeInTheDocument();
  });

  it("una elaboración finalizada no tiene pantalla de registro: abre su detalle", async () => {
    openPage("/elaboraciones/31/registro");

    expect(await screen.findByText("Finalizada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar borrador" })).not.toBeInTheDocument();
  });
});

// --- encabezado y líneas ---

describe("Registro: encabezado y líneas", () => {
  it("muestra el producto, la versión, el código precargado y la fecha", async () => {
    await openRegistro();

    expect(screen.getAllByText("Queque de vainilla").length).toBeGreaterThan(0);
    expect(screen.getByText("Versión 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Código de la elaboración")).toHaveValue("E-001");
    expect(screen.getByLabelText("Fecha de elaboración")).toHaveValue("2026-10-06");
  });

  it("no permite fechas futuras: limita el campo a hoy y valida al guardar", async () => {
    const user = userEvent.setup();
    await openRegistro();
    const fecha = screen.getByLabelText("Fecha de elaboración");
    expect(fecha).toHaveAttribute("max", hoyChile());

    fireEvent.change(fecha, { target: { value: "2999-01-01" } });
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));

    expect(await screen.findByText("La fecha no puede ser futura.")).toBeInTheDocument();
    expect(elaboracionService.replaceUsos).not.toHaveBeenCalled();
  });

  it("exige el código de la elaboración", async () => {
    const user = userEvent.setup();
    await openRegistro();

    await user.clear(screen.getByLabelText("Código de la elaboración"));
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));

    expect(await screen.findByText("El código de la elaboración es obligatorio.")).toBeInTheDocument();
    expect(elaboracionService.updateElaboracion).not.toHaveBeenCalled();
  });

  it("una línea por ingrediente, con el insumo habitual preseleccionado", async () => {
    await openRegistro();

    expect(linea("Harina")).toBeInTheDocument();
    expect(linea("Leche")).toBeInTheDocument();
    expect(screen.getByLabelText("Insumo de Leche")).toHaveValue("10");
    const opciones = within(screen.getByLabelText("Insumo de Leche")).getAllByRole("option");
    expect(opciones.map((o) => o.textContent)).toEqual([
      "Sin asignar",
      "Leche Colun Semidescremada 1 L · Colun (habitual)",
      "Leche Soprole Entera 1 L · Soprole",
    ]);
  });

  it("muestra la cantidad de la formulación y marca las líneas pendientes", async () => {
    await openRegistro();

    expect(within(linea("Harina")).getByText("500 g")).toBeInTheDocument();
    expect(within(linea("Harina")).getByText("Pendiente")).toBeInTheDocument();
    // La leche tiene insumo pero aún no lote.
    expect(within(linea("Leche")).getByText("Pendiente")).toBeInTheDocument();
  });

  it("si el ingrediente no tiene insumos activos, lo indica", async () => {
    await openRegistro();

    expect(
      within(linea("Harina")).getByText(/no tiene insumos activos/),
    ).toBeInTheDocument();
    expect(within(linea("Harina")).getByLabelText("Insumo de Harina")).toBeDisabled();
  });

  it("avisa si el insumo asignado está desactivado y lo conserva visible", async () => {
    vi.mocked(insumoService.listInsumos).mockResolvedValue([INS_OTRO]);
    vi.mocked(elaboracionService.getElaboracion).mockResolvedValue(
      elaboracion({
        usos: [
          uso({ ingrediente_id: HARINA }),
          uso({
            ingrediente_id: LECHE,
            insumo: { ...insumoUsado(INS_HABITUAL), activo: false },
            insumo_desactivado: true,
          }),
        ],
      }),
    );
    await openRegistro();

    expect(within(linea("Leche")).getByText("El insumo asignado está desactivado. Elige otro insumo.")).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Insumo de Leche")).getByRole("option", {
        name: "Leche Colun Semidescremada 1 L (desactivado)",
      }),
    ).toBeInTheDocument();
  });

  it("avisa si el ingrediente está desactivado", async () => {
    vi.mocked(elaboracionService.getElaboracion).mockResolvedValue(
      elaboracion({
        usos: [
          uso({ ingrediente_id: HARINA, ingrediente_desactivado: true }),
          uso({ ingrediente_id: LECHE, insumo: insumoUsado(INS_HABITUAL), falta: ["lote"] }),
        ],
      }),
    );
    await openRegistro();

    expect(within(linea("Harina")).getByText(/El ingrediente Harina está desactivado/)).toBeInTheDocument();
  });
});

// --- lotes y guardado ---

describe("Registro: lotes y «Guardar borrador»", () => {
  it("lote nuevo: pide código y vencimiento opcional y guarda la asignación completa", async () => {
    const user = userEvent.setup();
    await openRegistro();

    await user.click(within(linea("Leche")).getByRole("radio", { name: "Lote nuevo" }));
    await user.type(within(linea("Leche")).getByLabelText("Código del lote"), "  L-77 ");
    fireEvent.change(within(linea("Leche")).getByLabelText("Vencimiento (opcional)"), {
      target: { value: "2026-11-30" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));

    await waitFor(() =>
      expect(elaboracionService.replaceUsos).toHaveBeenCalledWith(30, [
        { ingrediente_id: HARINA, insumo_id: null },
        {
          ingrediente_id: LECHE,
          insumo_id: 10,
          lote: { tipo: "nuevo", codigo: "L-77", fecha_vencimiento: "2026-11-30" },
        },
      ]),
    );
    expect(elaboracionService.updateElaboracion).not.toHaveBeenCalled();
    expect(await screen.findByText("Borrador guardado.")).toBeInTheDocument();
  });

  it("lote existente: ofrece los lotes del insumo y guarda el elegido", async () => {
    const user = userEvent.setup();
    await openRegistro();

    await user.click(within(linea("Leche")).getByRole("radio", { name: "Lote existente" }));
    const lista = await within(linea("Leche")).findByLabelText("Lote registrado");
    expect(within(lista).getByRole("option", { name: "X123 · vence 15-10-2026" })).toBeInTheDocument();
    await user.selectOptions(lista, "50");
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));

    await waitFor(() =>
      expect(elaboracionService.replaceUsos).toHaveBeenCalledWith(30, [
        { ingrediente_id: HARINA, insumo_id: null },
        { ingrediente_id: LECHE, insumo_id: 10, lote: { tipo: "existente", lote_id: 50 } },
      ]),
    );
  });

  it("lote existente sin lotes registrados lo explica", async () => {
    const user = userEvent.setup();
    await openRegistro();

    await user.selectOptions(screen.getByLabelText("Insumo de Leche"), "11");
    await user.click(within(linea("Leche")).getByRole("radio", { name: "Lote existente" }));

    expect(await within(linea("Leche")).findByText(/aún no tiene lotes registrados/)).toBeInTheDocument();
  });

  it("sin lote: guarda el indicador y la línea queda completa", async () => {
    const user = userEvent.setup();
    await openRegistro();

    await user.click(within(linea("Leche")).getByRole("radio", { name: "Sin lote" }));
    expect(within(linea("Leche")).getByText("Completo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));

    await waitFor(() =>
      expect(elaboracionService.replaceUsos).toHaveBeenCalledWith(30, [
        { ingrediente_id: HARINA, insumo_id: null },
        { ingrediente_id: LECHE, insumo_id: 10, lote: { tipo: "sin_lote" } },
      ]),
    );
  });

  it("cambiar el insumo reinicia el lote de la línea", async () => {
    const user = userEvent.setup();
    await openRegistro();
    await user.click(within(linea("Leche")).getByRole("radio", { name: "Sin lote" }));

    await user.selectOptions(screen.getByLabelText("Insumo de Leche"), "11");

    expect(within(linea("Leche")).getByRole("radio", { name: "Sin lote" })).not.toBeChecked();
    expect(within(linea("Leche")).getByText("Pendiente")).toBeInTheDocument();
  });

  it("un lote nuevo sin código no se envía y se marca en su línea", async () => {
    const user = userEvent.setup();
    await openRegistro();

    await user.click(within(linea("Leche")).getByRole("radio", { name: "Lote nuevo" }));
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));

    expect(await within(linea("Leche")).findByText("Ingresa el código del lote.")).toBeInTheDocument();
    expect(elaboracionService.replaceUsos).not.toHaveBeenCalled();
  });

  it("guarda el encabezado (solo lo que cambió) y después la asignación", async () => {
    const user = userEvent.setup();
    await openRegistro();

    await user.clear(screen.getByLabelText("Código de la elaboración"));
    await user.type(screen.getByLabelText("Código de la elaboración"), "LOTE-9");
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));

    await waitFor(() => expect(elaboracionService.replaceUsos).toHaveBeenCalled());
    expect(elaboracionService.updateElaboracion).toHaveBeenCalledWith(30, { codigo: "LOTE-9" });
    const orden = [
      vi.mocked(elaboracionService.updateElaboracion).mock.invocationCallOrder[0],
      vi.mocked(elaboracionService.replaceUsos).mock.invocationCallOrder[0],
    ];
    expect(orden[0]).toBeLessThan(orden[1]);
  });

  it("tras guardar ya no hay cambios sin guardar", async () => {
    const user = userEvent.setup();
    await openRegistro();
    await user.click(within(linea("Leche")).getByRole("radio", { name: "Sin lote" }));
    expect(screen.getByText("Tienes cambios sin guardar.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));

    await waitFor(() => expect(screen.queryByText("Tienes cambios sin guardar.")).not.toBeInTheDocument());
  });

  it("un código repetido se marca en el campo con el código sugerido", async () => {
    vi.mocked(elaboracionService.updateElaboracion).mockRejectedValue(
      new ApiError("Ya existe una elaboración con el código «E-002» para este producto.", 409, {}, {
        mensaje: "Ya existe una elaboración con el código «E-002» para este producto.",
        codigo_sugerido: "E-003",
      }),
    );
    const user = userEvent.setup();
    await openRegistro();

    await user.clear(screen.getByLabelText("Código de la elaboración"));
    await user.type(screen.getByLabelText("Código de la elaboración"), "E-002");
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));

    expect(await screen.findByText(/Ya existe una elaboración con el código «E-002».*Prueba con E-003\./)).toBeInTheDocument();
    expect(elaboracionService.replaceUsos).not.toHaveBeenCalled();
  });

  it("un error 422 con ingrediente_id se muestra en su línea", async () => {
    vi.mocked(elaboracionService.replaceUsos).mockRejectedValue(
      new ApiError("Insumo no válido", 422, {}, { mensaje: "Insumo no válido", ingrediente_id: LECHE }),
    );
    const user = userEvent.setup();
    await openRegistro();

    await user.click(within(linea("Leche")).getByRole("radio", { name: "Sin lote" }));
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));

    expect(await within(linea("Leche")).findByText("Insumo no válido")).toBeInTheDocument();
    expect(within(linea("Harina")).queryByText("Insumo no válido")).not.toBeInTheDocument();
  });

  it("un error inesperado al guardar muestra un mensaje general", async () => {
    vi.mocked(elaboracionService.replaceUsos).mockRejectedValue(new ApiError("falla", 500));
    const user = userEvent.setup();
    await openRegistro();

    await user.click(within(linea("Leche")).getByRole("radio", { name: "Sin lote" }));
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));

    expect(await screen.findByText("No pudimos guardar el borrador. Inténtalo nuevamente.")).toBeInTheDocument();
  });

  it("«Usar este lote»: el lote nuevo ya existe, así que la línea pasa a ese lote existente", async () => {
    vi.mocked(elaboracionService.replaceUsos).mockRejectedValueOnce(
      new ApiError("Ya existe un lote «X123» para este insumo. Puedes usarlo.", 409, {}, {
        mensaje: "Ya existe un lote «X123» para este insumo. Puedes usarlo.",
        ingrediente_id: LECHE,
        lote_id: 50,
      }),
    );
    const user = userEvent.setup();
    await openRegistro();

    await user.click(within(linea("Leche")).getByRole("radio", { name: "Lote nuevo" }));
    await user.type(within(linea("Leche")).getByLabelText("Código del lote"), "X123");
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await user.click(await within(linea("Leche")).findByRole("button", { name: "Usar este lote" }));

    expect(within(linea("Leche")).getByRole("radio", { name: "Lote existente" })).toBeChecked();
    expect(within(linea("Leche")).queryByRole("button", { name: "Usar este lote" })).not.toBeInTheDocument();
    expect(await within(linea("Leche")).findByLabelText("Lote registrado")).toHaveValue("50");

    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() =>
      expect(elaboracionService.replaceUsos).toHaveBeenLastCalledWith(30, [
        { ingrediente_id: HARINA, insumo_id: null },
        { ingrediente_id: LECHE, insumo_id: 10, lote: { tipo: "existente", lote_id: 50 } },
      ]),
    );
  });
});

// --- cambios sin guardar ---

describe("Registro: cambios sin guardar", () => {
  function beforeUnload(): Event {
    const event = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    return event;
  }

  it("al cerrar o recargar la pestaña con cambios, usa el aviso del navegador", async () => {
    const user = userEvent.setup();
    await openRegistro();
    expect(beforeUnload().defaultPrevented).toBe(false);

    await user.click(within(linea("Leche")).getByRole("radio", { name: "Sin lote" }));

    expect(beforeUnload().defaultPrevented).toBe(true);
  });

  it("al guardar deja de avisar al cerrar la pestaña", async () => {
    const user = userEvent.setup();
    await openRegistro();
    await user.click(within(linea("Leche")).getByRole("radio", { name: "Sin lote" }));
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(screen.queryByText("Tienes cambios sin guardar.")).not.toBeInTheDocument());

    expect(beforeUnload().defaultPrevented).toBe(false);
  });

  it("al navegar dentro de la aplicación con cambios pide confirmar", async () => {
    const user = userEvent.setup();
    await openRegistro();
    await user.click(within(linea("Leche")).getByRole("radio", { name: "Sin lote" }));

    await user.click(within(screen.getByRole("navigation", { name: "Secciones" })).getByRole("link", { name: "Insumos" }));

    const dialogo = await screen.findByRole("alertdialog", { name: "Salir sin guardar" });
    expect(within(dialogo).getByText("Tienes cambios sin guardar. ¿Deseas salir sin guardar?")).toBeInTheDocument();
    // Seguir editando conserva la pantalla y los cambios.
    await user.click(within(dialogo).getByRole("button", { name: "Seguir editando" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(within(linea("Leche")).getByRole("radio", { name: "Sin lote" })).toBeChecked();
  });

  it("«Salir sin guardar» abandona la pantalla y descarta los cambios", async () => {
    vi.mocked(insumoService.listInsumos).mockResolvedValue(INSUMOS_ACTIVOS);
    const user = userEvent.setup();
    await openRegistro();
    await user.click(within(linea("Leche")).getByRole("radio", { name: "Sin lote" }));

    await user.click(within(screen.getByRole("navigation", { name: "Secciones" })).getByRole("link", { name: "Insumos" }));
    await user.click(await screen.findByRole("button", { name: "Salir sin guardar" }));

    expect(await screen.findByRole("heading", { name: "Insumos", level: 1 })).toBeInTheDocument();
    expect(elaboracionService.replaceUsos).not.toHaveBeenCalled();
  });

  it("«Volver al producto» con cambios también pide confirmar; sin cambios vuelve directo", async () => {
    const user = userEvent.setup();
    await openRegistro();

    await user.click(within(linea("Leche")).getByRole("radio", { name: "Sin lote" }));
    await user.click(screen.getByRole("button", { name: "Volver al producto" }));
    expect(await screen.findByRole("alertdialog", { name: "Salir sin guardar" })).toBeInTheDocument();
  });

  it("sin cambios navega sin preguntar", async () => {
    const user = userEvent.setup();
    await openRegistro();

    await user.click(screen.getByRole("button", { name: "Volver al producto" }));

    expect(await screen.findByRole("heading", { name: "Queque de vainilla", level: 1 })).toBeInTheDocument();
  });
});

// --- eliminar borrador ---

describe("Registro: eliminar el borrador", () => {
  it("pide confirmación y no elimina si se cancela", async () => {
    const user = userEvent.setup();
    await openRegistro();

    await user.click(screen.getByRole("button", { name: "Eliminar borrador" }));
    const dialogo = await screen.findByRole("alertdialog", { name: "Eliminar borrador" });
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(elaboracionService.deleteElaboracion).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("al confirmar elimina y vuelve al producto con un aviso", async () => {
    const user = userEvent.setup();
    await openRegistro();

    await user.click(screen.getByRole("button", { name: "Eliminar borrador" }));
    const dialogo = await screen.findByRole("alertdialog", { name: "Eliminar borrador" });
    await user.click(within(dialogo).getByRole("button", { name: "Eliminar borrador" }));

    await waitFor(() => expect(elaboracionService.deleteElaboracion).toHaveBeenCalledWith(30));
    expect(await screen.findByRole("heading", { name: "Queque de vainilla", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText("Borrador eliminado.")).toBeInTheDocument();
  });

  it("si falla la eliminación, lo informa y se queda en la pantalla", async () => {
    vi.mocked(elaboracionService.deleteElaboracion).mockRejectedValue(new ApiError("falla", 500));
    const user = userEvent.setup();
    await openRegistro();

    await user.click(screen.getByRole("button", { name: "Eliminar borrador" }));
    const dialogo = await screen.findByRole("alertdialog", { name: "Eliminar borrador" });
    await user.click(within(dialogo).getByRole("button", { name: "Eliminar borrador" }));

    expect(await screen.findByText("No pudimos eliminar el borrador. Inténtalo nuevamente.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Elaboración E-001", level: 1 })).toBeInTheDocument();
  });
});

// --- finalización ---

describe("Registro: finalización", () => {
  beforeEach(() => {
    // The borrador is already complete: every line has its supply and lot.
    vi.mocked(elaboracionService.getElaboracion).mockImplementation(async (id) => {
      if (id === 30) return BORRADOR_COMPLETO;
      if (id === 31) return FINALIZADA;
      throw new ApiError("Elaboración no encontrada", 404);
    });
    vi.mocked(insumoService.listInsumos).mockResolvedValue([...INSUMOS_ACTIVOS, INS_HARINA]);
  });

  it("PT05-17: pide confirmación con el texto de advertencia antes de finalizar", async () => {
    const user = userEvent.setup();
    await openRegistro();

    await user.click(screen.getByRole("button", { name: "Finalizar elaboración" }));

    const dialogo = await screen.findByRole("alertdialog", { name: "Finalizar elaboración" });
    expect(within(dialogo).getByText(TEXTO_CONFIRMAR_FINALIZACION)).toBeInTheDocument();
    expect(TEXTO_CONFIRMAR_FINALIZACION).toBe(
      "Al finalizar, la información de los insumos utilizados quedará registrada de forma permanente y la elaboración no podrá modificarse ni eliminarse.",
    );
    expect(elaboracionService.finalizarElaboracion).not.toHaveBeenCalled();
  });

  it("cancelar la confirmación no finaliza", async () => {
    const user = userEvent.setup();
    await openRegistro();

    await user.click(screen.getByRole("button", { name: "Finalizar elaboración" }));
    await user.click(await screen.findByRole("button", { name: "Seguir editando" }));

    expect(elaboracionService.finalizarElaboracion).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("al confirmar finaliza y navega al detalle de la elaboración", async () => {
    const user = userEvent.setup();
    await openRegistro();

    await user.click(screen.getByRole("button", { name: "Finalizar elaboración" }));
    await user.click(await screen.findByRole("button", { name: "Finalizar" }));

    await waitFor(() => expect(elaboracionService.finalizarElaboracion).toHaveBeenCalledWith(30));
    expect(await screen.findByText("Finalizada")).toBeInTheDocument();
    expect(await screen.findByText("Elaboración finalizada correctamente.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar borrador" })).not.toBeInTheDocument();
  });

  it("si hay cambios sin guardar, los guarda antes de finalizar", async () => {
    const user = userEvent.setup();
    await openRegistro();
    await user.click(within(linea("Leche")).getByRole("radio", { name: "Sin lote" }));
    vi.mocked(elaboracionService.replaceUsos).mockResolvedValue(BORRADOR_COMPLETO);

    await user.click(screen.getByRole("button", { name: "Finalizar elaboración" }));
    await user.click(await screen.findByRole("button", { name: "Finalizar" }));

    await waitFor(() => expect(elaboracionService.finalizarElaboracion).toHaveBeenCalled());
    expect(elaboracionService.replaceUsos).toHaveBeenCalledTimes(1);
    expect(vi.mocked(elaboracionService.replaceUsos).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(elaboracionService.finalizarElaboracion).mock.invocationCallOrder[0],
    );
  });

  it("si el guardado previo falla, no pide confirmación ni finaliza", async () => {
    vi.mocked(elaboracionService.replaceUsos).mockRejectedValue(new ApiError("falla", 500));
    const user = userEvent.setup();
    await openRegistro();
    await user.click(within(linea("Leche")).getByRole("radio", { name: "Sin lote" }));

    await user.click(screen.getByRole("button", { name: "Finalizar elaboración" }));

    expect(await screen.findByText("No pudimos guardar el borrador. Inténtalo nuevamente.")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(elaboracionService.finalizarElaboracion).not.toHaveBeenCalled();
  });

  it("con líneas pendientes marca cada una con su motivo, sin pedir confirmación", async () => {
    vi.mocked(elaboracionService.getElaboracion).mockResolvedValue(BORRADOR);
    const user = userEvent.setup();
    await openRegistro();

    await user.click(screen.getByRole("button", { name: "Finalizar elaboración" }));

    expect(await screen.findByText("No se puede finalizar todavía: revisa las líneas marcadas.")).toBeInTheDocument();
    expect(within(linea("Harina")).getByText("Falta elegir el insumo.")).toBeInTheDocument();
    expect(within(linea("Leche")).getByText("Falta indicar el lote o marcar «Sin lote».")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(elaboracionService.finalizarElaboracion).not.toHaveBeenCalled();
  });

  it("el 409 con problemas del servidor marca cada línea afectada con su motivo", async () => {
    vi.mocked(elaboracionService.finalizarElaboracion).mockRejectedValue(
      new ApiError(
        "No se puede finalizar la elaboración: hay ingredientes con información pendiente o no disponible.",
        409,
        {},
        {
          mensaje: "No se puede finalizar la elaboración: hay ingredientes con información pendiente o no disponible.",
          problemas: [
            { ingrediente_id: HARINA, ingrediente_nombre: "Harina", falta: "ingrediente_desactivado" },
            { ingrediente_id: LECHE, ingrediente_nombre: "Leche", falta: "insumo_desactivado" },
          ],
        },
      ),
    );
    const user = userEvent.setup();
    await openRegistro();

    await user.click(screen.getByRole("button", { name: "Finalizar elaboración" }));
    await user.click(await screen.findByRole("button", { name: "Finalizar" }));

    expect(await screen.findByText("No se puede finalizar todavía: revisa las líneas marcadas.")).toBeInTheDocument();
    expect(
      within(linea("Harina")).getByText("El ingrediente está desactivado. Corrige la formulación del producto."),
    ).toBeInTheDocument();
    expect(
      within(linea("Leche")).getByText("El insumo asignado está desactivado. Elige otro insumo."),
    ).toBeInTheDocument();
    // La confirmación se cierra y la pantalla sigue siendo la del borrador.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finalizar elaboración" })).toBeInTheDocument();
  });

  it("los cuatro motivos de problema se distinguen por línea", async () => {
    vi.mocked(elaboracionService.finalizarElaboracion).mockRejectedValue(
      new ApiError("No se puede finalizar", 409, {}, {
        mensaje: "No se puede finalizar",
        problemas: [
          { ingrediente_id: HARINA, ingrediente_nombre: "Harina", falta: "insumo" },
          { ingrediente_id: HARINA, ingrediente_nombre: "Harina", falta: "ingrediente_desactivado" },
          { ingrediente_id: LECHE, ingrediente_nombre: "Leche", falta: "lote" },
          { ingrediente_id: LECHE, ingrediente_nombre: "Leche", falta: "insumo_desactivado" },
        ],
      }),
    );
    const user = userEvent.setup();
    await openRegistro();

    await user.click(screen.getByRole("button", { name: "Finalizar elaboración" }));
    await user.click(await screen.findByRole("button", { name: "Finalizar" }));

    const harina = await within(linea("Harina")).findByRole("alert");
    expect(within(harina).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Falta elegir el insumo.",
      "El ingrediente está desactivado. Corrige la formulación del producto.",
    ]);
    const leche = within(linea("Leche")).getAllByRole("alert").find((el) => el.tagName === "UL")!;
    expect(within(leche).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Falta indicar el lote o marcar «Sin lote».",
      "El insumo asignado está desactivado. Elige otro insumo.",
    ]);
  });

  it("si la finalización falla de forma inesperada, lo informa y no navega", async () => {
    vi.mocked(elaboracionService.finalizarElaboracion).mockRejectedValue(new ApiError("falla", 500));
    const user = userEvent.setup();
    await openRegistro();

    await user.click(screen.getByRole("button", { name: "Finalizar elaboración" }));
    await user.click(await screen.findByRole("button", { name: "Finalizar" }));

    expect(await screen.findByText("No pudimos finalizar la elaboración. Inténtalo nuevamente.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeInTheDocument();
  });
});

// --- detalle de la elaboración (T05-07) ---

const ALERGENO = (
  alergeno_id: number,
  nombre: string,
  tipo: "contiene" | "trazas",
  obligatorio_chile: boolean,
) => ({ alergeno_id, codigo: nombre.toLowerCase(), nombre, obligatorio_chile, tipo });

/** Harina declares gluten (contiene), soya and sésamo (trazas); leche declares leche and soya as
 * "contiene" and sésamo as trazas: soya must end up only under "Contiene", sésamo only once. */
const FINALIZADA_COMPLETA: Elaboracion = elaboracion({
  id: 31,
  estado: "finalizada",
  finalizada_at: "2026-10-06T18:30:00Z",
  version: { id: 1, numero_version: 3 },
  usos: [
    uso({
      ingrediente_id: HARINA,
      cantidad: "500",
      unidad: "g",
      insumo: {
        ...insumoUsado(INS_HARINA),
        presentacion: "Saco de 1 kg",
        codigo_barras: "7802200000017",
        ingredientes_declarados: "Harina de trigo, vitaminas",
        advertencias: "Puede contener trazas de soya y sésamo",
        alergenos: [
          ALERGENO(1, "Gluten", "contiene", true),
          ALERGENO(3, "Soya", "trazas", true),
          ALERGENO(4, "Sésamo", "trazas", false),
        ],
        activo: null,
        habitual: null,
      },
      sin_lote: true,
      pendiente: false,
      falta: [],
    }),
    uso({
      ingrediente_id: LECHE,
      insumo: {
        ...insumoUsado(INS_HABITUAL),
        alergenos: [
          ALERGENO(2, "Leche", "contiene", true),
          ALERGENO(3, "Soya", "contiene", true),
          ALERGENO(4, "Sésamo", "trazas", false),
        ],
        activo: null,
        habitual: null,
      },
      lote: { id: 50, codigo: "X123", fecha_vencimiento: "2026-10-15" },
      pendiente: false,
      falta: [],
    }),
  ],
});

describe("Detalle de la elaboración (T05-07)", () => {
  beforeEach(() => {
    vi.mocked(elaboracionService.getElaboracion).mockImplementation(async (id) => {
      if (id === 30) return BORRADOR;
      if (id === 31) return FINALIZADA_COMPLETA;
      throw new ApiError("Elaboración no encontrada", 404);
    });
  });

  async function abrirDetalle() {
    openPage("/elaboraciones/31");
    await screen.findByRole("heading", { name: "Elaboración E-001", level: 1 });
  }

  function tarjeta(ingrediente: string) {
    return screen.getByRole("region", { name: ingrediente });
  }

  it("PT05-15: el encabezado muestra producto, código, fecha, estado y versión", async () => {
    await abrirDetalle();

    expect(screen.getByText("Finalizada")).toBeInTheDocument();
    const datos = screen.getByRole("region", { name: "Datos de la elaboración" });
    expect(within(datos).getByRole("link", { name: "Queque de vainilla" })).toHaveAttribute("href", "/productos/5");
    expect(within(datos).getByText("E-001")).toBeInTheDocument();
    expect(within(datos).getByText("06-10-2026")).toBeInTheDocument();
    expect(within(datos).getByText("Versión 3")).toBeInTheDocument();
  });

  it("indica cuándo se conservó la información, en formato chileno y hora de Santiago", async () => {
    await abrirDetalle();

    // 18:30 UTC es 15:30 en Santiago (UTC-3 en octubre).
    expect(
      screen.getByText("Información conservada al finalizar el 06-10-2026 a las 15:30"),
    ).toBeInTheDocument();
  });

  it("PT05-15: por cada ingrediente muestra el insumo, la marca u origen, la presentación y el código de barras", async () => {
    await abrirDetalle();

    const harina = tarjeta("Harina");
    expect(within(harina).getByText("500 g")).toBeInTheDocument();
    expect(within(harina).getByText("Harina Selecta 1 kg")).toBeInTheDocument();
    expect(within(harina).getByText("Selecta")).toBeInTheDocument();
    expect(within(harina).getByText("Saco de 1 kg")).toBeInTheDocument();
    expect(within(harina).getByText("7802200000017")).toBeInTheDocument();
  });

  it("omite la presentación y el código de barras cuando no existen", async () => {
    await abrirDetalle();

    const leche = tarjeta("Leche");
    expect(within(leche).queryByText("Presentación")).not.toBeInTheDocument();
    expect(within(leche).queryByText("Código de barras")).not.toBeInTheDocument();
    expect(within(leche).queryByText("Ingredientes declarados")).not.toBeInTheDocument();
    expect(within(leche).queryByText("Advertencias")).not.toBeInTheDocument();
  });

  it("muestra los ingredientes declarados y las advertencias cuando existen", async () => {
    await abrirDetalle();

    const harina = tarjeta("Harina");
    expect(within(harina).getByText("Ingredientes declarados")).toBeInTheDocument();
    expect(within(harina).getByText("Harina de trigo, vitaminas")).toBeInTheDocument();
    expect(within(harina).getByText("Advertencias")).toBeInTheDocument();
    expect(within(harina).getByText("Puede contener trazas de soya y sésamo")).toBeInTheDocument();
  });

  it("muestra el código y el vencimiento del lote, o «Sin lote»", async () => {
    await abrirDetalle();

    expect(within(tarjeta("Leche")).getByText("X123 · vence 15-10-2026")).toBeInTheDocument();
    expect(within(tarjeta("Harina")).getByText("Sin lote")).toBeInTheDocument();
    expect(within(tarjeta("Harina")).queryByText(/vence/)).not.toBeInTheDocument();
  });

  it("agrupa los alérgenos de cada insumo en «Contiene» y «Puede contener»", async () => {
    await abrirDetalle();

    const contiene = within(tarjeta("Harina")).getByRole("group", { name: "Contiene · Harina" });
    expect(within(contiene).getByText("Gluten")).toBeInTheDocument();
    const trazas = within(tarjeta("Harina")).getByRole("group", { name: "Puede contener · Harina" });
    expect(within(trazas).getAllByRole("listitem").map((li) => li.textContent?.replace(/Rotulación obligatoria.*$/, "").trim())).toEqual([
      "Soya",
      "Sésamo",
    ]);
  });

  it("marca con «Rotulación obligatoria» solo los alérgenos obligatorios", async () => {
    await abrirDetalle();

    const trazas = within(tarjeta("Harina")).getByRole("group", { name: "Puede contener · Harina" });
    const soya = within(trazas).getByText("Soya").closest("li") as HTMLElement;
    const sesamo = within(trazas).getByText("Sésamo").closest("li") as HTMLElement;
    expect(within(soya).getByText("Rotulación obligatoria")).toBeInTheDocument();
    expect(within(sesamo).queryByText("Rotulación obligatoria")).not.toBeInTheDocument();
  });

  it("el resumen de alérgenos va al principio, antes de los ingredientes", async () => {
    await abrirDetalle();

    const resumen = screen.getByRole("region", { name: "Alérgenos de la elaboración" });
    const usos = screen.getByRole("region", { name: "Insumos utilizados" });
    expect(resumen.compareDocumentPosition(usos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const datos = screen.getByRole("region", { name: "Datos de la elaboración" });
    expect(datos.compareDocumentPosition(resumen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("el resumen reúne los alérgenos de todos los insumos, sin duplicados", async () => {
    await abrirDetalle();

    const resumen = screen.getByRole("region", { name: "Alérgenos de la elaboración" });
    const contiene = within(resumen).getByRole("group", { name: "Contiene · resumen" });
    expect(within(contiene).getAllByRole("listitem").map((li) => li.textContent?.replace(/Rotulación obligatoria.*$/, "").trim())).toEqual([
      "Gluten",
      "Leche",
      "Soya",
    ]);
    const trazas = within(resumen).getByRole("group", { name: "Puede contener · resumen" });
    // Sésamo lo declaran dos insumos como trazas: aparece una sola vez.
    expect(within(trazas).getAllByRole("listitem")).toHaveLength(1);
    expect(within(trazas).getByText("Sésamo")).toBeInTheDocument();
  });

  it("si un alérgeno es «contiene» en un insumo y «trazas» en otro, va solo en «Contiene»", async () => {
    await abrirDetalle();

    const resumen = screen.getByRole("region", { name: "Alérgenos de la elaboración" });
    const contiene = within(resumen).getByRole("group", { name: "Contiene · resumen" });
    const trazas = within(resumen).getByRole("group", { name: "Puede contener · resumen" });
    expect(within(contiene).getByText("Soya")).toBeInTheDocument();
    expect(within(trazas).queryByText("Soya")).not.toBeInTheDocument();
  });

  it("el resumen marca la rotulación obligatoria y no marca los demás", async () => {
    await abrirDetalle();

    const resumen = screen.getByRole("region", { name: "Alérgenos de la elaboración" });
    expect(within(resumen).getAllByText("Rotulación obligatoria")).toHaveLength(3);
    const sesamo = within(resumen).getByText("Sésamo").closest("li") as HTMLElement;
    expect(within(sesamo).queryByText("Rotulación obligatoria")).not.toBeInTheDocument();
  });

  it("sin alérgenos declarados, lo indica en el resumen y en cada insumo", async () => {
    vi.mocked(elaboracionService.getElaboracion).mockResolvedValue(FINALIZADA);
    openPage("/elaboraciones/31");
    await screen.findByRole("heading", { name: "Elaboración E-001", level: 1 });

    const resumen = screen.getByRole("region", { name: "Alérgenos de la elaboración" });
    expect(
      within(resumen).getByText("No hay alérgenos declarados en los insumos de esta elaboración."),
    ).toBeInTheDocument();
    expect(within(tarjeta("Leche")).getByText("Sin alérgenos declarados.")).toBeInTheDocument();
  });

  it("no consulta el insumo vigente: todo viene de lo que entrega la elaboración", async () => {
    await abrirDetalle();

    expect(elaboracionService.getElaboracion).toHaveBeenCalledWith(31);
    expect(insumoService.getInsumo).not.toHaveBeenCalled();
    expect(insumoService.listInsumos).not.toHaveBeenCalled();
    expect(insumoService.listInsumoAlergenos).not.toHaveBeenCalled();
    expect(elaboracionService.listLotesInsumo).not.toHaveBeenCalled();
  });

  it("no ofrece acciones de edición", async () => {
    await abrirDetalle();

    for (const nombre of ["Guardar borrador", "Finalizar elaboración", "Eliminar borrador", "Continuar registro"]) {
      expect(screen.queryByRole("button", { name: nombre })).not.toBeInTheDocument();
    }
  });

  it("un borrador abierto en esta ruta redirige a la pantalla de registro", async () => {
    openPage("/elaboraciones/30");

    expect(await screen.findByLabelText("Insumo de Leche")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeInTheDocument();
  });

  it("«Volver al producto» lleva al detalle del producto", async () => {
    const user = userEvent.setup();
    await abrirDetalle();

    await user.click(screen.getByRole("button", { name: "Volver al producto" }));

    expect(await screen.findByRole("heading", { name: "Queque de vainilla", level: 1 })).toBeInTheDocument();
  });

  it("muestra el estado de carga", async () => {
    vi.mocked(elaboracionService.getElaboracion).mockReturnValue(new Promise(() => {}));
    openPage("/elaboraciones/31");

    expect(await screen.findByText("Cargando elaboración...")).toBeInTheDocument();
  });

  it("una elaboración inexistente o ajena muestra el aviso de no disponible", async () => {
    openPage("/elaboraciones/99");

    expect(await screen.findByRole("heading", { name: "Elaboración no disponible" })).toBeInTheDocument();
    expect(screen.queryByText("No pudimos cargar la elaboración.")).not.toBeInTheDocument();
  });

  it("un fallo de carga se informa con reintento y no se confunde con «no disponible»", async () => {
    vi.mocked(elaboracionService.getElaboracion).mockRejectedValueOnce(new ApiError("falla", 500));
    const user = userEvent.setup();
    openPage("/elaboraciones/31");

    expect(await screen.findByText("No pudimos cargar la elaboración.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Elaboración no disponible" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("heading", { name: "Elaboración E-001", level: 1 })).toBeInTheDocument();
  });

  it("es adaptable a móviles: datos e insumos en una columna y dos desde sm, acción a ancho completo", async () => {
    await abrirDetalle();

    const datos = screen.getByRole("region", { name: "Datos de la elaboración" });
    expect(datos.querySelector("dl")).toHaveClass("grid", "sm:grid-cols-2");
    expect(tarjeta("Harina").querySelector("dl")).toHaveClass("grid", "sm:grid-cols-2");
    expect(screen.getByRole("button", { name: "Volver al producto" })).toHaveClass("w-full", "sm:w-auto");
    expect(document.querySelector("main .max-w-3xl, .max-w-3xl")).not.toBeNull();
  });
});
