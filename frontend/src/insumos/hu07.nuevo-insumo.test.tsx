/**
 * "Nuevo insumo" (HU07 / T07-06), with the API simulated: the first screen with three ways to start, the
 * search by name or brand in Jumbo, the hit that preloads the form, the duplicate notice and the origin of
 * what the productor confirms (fuentes_campos, campos_editados, fuentes_por_alergeno).
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
import { ApiError } from "@/types/auth";
import type { ConsultaCodigo, ResultadoBusquedaNombre } from "@/types/consultaCodigo";
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
  buscarPorNombre: vi.fn(),
  consultarResultadoDeBusqueda: vi.fn(),
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

const SLUG = "quesomantecoso-quilque-28laminasenvaseresellablealvacio500grs-2";

const RESULTADOS: ResultadoBusquedaNombre[] = [
  {
    id: SLUG,
    nombre: "Queso Mantecoso Quilque 28 láminas 500 g",
    marca: "Quilque",
    presentacion: "500 g",
    url: `https://www.jumbo.cl/${SLUG}/p`,
  },
  {
    id: "queso-mantecoso-quilque-250-g-2",
    nombre: "Queso Mantecoso Quilque 250 g",
    marca: "Quilque",
    presentacion: "250 g",
    url: null,
  },
  { id: "sin-marca-x", nombre: "Queso sin marca", marca: null, presentacion: null, url: null },
];

const CATALOGO: AlergenoCatalogo[] = [
  { id: 1, codigo: "lacteos", nombre: "Leche", obligatorio_chile: true },
  { id: 2, codigo: "soja", nombre: "Soya", obligatorio_chile: true },
  { id: 4, codigo: "sesamo", nombre: "Sésamo", obligatorio_chile: false },
];

const PROPUESTA: ConsultaCodigo = {
  codigo_barras: "7802900001193",
  encontrado: true,
  fuente: "jumbo",
  fecha_recuperacion: "2026-11-06T15:00:00Z",
  producto: {
    nombre: "Queso Mantecoso Quilque",
    marca_origen: "Quilque",
    presentacion: "500 g",
    ingredientes_declarados: "Leche natural, sal, cuajo.",
  },
  alergenos: {
    contiene: [{ alergeno_id: 1, codigo: "lacteos", nombre: "Leche", origen: "texto", fuentes: ["ingredientes"] }],
    trazas: [{ alergeno_id: 2, codigo: "soja", nombre: "Soya", origen: "etiqueta", fuentes: ["jumbo"] }],
    sin_reconocer: [],
  },
  ficha: { url: `https://www.jumbo.cl/${SLUG}/p`, slug: SLUG, gtin: "7802900001193" },
  fuentes_campos: {
    nombre: "jumbo",
    marca_origen: "jumbo",
    presentacion: "jumbo",
    ingredientes_declarados: "jumbo",
  },
};

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

function insumo(overrides: Partial<Insumo> = {}): Insumo {
  return {
    id: 10,
    productor_id: 1,
    ingrediente_id: 1,
    ingrediente: { id: 1, nombre: "Leche" },
    nombre: "Queso Quilque",
    marca_origen: "Quilque",
    presentacion: null,
    codigo_barras: "7802900001193",
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
  vi.mocked(insumoService.buscarPorNombre).mockResolvedValue(RESULTADOS);
  vi.mocked(insumoService.consultarResultadoDeBusqueda).mockResolvedValue(PROPUESTA);
  vi.mocked(insumoService.createInsumo).mockResolvedValue(insumo({ id: 99 }));
});

// --- helpers ---

async function abrir(ruta: string) {
  const user = userEvent.setup();
  renderWithProviders(<App />, { initialEntries: [ruta] });
  expect(await screen.findByRole("heading", { name: "Nuevo insumo", level: 1 })).toBeInTheDocument();
  return user;
}

async function abrirBusquedaPorNombre() {
  const user = await abrir("/insumos/nuevo/nombre");
  await waitFor(() => expect(screen.getByLabelText("Ingrediente")).toBeEnabled());
  return user;
}

const campo = (nombre: string) => screen.getByLabelText(nombre) as HTMLInputElement;
const bloque = () => screen.getByRole("region", { name: "Buscar por nombre o marca" });

async function buscar(user: ReturnType<typeof userEvent.setup>, texto: string) {
  await user.type(within(bloque()).getByLabelText("Nombre o marca"), texto);
  await user.click(within(bloque()).getByRole("button", { name: "Buscar" }));
}

async function elegirPrimero(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await within(bloque()).findByRole("button", { name: `Revisar ficha de ${RESULTADOS[0].nombre}` }),
  );
  await waitFor(() => expect(campo("Nombre")).toHaveValue("Queso Mantecoso Quilque"));
}

async function completarYCrear(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(campo("Ingrediente"), "1");
  await user.click(screen.getByRole("button", { name: "Crear insumo" }));
  await waitFor(() => expect(insumoService.createInsumo).toHaveBeenCalledTimes(1));
  return vi.mocked(insumoService.createInsumo).mock.calls[0][0];
}

// =============================================================================================

describe("Pantalla inicial de un nuevo insumo", () => {
  it("ofrece las tres formas de empezar y no muestra el formulario todavía", async () => {
    await abrir("/insumos/nuevo");

    expect(await screen.findByText("¿Cómo quieres registrar el insumo?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Escanear código de barras/ })).toHaveAttribute(
      "href",
      "/insumos/nuevo/codigo",
    );
    expect(screen.getByRole("link", { name: /Buscar por nombre o marca/ })).toHaveAttribute(
      "href",
      "/insumos/nuevo/nombre",
    );
    expect(screen.getByRole("link", { name: /Ingresar manualmente/ })).toHaveAttribute(
      "href",
      "/insumos/nuevo/manual",
    );
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
    // Starting does not ask any source and saves nothing (CA9).
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
    expect(insumoService.consultarCodigoBarras).not.toHaveBeenCalled();
    expect(insumoService.buscarPorNombre).not.toHaveBeenCalled();
  });

  it("«Ingresar manualmente» abre el formulario sin ningún bloque de búsqueda", async () => {
    const user = await abrir("/insumos/nuevo");

    await user.click(await screen.findByRole("link", { name: /Ingresar manualmente/ }));

    expect(await screen.findByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Buscar por código de barras" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Buscar por nombre o marca" })).not.toBeInTheDocument();
  });

  it("«Escanear código de barras» y «Buscar por nombre o marca» abren el formulario con su bloque", async () => {
    const user = await abrir("/insumos/nuevo");

    await user.click(await screen.findByRole("link", { name: /Escanear código de barras/ }));
    expect(await screen.findByRole("region", { name: "Buscar por código de barras" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Volver al inicio/ }));
    await user.click(await screen.findByRole("link", { name: /Buscar por nombre o marca/ }));
    expect(await screen.findByRole("region", { name: "Buscar por nombre o marca" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
  });

  it("un método desconocido en la dirección vuelve a la pantalla inicial", async () => {
    await abrir("/insumos/nuevo/xyz");
    expect(await screen.findByText("¿Cómo quieres registrar el insumo?")).toBeInTheDocument();
  });
});

describe("Búsqueda por nombre o marca", () => {
  it("lista los resultados con nombre, marca y presentación, y dice que la fuente es Jumbo", async () => {
    const user = await abrirBusquedaPorNombre();

    await buscar(user, "queso quilque");

    expect(insumoService.buscarPorNombre).toHaveBeenCalledWith("queso quilque");
    const lista = await within(bloque()).findByRole("list", { name: "Resultados de la búsqueda" });
    const filas = within(lista).getAllByRole("listitem");
    expect(filas).toHaveLength(3);
    expect(within(filas[0]).getByText(RESULTADOS[0].nombre)).toBeInTheDocument();
    expect(within(filas[0]).getByText("Quilque")).toBeInTheDocument();
    expect(within(filas[0]).getByText(/· 500 g/)).toBeInTheDocument();
    expect(within(filas[2]).getByText("Sin marca")).toBeInTheDocument();
    expect(within(bloque()).getByText(/Fuente: Jumbo/)).toBeInTheDocument();
    // Searching registers nothing and does not touch the form.
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
    expect(campo("Nombre")).toHaveValue("");
  });

  it("un texto muy corto no se consulta y lo explica", async () => {
    const user = await abrirBusquedaPorNombre();

    await buscar(user, "a");

    expect(await within(bloque()).findByText("Escribe al menos 2 letras para buscar.")).toBeInTheDocument();
    expect(insumoService.buscarPorNombre).not.toHaveBeenCalled();
  });

  it("sin resultados: lo dice (CA10) y deja el formulario como estaba", async () => {
    vi.mocked(insumoService.buscarPorNombre).mockResolvedValue([]);
    const user = await abrirBusquedaPorNombre();
    await user.type(campo("Nombre"), "Lo que yo escribí");

    await buscar(user, "zzzz");

    expect(await within(bloque()).findByText(/No encontramos productos con ese texto/)).toBeInTheDocument();
    expect(campo("Nombre")).toHaveValue("Lo que yo escribí");
  });

  it("Jumbo caído (503): mensaje y formulario manual intacto", async () => {
    vi.mocked(insumoService.buscarPorNombre).mockRejectedValue(
      new ApiError("No pudimos completar la operación.", 503, {}, { mensaje: "x", motivo: "timeout" }),
    );
    const user = await abrirBusquedaPorNombre();
    await user.type(campo("Nombre"), "Lo que yo escribí");
    await user.type(campo("Marca u origen"), "Mi marca");

    await buscar(user, "queso");

    expect(
      await within(bloque()).findByText("No pudimos consultar Jumbo en este momento. Completa los datos manualmente."),
    ).toBeInTheDocument();
    expect(campo("Nombre")).toHaveValue("Lo que yo escribí");
    expect(campo("Marca u origen")).toHaveValue("Mi marca");
  });

  it("elegir un resultado precarga el formulario con la ficha, sin registrar nada", async () => {
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");

    await elegirPrimero(user);

    expect(insumoService.consultarResultadoDeBusqueda).toHaveBeenCalledWith(SLUG);
    expect(campo("Marca u origen")).toHaveValue("Quilque");
    expect(campo("Presentación")).toHaveValue("500 g");
    expect(campo("Código de barras")).toHaveValue("7802900001193");
    expect(campo("Ingredientes declarados")).toHaveValue("Leche natural, sal, cuajo.");
    expect(
      await within(bloque()).findByText(
        "Encontramos este producto en Jumbo. Revisa los datos antes de crear el insumo.",
      ),
    ).toBeInTheDocument();
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
  });

  it("un producto a granel no trae código de barras: el campo queda vacío", async () => {
    vi.mocked(insumoService.consultarResultadoDeBusqueda).mockResolvedValue({
      ...PROPUESTA,
      codigo_barras: "",
    });
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso granel");

    await elegirPrimero(user);

    expect(campo("Código de barras")).toHaveValue("");
  });

  it("producto ya registrado (409): avisa, ofrece «Usar el insumo existente» y no precarga", async () => {
    vi.mocked(insumoService.consultarResultadoDeBusqueda).mockRejectedValue(duplicado(10, true));
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");

    await user.click(
      await within(bloque()).findByRole("button", { name: `Revisar ficha de ${RESULTADOS[0].nombre}` }),
    );

    expect(await within(bloque()).findByText("Este producto ya está en tus insumos")).toBeInTheDocument();
    expect(within(bloque()).getByRole("link", { name: "Usar el insumo existente" })).toHaveAttribute(
      "href",
      "/insumos/10",
    );
    expect(campo("Nombre")).toHaveValue("");
  });

  it("si el insumo repetido está desactivado ofrece reactivarlo", async () => {
    vi.mocked(insumoService.consultarResultadoDeBusqueda).mockRejectedValue(duplicado(10, false));
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");

    await user.click(
      await within(bloque()).findByRole("button", { name: `Revisar ficha de ${RESULTADOS[0].nombre}` }),
    );

    expect(await within(bloque()).findByRole("button", { name: "Reactivar" })).toBeInTheDocument();
  });

  it("la ficha ya no existe (404): lo dice con el mensaje del servidor y deja el formulario", async () => {
    vi.mocked(insumoService.consultarResultadoDeBusqueda).mockRejectedValue(
      new ApiError("Este producto ya no está disponible en Jumbo.", 404, {}, {
        mensaje: "Este producto ya no está disponible en Jumbo.",
      }),
    );
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");

    await user.click(
      await within(bloque()).findByRole("button", { name: `Revisar ficha de ${RESULTADOS[0].nombre}` }),
    );

    expect(await within(bloque()).findByText("Este producto ya no está disponible en Jumbo.")).toBeInTheDocument();
    expect(campo("Nombre")).toHaveValue("");
  });

  it("con el formulario ya modificado pide confirmar antes de reemplazarlo; conservar no cambia nada", async () => {
    const user = await abrirBusquedaPorNombre();
    await user.type(campo("Nombre"), "Lo que yo escribí");
    await buscar(user, "queso quilque");

    await user.click(
      await within(bloque()).findByRole("button", { name: `Revisar ficha de ${RESULTADOS[0].nombre}` }),
    );

    expect(
      await screen.findByRole("alertdialog", { name: "Reemplazar los datos del formulario" }),
    ).toBeInTheDocument();
    expect(campo("Nombre")).toHaveValue("Lo que yo escribí");
    await user.click(screen.getByRole("button", { name: "Conservar lo escrito" }));
    expect(campo("Nombre")).toHaveValue("Lo que yo escribí");
  });

  it("«Reemplazar datos» aplica el producto elegido y conserva el ingrediente", async () => {
    const user = await abrirBusquedaPorNombre();
    await user.selectOptions(campo("Ingrediente"), "2");
    await user.type(campo("Nombre"), "Lo que yo escribí");
    await buscar(user, "queso quilque");

    await user.click(
      await within(bloque()).findByRole("button", { name: `Revisar ficha de ${RESULTADOS[0].nombre}` }),
    );
    await user.click(await screen.findByRole("button", { name: "Reemplazar datos" }));

    await waitFor(() => expect(campo("Nombre")).toHaveValue("Queso Mantecoso Quilque"));
    expect(campo("Ingrediente")).toHaveValue("2");
  });
});

describe("Al confirmar un insumo recuperado: el origen de cada dato", () => {
  it("sin cambios del productor envía la fuente, la ficha y el origen de cada campo y alérgeno", async () => {
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");
    await elegirPrimero(user);

    const payload = await completarYCrear(user);

    expect(payload.fuente).toBe("jumbo");
    expect(payload.fecha_recuperacion).toBe("2026-11-06T15:00:00Z");
    expect(payload.ficha).toEqual(PROPUESTA.ficha);
    expect(payload.fuentes_campos).toEqual(PROPUESTA.fuentes_campos);
    expect(payload.campos_editados).toEqual([]);
    expect(payload.fuentes_alergenos).toEqual(expect.arrayContaining(["ingredientes", "jumbo"]));
    expect(payload.fuentes_por_alergeno).toEqual({
      lacteos: { tipo: "contiene", fuentes: ["ingredientes"] },
      soja: { tipo: "traza", fuentes: ["jumbo"] },
    });
  });

  it("un campo que el productor cambió se envía como editado", async () => {
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");
    await elegirPrimero(user);
    await user.clear(campo("Presentación"));
    await user.type(campo("Presentación"), "1 kg");

    const payload = await completarYCrear(user);

    expect(payload.campos_editados).toEqual(["presentacion"]);
    expect(payload.presentacion).toBe("1 kg");
    expect(payload.fuentes_campos).toEqual(PROPUESTA.fuentes_campos);
  });

  it("escribir lo mismo con espacios de más no cuenta como edición", async () => {
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");
    await elegirPrimero(user);
    await user.type(campo("Marca u origen"), "  ");

    const payload = await completarYCrear(user);

    expect(payload.campos_editados).toEqual([]);
  });

  it("un alérgeno agregado a mano va como «manual» y los alérgenos cuentan como editados", async () => {
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");
    await elegirPrimero(user);
    const grupo = screen.getByRole("group", { name: "Alérgenos del insumo" });
    await user.click(await within(grupo).findByRole("button", { name: "+ Agregar alérgeno" }));
    await user.selectOptions(within(grupo).getByLabelText("Alérgeno del catálogo"), "4");
    await user.click(within(grupo).getByRole("button", { name: "Agregar" }));

    const payload = await completarYCrear(user);

    expect(payload.campos_editados).toEqual(["alergenos"]);
    expect(payload.fuentes_por_alergeno?.sesamo).toEqual({ tipo: expect.any(String), fuentes: ["manual"] });
    expect(payload.fuentes_por_alergeno?.lacteos).toEqual({ tipo: "contiene", fuentes: ["ingredientes"] });
  });

  it("un insumo manual no envía ningún campo de origen", async () => {
    const user = await abrir("/insumos/nuevo/manual");
    await waitFor(() => expect(screen.getByLabelText("Ingrediente")).toBeEnabled());
    await user.type(campo("Nombre"), "Queso casero");
    await user.type(campo("Marca u origen"), "Casero");
    await user.click(screen.getByLabelText("Este insumo no contiene alérgenos"));

    const payload = await completarYCrear(user);

    for (const clave of ["fuentes_campos", "fuentes_alergenos", "fuentes_por_alergeno", "campos_editados"]) {
      expect(payload).not.toHaveProperty(clave);
    }
    expect(payload).not.toHaveProperty("fuente");
  });
});
