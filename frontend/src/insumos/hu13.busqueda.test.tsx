/**
 * "Nuevo insumo" with the barcode lookup (T13-05 / HU13), with the API simulated.
 *
 * The camera is not available in jsdom (no secure context), so the codes are delivered through the
 * scanner's own field to type the number: it reaches the same `onDetectado` as a camera reading.
 * hu13.busqueda-camara.test.tsx delivers one by camera.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { MENSAJE_ALERGENOS_INVALIDOS } from "@/lib/alergenosDeclaracion";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as ingredientService from "@/services/ingredientService";
import * as insumoService from "@/services/insumoService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { ConsultaCodigo } from "@/types/consultaCodigo";
import type { AlergenoCatalogo, Ingrediente } from "@/types/ingredient";
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
  createInsumo: vi.fn(),
  updateInsumo: vi.fn(),
  deactivateInsumo: vi.fn(),
  reactivateInsumo: vi.fn(),
  consultarCodigoBarras: vi.fn(),
  listInsumoAlergenos: vi.fn(),
  addInsumoAlergeno: vi.fn(),
  updateInsumoAlergenoTipo: vi.fn(),
  deleteInsumoAlergeno: vi.fn(),
  replaceInsumoAlergenos: vi.fn(),
}));

vi.mock("@/services/ingredientService", () => ({
  listIngredients: vi.fn(),
  listAlergenosCatalog: vi.fn(),
}));

// --- data ---

const CODIGO = "7802910000971";
const OTRO_CODIGO = "4006381333931";

function ingrediente(id: number, nombre: string): Ingrediente {
  return {
    id,
    productor_id: 1,
    codigo_interno: `ING-${id}`,
    nombre,
    descripcion: null,
    tipo: null,
    activo: true,
    created_at: "2026-10-01T12:00:00Z",
  };
}

const CATALOGO: AlergenoCatalogo[] = [
  { id: 1, codigo: "lacteos", nombre: "Leche", obligatorio_chile: true },
  { id: 2, codigo: "cacahuetes", nombre: "Maní", obligatorio_chile: true },
  { id: 4, codigo: "sesamo", nombre: "Sésamo", obligatorio_chile: false },
];

const FICHA = {
  product_name: "LONCO LECHE SIN LACTOSA",
  brands: "Lonco Leche",
  url: "https://fuente.ejemplo.test/producto/7802910000971",
};

const LONCOLECHE: ConsultaCodigo = {
  codigo_barras: CODIGO,
  encontrado: true,
  fuente: "open_food_facts",
  fecha_recuperacion: "2026-10-19T15:00:00Z",
  producto: {
    nombre: "LONCO LECHE SIN LACTOSA",
    marca_origen: "Lonco Leche",
    presentacion: "1L",
    ingredientes_declarados: "Leche fluida natural entera, enzima lactasa y vitamina D3.",
  },
  alergenos: {
    contiene: [{ alergeno_id: 1, codigo: "lacteos", nombre: "Leche", origen: "texto" }],
    trazas: [{ alergeno_id: 2, codigo: "cacahuetes", nombre: "Maní", origen: "etiqueta" }],
    sin_reconocer: ["en:tree-nuts", "harina"],
  },
  ficha: FICHA,
};

const SIN_ALERGENOS: ConsultaCodigo = {
  ...LONCOLECHE,
  codigo_barras: OTRO_CODIGO,
  producto: {
    nombre: "Bicarbonato sódico",
    marca_origen: "Carmencita",
    presentacion: "200 g",
    ingredientes_declarados: "Bicarbonato sódico (E-500ii).",
  },
  alergenos: { contiene: [], trazas: [], sin_reconocer: [] },
  ficha: { product_name: "Bicarbonato sódico" },
};

function noEncontrado(codigo: string): ConsultaCodigo {
  return {
    codigo_barras: codigo,
    encontrado: false,
    fuente: "open_food_facts",
    fecha_recuperacion: "2026-10-19T15:00:00Z",
    producto: null,
    alergenos: { contiene: [], trazas: [], sin_reconocer: [] },
    ficha: null,
  };
}

function insumo(overrides: Partial<Insumo> = {}): Insumo {
  return {
    id: 10,
    productor_id: 1,
    ingrediente_id: 1,
    ingrediente: { id: 1, nombre: "Leche" },
    nombre: "Leche Colun 1 L",
    marca_origen: "Colun",
    presentacion: null,
    codigo_barras: CODIGO,
    ingredientes_declarados: null,
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

function duplicado(insumoId: number, activo: boolean) {
  return new ApiError("Ya existe un insumo con ese código de barras.", 409, {}, {
    mensaje: "Ya existe un insumo con ese código de barras.",
    insumo_id: insumoId,
    activo,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([
    ingrediente(1, "Leche"),
    ingrediente(2, "Harina"),
  ]);
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue(CATALOGO);
  vi.mocked(insumoService.listInsumos).mockResolvedValue([]);
  vi.mocked(insumoService.listInsumoAlergenos).mockResolvedValue([]);
  vi.mocked(insumoService.getInsumo).mockResolvedValue(insumo());
  vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(LONCOLECHE);
  vi.mocked(insumoService.createInsumo).mockResolvedValue(insumo({ id: 99 }));
});

// --- helpers ---

type Usuario = ReturnType<typeof userEvent.setup>;

async function abrirPagina() {
  const user = userEvent.setup();
  renderWithProviders(<App />, { initialEntries: ["/insumos/nuevo"] });
  expect(await screen.findByRole("heading", { name: "Nuevo insumo", level: 1 })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText("Ingrediente")).toBeEnabled());
  return user;
}

const botonEscanear = () => screen.getByRole("button", { name: "Escanear código de barras" });
const panel = () => screen.getByRole("dialog", { name: "Escanear código de barras" });

/** Opens the scanner and delivers a code through its field to type the number. */
async function entregarCodigo(user: Usuario, codigo: string) {
  await user.click(botonEscanear());
  const abierto = await screen.findByRole("dialog", { name: "Escanear código de barras" });
  await user.type(within(abierto).getByLabelText("Número del código de barras"), codigo);
  await user.click(within(abierto).getByRole("button", { name: "Buscar" }));
}

const campo = (nombre: string) => screen.getByLabelText(nombre) as HTMLInputElement;

async function esperarFormularioConProducto() {
  await waitFor(() => expect(campo("Nombre")).toHaveValue("LONCO LECHE SIN LACTOSA"));
}

const MENSAJE_ENCONTRADO =
  "Encontramos este producto en Open Food Facts. Revisa los datos antes de registrar.";
const MENSAJE_NO_ENCONTRADO = "No encontramos este código. Completa los datos manualmente.";
const MENSAJE_NO_DISPONIBLE =
  "No pudimos consultar la fuente en este momento. Completa los datos manualmente.";
const AVISO_SUGERIDOS =
  "Alérgenos sugeridos automáticamente. Compáralos con la etiqueta del envase antes de registrar.";

// =============================================================================================

describe("Estados de la búsqueda", () => {
  it("antes de buscar no hay mensaje ni aviso, y el bloque está sobre el formulario", async () => {
    await abrirPagina();

    expect(botonEscanear()).toBeEnabled();
    expect(screen.queryByText(MENSAJE_ENCONTRADO)).not.toBeInTheDocument();
    const bloque = screen.getByRole("region", { name: "Buscar por código de barras" });
    const formulario = campo("Nombre").closest("form")!;
    expect(bloque.compareDocumentPosition(formulario) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("encontrado: avisa que viene de Open Food Facts y que hay que revisar", async () => {
    const user = await abrirPagina();

    await entregarCodigo(user, CODIGO);

    expect(await screen.findByText(MENSAJE_ENCONTRADO)).toBeInTheDocument();
    expect(insumoService.consultarCodigoBarras).toHaveBeenCalledTimes(1);
    expect(insumoService.consultarCodigoBarras).toHaveBeenCalledWith(CODIGO);
  });

  it("no encontrado: lo dice (CA10) y deja el formulario con el código escrito", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(noEncontrado(CODIGO));
    const user = await abrirPagina();

    await entregarCodigo(user, CODIGO);

    expect(await screen.findByText(MENSAJE_NO_ENCONTRADO)).toBeInTheDocument();
    expect(campo("Código de barras")).toHaveValue(CODIGO);
    expect(campo("Nombre")).toHaveValue("");
  });

  it("fuente no disponible (503): lo dice y deja el formulario con el código escrito", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(
      new ApiError("No pudimos completar la operación.", 503, {}, { mensaje: "x", motivo: "timeout" }),
    );
    const user = await abrirPagina();

    await entregarCodigo(user, CODIGO);

    expect(await screen.findByText(MENSAJE_NO_DISPONIBLE)).toBeInTheDocument();
    expect(campo("Código de barras")).toHaveValue(CODIGO);
  });

  it("sin conexión con el servidor: se trata como fuente no disponible", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = await abrirPagina();

    await entregarCodigo(user, CODIGO);

    expect(await screen.findByText(MENSAJE_NO_DISPONIBLE)).toBeInTheDocument();
    expect(campo("Código de barras")).toHaveValue(CODIGO);
  });

  it.each([
    ["no encontrado", () => vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(noEncontrado(CODIGO))],
    ["fuente no disponible", () => vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(new ApiError("x", 503))],
  ])("%s: el insumo se registra como manual, sin fuente, fecha ni ficha", async (_caso, preparar) => {
    preparar();
    const user = await abrirPagina();
    await entregarCodigo(user, CODIGO);
    await waitFor(() => expect(campo("Código de barras")).toHaveValue(CODIGO));
    await user.type(campo("Nombre"), "Leche Colun");
    await user.type(campo("Marca u origen"), "Colun");
    await user.selectOptions(campo("Ingrediente"), "1");
    await user.click(screen.getByLabelText("Este insumo no contiene alérgenos"));

    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    await waitFor(() => expect(insumoService.createInsumo).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(insumoService.createInsumo).mock.calls[0][0];
    expect(payload.codigo_barras).toBe(CODIGO);
    expect(payload).not.toHaveProperty("fuente");
    expect(payload).not.toHaveProperty("fecha_recuperacion");
    expect(payload).not.toHaveProperty("ficha");
  });

  it("código inválido que rechaza el servidor (422): muestra su mensaje y no toca el formulario", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(
      new ApiError("El dígito verificador del código de barras no es válido.", 422, {}, {
        mensaje: "El dígito verificador del código de barras no es válido.",
      }),
    );
    const user = await abrirPagina();

    await entregarCodigo(user, CODIGO);

    expect(
      await screen.findByText("El dígito verificador del código de barras no es válido."),
    ).toBeInTheDocument();
    expect(campo("Código de barras")).toHaveValue("");
  });

  it("un código con dígito verificador inválido ni siquiera se consulta", async () => {
    const user = await abrirPagina();

    await entregarCodigo(user, "7802910000972");

    expect(
      await within(panel()).findByText("El dígito verificador del código de barras no es válido."),
    ).toBeInTheDocument();
    expect(insumoService.consultarCodigoBarras).not.toHaveBeenCalled();
  });

  it("mientras busca lo dice y no deja abrir otro escaneo; al terminar vuelve a permitirlo", async () => {
    let responder: (consulta: ConsultaCodigo) => void = () => {};
    vi.mocked(insumoService.consultarCodigoBarras).mockImplementation(
      () => new Promise<ConsultaCodigo>((resolver) => (responder = resolver)),
    );
    const user = await abrirPagina();

    await entregarCodigo(user, CODIGO);

    expect(await screen.findByText("Buscando el producto…")).toBeInTheDocument();
    expect(botonEscanear()).toBeDisabled();
    expect(screen.queryByRole("dialog", { name: "Escanear código de barras" })).not.toBeInTheDocument();

    responder(LONCOLECHE);
    expect(await screen.findByText(MENSAJE_ENCONTRADO)).toBeInTheDocument();
    expect(botonEscanear()).toBeEnabled();
  });

  it("el panel del escáner se cierra al entregar el código y la consulta se hace una sola vez", async () => {
    const user = await abrirPagina();
    await user.click(botonEscanear());
    const abierto = await screen.findByRole("dialog", { name: "Escanear código de barras" });
    await user.type(within(abierto).getByLabelText("Número del código de barras"), CODIGO);

    // Enter and the button both submit: the second one finds the panel already closed.
    await user.click(within(abierto).getByRole("button", { name: "Buscar" }));
    await user.click(within(abierto).getByRole("button", { name: "Buscar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Escanear código de barras" })).not.toBeInTheDocument(),
    );
    expect(insumoService.consultarCodigoBarras).toHaveBeenCalledTimes(1);
  });

  it("se puede volver a buscar otro código después de un resultado", async () => {
    const user = await abrirPagina();
    await entregarCodigo(user, CODIGO);
    await esperarFormularioConProducto();
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(SIN_ALERGENOS);

    await entregarCodigo(user, OTRO_CODIGO);

    await waitFor(() => expect(campo("Nombre")).toHaveValue("Bicarbonato sódico"));
    expect(insumoService.consultarCodigoBarras).toHaveBeenCalledTimes(2);
    expect(insumoService.consultarCodigoBarras).toHaveBeenLastCalledWith(OTRO_CODIGO);
  });

  it("cerrar el escáner sin entregar un código no consulta nada ni toca el formulario", async () => {
    const user = await abrirPagina();
    await user.type(campo("Nombre"), "Mi insumo");

    await user.click(botonEscanear());
    await user.click(within(panel()).getByRole("button", { name: "Cerrar" }));

    expect(screen.queryByRole("dialog", { name: "Escanear código de barras" })).not.toBeInTheDocument();
    expect(insumoService.consultarCodigoBarras).not.toHaveBeenCalled();
    expect(campo("Nombre")).toHaveValue("Mi insumo");
  });
});

// =============================================================================================

describe("Precarga del formulario", () => {
  it("completa nombre, marca, presentación, ingredientes declarados y código", async () => {
    const user = await abrirPagina();

    await entregarCodigo(user, CODIGO);

    await esperarFormularioConProducto();
    expect(campo("Marca u origen")).toHaveValue("Lonco Leche");
    expect(campo("Presentación")).toHaveValue("1L");
    expect(campo("Ingredientes declarados")).toHaveValue(
      "Leche fluida natural entera, enzima lactasa y vitamina D3.",
    );
    expect(campo("Código de barras")).toHaveValue(CODIGO);
    expect(campo("Advertencias")).toHaveValue("");
    // The ingredient is for the productor to choose (CA07).
    expect(campo("Ingrediente")).toHaveValue("");
  });

  it("conserva el ingrediente que ya se había elegido, sin pedir confirmación", async () => {
    const user = await abrirPagina();
    await user.selectOptions(campo("Ingrediente"), "2");

    await entregarCodigo(user, CODIGO);

    await esperarFormularioConProducto();
    expect(campo("Ingrediente")).toHaveValue("2");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("sin ingrediente no se puede registrar: lo exige y no envía nada (CA07)", async () => {
    const user = await abrirPagina();
    await entregarCodigo(user, CODIGO);
    await esperarFormularioConProducto();

    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    expect(await screen.findByText("Selecciona el ingrediente que abastece este insumo.")).toBeInTheDocument();
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
  });

  it("cada búsqueda monta el formulario otra vez con los datos nuevos", async () => {
    const user = await abrirPagina();
    await entregarCodigo(user, CODIGO);
    await esperarFormularioConProducto();
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(SIN_ALERGENOS);

    await entregarCodigo(user, OTRO_CODIGO);

    await waitFor(() => expect(campo("Marca u origen")).toHaveValue("Carmencita"));
    expect(campo("Presentación")).toHaveValue("200 g");
    // The allergens of the first product did not stay behind.
    expect(screen.queryByText("Quitar alérgeno Leche")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar alérgeno Leche" })).not.toBeInTheDocument();
  });
});

describe("Formulario con cambios del productor", () => {
  async function conCambios() {
    const user = await abrirPagina();
    await user.type(campo("Nombre"), "Lo que yo escribí");
    await user.selectOptions(campo("Ingrediente"), "2");
    await entregarCodigo(user, CODIGO);
    return user;
  }

  it("pide confirmación antes de reemplazarlos y no cambia nada mientras tanto", async () => {
    await conCambios();

    const confirmacion = await screen.findByRole("alertdialog", { name: "Reemplazar los datos del formulario" });
    expect(confirmacion).toBeInTheDocument();
    expect(campo("Nombre")).toHaveValue("Lo que yo escribí");
  });

  it("«Reemplazar datos» aplica el producto y conserva el ingrediente elegido", async () => {
    const user = await conCambios();

    await user.click(await screen.findByRole("button", { name: "Reemplazar datos" }));

    await esperarFormularioConProducto();
    expect(campo("Ingrediente")).toHaveValue("2");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("«Conservar lo escrito» deja el formulario como estaba y retira el mensaje de producto encontrado", async () => {
    const user = await conCambios();

    await user.click(await screen.findByRole("button", { name: "Conservar lo escrito" }));

    expect(campo("Nombre")).toHaveValue("Lo que yo escribí");
    expect(campo("Código de barras")).toHaveValue("");
    expect(screen.queryByText(MENSAJE_ENCONTRADO)).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("alérgenos declarados por el productor también cuentan como cambios", async () => {
    const user = await abrirPagina();
    await user.click(screen.getByLabelText("Este insumo no contiene alérgenos"));

    await entregarCodigo(user, CODIGO);

    expect(await screen.findByRole("alertdialog", { name: "Reemplazar los datos del formulario" })).toBeInTheDocument();
  });

  it("no encontrado: conserva lo escrito y solo agrega el código, sin pedir confirmación", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(noEncontrado(CODIGO));
    const user = await abrirPagina();
    await user.type(campo("Nombre"), "Lo que yo escribí");
    await user.selectOptions(campo("Ingrediente"), "2");

    await entregarCodigo(user, CODIGO);

    await waitFor(() => expect(campo("Código de barras")).toHaveValue(CODIGO));
    expect(campo("Nombre")).toHaveValue("Lo que yo escribí");
    expect(campo("Ingrediente")).toHaveValue("2");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("no encontrado: lo escrito sigue protegido al salir de la página", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(noEncontrado(CODIGO));
    const user = await abrirPagina();
    await user.type(campo("Nombre"), "Lo que yo escribí");
    await entregarCodigo(user, CODIGO);
    await waitFor(() => expect(campo("Código de barras")).toHaveValue(CODIGO));

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByRole("alertdialog", { name: "Salir sin guardar" })).toBeInTheDocument();
  });
});

// =============================================================================================

describe("Alérgenos sugeridos", () => {
  it("avisa que son sugeridos y que hay que compararlos con el envase", async () => {
    const user = await abrirPagina();

    await entregarCodigo(user, CODIGO);

    expect(await screen.findByText(AVISO_SUGERIDOS)).toBeInTheDocument();
  });

  it("carga los alérgenos con su tipo y muestra de dónde viene cada uno", async () => {
    const user = await abrirPagina();

    await entregarCodigo(user, CODIGO);

    const contiene = await screen.findByRole("region", { name: "Contiene" });
    expect(within(contiene).getByText("Leche")).toBeInTheDocument();
    expect(within(contiene).getByText("(según el texto de ingredientes)")).toBeInTheDocument();
    const trazas = screen.getByRole("region", { name: "Puede contener" });
    expect(within(trazas).getByText("Maní")).toBeInTheDocument();
    expect(within(trazas).getByText("(según la etiqueta de la fuente)")).toBeInTheDocument();
  });

  it("lista lo que no pudo asociar para que el productor lo asigne a mano (CA06)", async () => {
    const user = await abrirPagina();

    await entregarCodigo(user, CODIGO);

    expect(await screen.findByText("No pudimos asociar:")).toBeInTheDocument();
    const lista = screen.getByText("No pudimos asociar:").parentElement!;
    const items = within(lista).getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual(["en:tree-nuts", "harina"]);
  });

  it("el origen deja de mostrarse al quitar el alérgeno, y quitarlo no cambia la validación", async () => {
    const user = await abrirPagina();
    await entregarCodigo(user, CODIGO);
    await screen.findByText("(según el texto de ingredientes)");

    await user.click(screen.getByRole("button", { name: "Quitar alérgeno Leche" }));

    expect(screen.queryByText("(según el texto de ingredientes)")).not.toBeInTheDocument();
    expect(screen.getByText("(según la etiqueta de la fuente)")).toBeInTheDocument();
  });

  it("sin sugerencias: el selector queda vacío, no hay aviso, y hay que declarar o marcar «no contiene»", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(SIN_ALERGENOS);
    const user = await abrirPagina();
    await user.selectOptions(campo("Ingrediente"), "1");

    await entregarCodigo(user, OTRO_CODIGO);

    await waitFor(() => expect(campo("Nombre")).toHaveValue("Bicarbonato sódico"));
    expect(screen.queryByText(AVISO_SUGERIDOS)).not.toBeInTheDocument();
    expect(screen.queryByText("No pudimos asociar:")).not.toBeInTheDocument();
    expect(screen.getByText("No hay alérgenos declarados como «Contiene».")).toBeInTheDocument();
    expect(screen.getByLabelText("Este insumo no contiene alérgenos")).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    expect(await screen.findByText(MENSAJE_ALERGENOS_INVALIDOS)).toBeInTheDocument();
    expect(insumoService.createInsumo).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText("Este insumo no contiene alérgenos"));
    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    await waitFor(() => expect(insumoService.createInsumo).toHaveBeenCalledTimes(1));
    expect(vi.mocked(insumoService.createInsumo).mock.calls[0][0].alergenos).toEqual([]);
  });

  it("solo hay términos sin reconocer: se listan, sin aviso de sugeridos, y el selector sigue vacío", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue({
      ...SIN_ALERGENOS,
      alergenos: { contiene: [], trazas: [], sin_reconocer: ["en:novel-food"] },
    });
    const user = await abrirPagina();

    await entregarCodigo(user, OTRO_CODIGO);

    expect(await screen.findByText("en:novel-food")).toBeInTheDocument();
    expect(screen.queryByText(AVISO_SUGERIDOS)).not.toBeInTheDocument();
    expect(screen.getByText("No hay alérgenos declarados como «Contiene».")).toBeInTheDocument();
  });
});

// =============================================================================================

describe("El insumo se registra solo al guardar", () => {
  async function conProductoEncontrado() {
    const user = await abrirPagina();
    await user.selectOptions(campo("Ingrediente"), "1");
    await entregarCodigo(user, CODIGO);
    await esperarFormularioConProducto();
    await screen.findByText(AVISO_SUGERIDOS);
    return user;
  }

  function ningunaEscrituraDeInsumos() {
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
    expect(insumoService.updateInsumo).not.toHaveBeenCalled();
    expect(insumoService.replaceInsumoAlergenos).not.toHaveBeenCalled();
    expect(insumoService.addInsumoAlergeno).not.toHaveBeenCalled();
    expect(insumoService.updateInsumoAlergenoTipo).not.toHaveBeenCalled();
    expect(insumoService.deleteInsumoAlergeno).not.toHaveBeenCalled();
    expect(insumoService.reactivateInsumo).not.toHaveBeenCalled();
  }

  it("buscar, ver las sugerencias y editar no envía nada: ni el insumo ni sus alérgenos", async () => {
    const user = await conProductoEncontrado();

    await user.click(screen.getByRole("button", { name: "Quitar alérgeno Maní" }));
    await user.type(campo("Advertencias"), "Revisar envase");

    ningunaEscrituraDeInsumos();
  });

  it("al guardar envía el insumo con alérgenos, fuente, fecha de recuperación y ficha", async () => {
    const user = await conProductoEncontrado();

    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    await waitFor(() => expect(insumoService.createInsumo).toHaveBeenCalledTimes(1));
    expect(insumoService.createInsumo).toHaveBeenCalledWith({
      ingrediente_id: 1,
      nombre: "LONCO LECHE SIN LACTOSA",
      marca_origen: "Lonco Leche",
      presentacion: "1L",
      codigo_barras: CODIGO,
      ingredientes_declarados: "Leche fluida natural entera, enzima lactasa y vitamina D3.",
      advertencias: null,
      habitual: false,
      fuente: "open_food_facts",
      fecha_recuperacion: "2026-10-19T15:00:00Z",
      ficha: FICHA,
      alergenos: [
        { alergeno_id: 1, tipo: "contiene" },
        { alergeno_id: 2, tipo: "trazas" },
      ],
    });
    expect(insumoService.replaceInsumoAlergenos).not.toHaveBeenCalled();
  });

  it("lo que el productor cambia antes de guardar es lo que se envía", async () => {
    const user = await conProductoEncontrado();
    await user.click(screen.getByRole("button", { name: "Quitar alérgeno Maní" }));
    await user.click(screen.getByRole("button", { name: "Cambiar Leche a Puede contener" }));
    await user.clear(campo("Nombre"));
    await user.type(campo("Nombre"), "Leche sin lactosa 1 L");

    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    await waitFor(() => expect(insumoService.createInsumo).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(insumoService.createInsumo).mock.calls[0][0];
    expect(payload.nombre).toBe("Leche sin lactosa 1 L");
    expect(payload.alergenos).toEqual([{ alergeno_id: 1, tipo: "trazas" }]);
    // Where it came from is still recorded.
    expect(payload.fuente).toBe("open_food_facts");
  });

  it("cancelar después de buscar no registra nada (PT13-12)", async () => {
    const user = await conProductoEncontrado();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    // The product loaded from the source is not the productor's work: leaving does not ask.
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Nuevo insumo", level: 1 })).not.toBeInTheDocument(),
    );
    ningunaEscrituraDeInsumos();
  });

  it("al guardar con éxito vuelve al listado", async () => {
    const user = await conProductoEncontrado();

    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    expect(await screen.findByRole("heading", { name: "Insumos", level: 1 })).toBeInTheDocument();
  });

  it("si al guardar el código ya existía (otra pestaña), sigue el aviso de siempre del formulario", async () => {
    vi.mocked(insumoService.createInsumo).mockRejectedValue(duplicado(10, true));
    const user = await conProductoEncontrado();

    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    expect(await screen.findByRole("link", { name: "Ver insumo existente" })).toHaveAttribute("href", "/insumos/10");
  });
});

// =============================================================================================

describe("El código ya está registrado (409)", () => {
  it("de un insumo activo: avisa y ofrece ver el insumo, sin precargar nada", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(duplicado(10, true));
    const user = await abrirPagina();

    await entregarCodigo(user, CODIGO);

    expect(await screen.findByText(/Ya tienes este insumo registrado/)).toBeInTheDocument();
    const aviso = screen.getByText(/Ya tienes este insumo registrado/).closest("div")!;
    expect(within(aviso).getByRole("link", { name: "Ver insumo" })).toHaveAttribute("href", "/insumos/10");
    expect(within(aviso).queryByRole("button", { name: "Reactivar" })).not.toBeInTheDocument();
    expect(campo("Nombre")).toHaveValue("");
    expect(campo("Código de barras")).toHaveValue("");
    expect(screen.queryByText(MENSAJE_ENCONTRADO)).not.toBeInTheDocument();
  });

  it("de un insumo desactivado: ofrece ver el insumo y reactivarlo", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(duplicado(10, false));
    const user = await abrirPagina();

    await entregarCodigo(user, CODIGO);

    const aviso = (await screen.findByText(/Ya tienes este insumo registrado/)).closest("div")!;
    expect(within(aviso).getByRole("link", { name: "Ver insumo" })).toBeInTheDocument();
    expect(within(aviso).getByRole("button", { name: "Reactivar" })).toBeInTheDocument();
  });

  it("«Reactivar» lo reactiva y abre su detalle", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(duplicado(10, false));
    vi.mocked(insumoService.reactivateInsumo).mockResolvedValue(insumo({ activo: true }));
    const user = await abrirPagina();
    await entregarCodigo(user, CODIGO);

    await user.click(await screen.findByRole("button", { name: "Reactivar" }));

    await waitFor(() => expect(insumoService.reactivateInsumo).toHaveBeenCalledWith(10));
    expect(await screen.findByRole("heading", { name: "Leche Colun 1 L", level: 1 })).toBeInTheDocument();
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
  });

  it("si no se puede reactivar, lo dice y deja las opciones", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(duplicado(10, false));
    vi.mocked(insumoService.reactivateInsumo).mockRejectedValue(new ApiError("falla", 500));
    const user = await abrirPagina();
    await entregarCodigo(user, CODIGO);

    await user.click(await screen.findByRole("button", { name: "Reactivar" }));

    expect(await screen.findByText("No pudimos reactivar el insumo. Inténtalo nuevamente.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivar" })).toBeInTheDocument();
  });

  it("después del aviso se puede buscar otro código", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValueOnce(duplicado(10, true));
    const user = await abrirPagina();
    await entregarCodigo(user, CODIGO);
    await screen.findByText(/Ya tienes este insumo registrado/);
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(SIN_ALERGENOS);

    await entregarCodigo(user, OTRO_CODIGO);

    await waitFor(() => expect(campo("Nombre")).toHaveValue("Bicarbonato sódico"));
    expect(screen.queryByText(/Ya tienes este insumo registrado/)).not.toBeInTheDocument();
  });
});
