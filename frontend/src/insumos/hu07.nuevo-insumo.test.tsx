/**
 * "Nuevo insumo" (HU07 / T07-06), with the API simulated: the first screen with three ways to start, the
 * search by name or brand in Jumbo, the hit that preloads the form, the duplicate notice and the origin of
 * what the productor confirms (fuentes_campos, campos_editados, fuentes_por_alergeno).
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
    imagen_url: "https://imagenes.jumbo.test/quilque-500g-1.jpg",
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
  await user.click(within(bloque()).getByRole("button", { name: "Buscar en Jumbo" }));
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
    for (const titulo of ["Escanear código de barras", "Buscar por nombre o marca", "Ingresar manualmente"]) {
      expect(screen.getByRole("heading", { name: titulo, level: 3 })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: /Comenzar escaneo/ })).toHaveAttribute("href", "/insumos/nuevo/codigo");
    expect(screen.getByRole("link", { name: /Buscar producto/ })).toHaveAttribute("href", "/insumos/nuevo/nombre");
    expect(screen.getByRole("link", { name: /Crear ficha manual/ })).toHaveAttribute("href", "/insumos/nuevo/manual");
    // The header, as in the design: back button, «Nuevo insumo» (h1) and the title (h2).
    expect(screen.getByRole("link", { name: /Volver a Insumos/ })).toHaveAttribute("href", "/insumos");
    expect(screen.getByRole("heading", { name: "¿Cómo quieres registrar el insumo?", level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Ruta de navegación" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
    // Starting does not ask any source and saves nothing (CA9).
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
    expect(insumoService.consultarCodigoBarras).not.toHaveBeenCalled();
    expect(insumoService.buscarPorNombre).not.toHaveBeenCalled();
  });

  it("«Ingresar manualmente» abre el formulario sin ningún bloque de búsqueda", async () => {
    const user = await abrir("/insumos/nuevo");

    await user.click(await screen.findByRole("link", { name: /Crear ficha manual/ }));

    expect(await screen.findByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Buscar por código de barras" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Buscar por nombre o marca" })).not.toBeInTheDocument();
  });

  it("«Escanear código de barras» y «Buscar por nombre o marca» abren el formulario con su bloque", async () => {
    const user = await abrir("/insumos/nuevo");

    await user.click(await screen.findByRole("link", { name: /Comenzar escaneo/ }));
    expect(await screen.findByRole("region", { name: "Buscar por código de barras" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Volver al inicio/ }));
    await user.click(await screen.findByRole("link", { name: /Buscar producto/ }));
    expect(await screen.findByRole("region", { name: "Buscar por nombre o marca" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
  });

  it("un método desconocido en la dirección vuelve a la pantalla inicial", async () => {
    await abrir("/insumos/nuevo/xyz");
    expect(await screen.findByText("¿Cómo quieres registrar el insumo?")).toBeInTheDocument();
  });
});

describe("Búsqueda por nombre o marca", () => {
  it("lista los resultados con nombre, marca y presentación, y dice una sola vez que los resultados y las imágenes son de Jumbo", async () => {
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
    // Ajuste de diseño: la atribución va una sola vez, en el encabezado de los resultados.
    expect(within(bloque()).getByText("Resultados e imágenes de Jumbo")).toBeInTheDocument();
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

describe("Miniatura del producto", () => {
  const miniaturas = (contenedor: HTMLElement) =>
    Array.from(contenedor.querySelectorAll<HTMLElement>("[data-miniatura-producto]"));

  it("en los resultados: imagen diferida con el nombre del producto como descripción; la atribución no se repite en cada resultado", async () => {
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");

    const lista = await within(bloque()).findByRole("list", { name: "Resultados de la búsqueda" });
    const imagen = within(lista).getByRole("img", { name: RESULTADOS[0].nombre });
    expect(imagen).toHaveAttribute("src", RESULTADOS[0].imagen_url);
    expect(imagen).toHaveAttribute("loading", "lazy");
    // Ajuste de diseño: 72 px en celular (120 px de alto en la tarjeta de escritorio).
    expect(Number(imagen.getAttribute("width"))).toBe(72);
    expect(within(lista).queryByText(/Imagen:/)).not.toBeInTheDocument();
  });

  it("un resultado sin imagen deja un espacio neutro: sin <img>, sin ícono roto y sin atribución", async () => {
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");

    const lista = await within(bloque()).findByRole("list", { name: "Resultados de la búsqueda" });
    const filas = within(lista).getAllByRole("listitem");
    expect(miniaturas(filas[1])).toHaveLength(1);
    expect(within(filas[1]).queryByRole("img")).not.toBeInTheDocument();
    expect(within(filas[1]).queryByText(/Imagen:/)).not.toBeInTheDocument();
    // Ajuste de diseño: ningún resultado repite la atribución; está en el encabezado.
    expect(within(lista).queryAllByText(/Imagen:/)).toHaveLength(0);
  });

  it("una imagen que no carga se reemplaza por el espacio neutro y retira la atribución", async () => {
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");
    const lista = await within(bloque()).findByRole("list", { name: "Resultados de la búsqueda" });

    fireEvent.error(within(lista).getByRole("img", { name: RESULTADOS[0].nombre }));

    await waitFor(() => expect(within(lista).queryByRole("img")).not.toBeInTheDocument());
    expect(within(lista).queryByText(/Imagen:/)).not.toBeInTheDocument();
    expect(miniaturas(lista)).toHaveLength(3);
  });

  it("en la revisión: la miniatura del producto elegido con su fuente; no viaja en lo que se confirma", async () => {
    vi.mocked(insumoService.consultarResultadoDeBusqueda).mockResolvedValue({
      ...PROPUESTA,
      imagen_url: "https://imagenes.jumbo.test/quilque-500g-1.jpg",
      imagen_fuente: "jumbo",
    });
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");
    await elegirPrimero(user);

    const resumen = document.querySelector("[data-resumen-producto-encontrado]") as HTMLElement;
    const imagen = within(resumen.parentElement as HTMLElement).getByRole("img", {
      name: "Queso Mantecoso Quilque",
    });
    expect(imagen).toHaveAttribute("src", "https://imagenes.jumbo.test/quilque-500g-1.jpg");
    expect(imagen).toHaveAttribute("loading", "lazy");
    expect(within(resumen.parentElement as HTMLElement).getByText("Imagen: Jumbo")).toBeInTheDocument();

    const payload = await completarYCrear(user);
    expect(JSON.stringify(payload)).not.toContain("imagenes.jumbo.test");
    expect(payload).not.toHaveProperty("imagen_url");
    expect(payload).not.toHaveProperty("imagen_fuente");
  });

  it("la fuente de la imagen de una ficha combinada puede ser Open Food Facts", async () => {
    vi.mocked(insumoService.consultarResultadoDeBusqueda).mockResolvedValue({
      ...PROPUESTA,
      fuente: "combinada",
      imagen_url: "https://imagenes.fuente-b.test/x.jpg",
      imagen_fuente: "open_food_facts",
    });
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");
    await elegirPrimero(user);

    expect(await screen.findByText("Imagen: Open Food Facts")).toBeInTheDocument();
  });

  it("en la revisión, sin imagen o con una que falla: espacio neutro, sin ícono roto", async () => {
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");
    await elegirPrimero(user);
    const contenedor = (document.querySelector("[data-resumen-producto-encontrado]") as HTMLElement)
      .parentElement as HTMLElement;
    expect(miniaturas(contenedor)).toHaveLength(1);
    expect(within(contenedor).queryByRole("img")).not.toBeInTheDocument();
    expect(within(contenedor).queryByText(/Imagen:/)).not.toBeInTheDocument();
  });

  it("una imagen de la revisión que falla al cargar vuelve al espacio neutro", async () => {
    vi.mocked(insumoService.consultarResultadoDeBusqueda).mockResolvedValue({
      ...PROPUESTA,
      imagen_url: "https://imagenes.jumbo.test/rota.jpg",
      imagen_fuente: "jumbo",
    });
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");
    await elegirPrimero(user);
    const contenedor = (document.querySelector("[data-resumen-producto-encontrado]") as HTMLElement)
      .parentElement as HTMLElement;

    fireEvent.error(within(contenedor).getByRole("img", { name: "Queso Mantecoso Quilque" }));

    await waitFor(() => expect(within(contenedor).queryByRole("img")).not.toBeInTheDocument());
    expect(within(contenedor).queryByText(/Imagen:/)).not.toBeInTheDocument();
  });
});

// --- Entrega A de T07-07: pantalla inicial, búsqueda por código y T07-08 ---

describe("Búsqueda por código de barras en la pantalla (T07-07 A)", () => {
  const CODIGO = "7802910000971";
  const campoCodigo = () => screen.getByLabelText("Código de barras del envase") as HTMLInputElement;

  async function buscarCodigo(user: ReturnType<typeof userEvent.setup>, codigo: string) {
    await user.type(campoCodigo(), codigo);
    await user.click(screen.getByRole("button", { name: "Buscar en fuentes" }));
  }

  it("encabezado del diseño: «Volver al inicio», «Nuevo insumo · Búsqueda» (h1 y paso), título como h2", async () => {
    await abrir("/insumos/nuevo/codigo");

    expect(screen.getByRole("link", { name: /Volver al inicio/ })).toHaveAttribute("href", "/insumos/nuevo");
    expect(screen.getByRole("heading", { name: "Buscar producto comercial", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("· Búsqueda")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Ruta de navegación" })).not.toBeInTheDocument();
  });

  it("muestra el método de búsqueda, el recorrido de las fuentes y el estado vacío", async () => {
    await abrir("/insumos/nuevo/codigo");

    const metodos = screen.getByRole("navigation", { name: "Método de búsqueda" });
    expect(within(metodos).getByRole("link", { name: "Código de barras" })).toHaveAttribute("aria-current", "page");
    expect(within(metodos).getByRole("link", { name: "Nombre o marca" })).toHaveAttribute(
      "href",
      "/insumos/nuevo/nombre",
    );
    const region = screen.getByRole("region", { name: "Buscar por código de barras" });
    expect(within(region).getByText("Open Food Facts")).toBeInTheDocument();
    expect(within(region).getByText("Jumbo.cl")).toBeInTheDocument();
    expect(within(region).getByText("Ingresa el código del envase")).toBeInTheDocument();
    expect(screen.getByText("Tú mantienes el control")).toBeInTheDocument();
  });

  it("el código escrito en el campo se consulta igual que el de la cámara", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue({
      ...PROPUESTA,
      codigo_barras: CODIGO,
      fuente: "open_food_facts",
    });
    const user = await abrir("/insumos/nuevo/codigo");

    await buscarCodigo(user, CODIGO);

    expect(insumoService.consultarCodigoBarras).toHaveBeenCalledWith(CODIGO);
    await waitFor(() => expect(campo("Nombre")).toHaveValue("Queso Mantecoso Quilque"));
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
  });

  it("sin texto el botón «Buscar en fuentes» no se puede usar; un código inválido ni se consulta", async () => {
    const user = await abrir("/insumos/nuevo/codigo");
    expect(screen.getByRole("button", { name: "Buscar en fuentes" })).toBeDisabled();

    await buscarCodigo(user, "7802910000972");

    expect(await screen.findByText("El dígito verificador del código de barras no es válido.")).toBeInTheDocument();
    expect(insumoService.consultarCodigoBarras).not.toHaveBeenCalled();
  });

  it("mientras consulta: tarjeta con el texto fijo y «Cancelar consulta»; cancelar descarta la respuesta", async () => {
    let responder: (consulta: ConsultaCodigo) => void = () => {};
    vi.mocked(insumoService.consultarCodigoBarras).mockImplementation(
      () => new Promise<ConsultaCodigo>((resolver) => (responder = resolver)),
    );
    const user = await abrir("/insumos/nuevo/codigo");
    await user.type(campo("Nombre"), "Lo que yo escribí");

    await buscarCodigo(user, CODIGO);

    expect(await screen.findByText("Consultando Open Food Facts y Jumbo")).toBeInTheDocument();
    expect(screen.getByText("Estamos preparando la ficha")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar consulta" }));
    expect(await screen.findByRole("button", { name: "Buscar en fuentes" })).toBeInTheDocument();

    responder({ ...PROPUESTA, codigo_barras: CODIGO });
    await new Promise((resolver) => setTimeout(resolver, 20));
    // The late answer is dropped: the form keeps what was typed and nothing is registered.
    expect(campo("Nombre")).toHaveValue("Lo que yo escribí");
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
  });

  it("código no encontrado (T07-08): ofrece buscar por nombre o ingresar manualmente", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue({
      ...PROPUESTA,
      encontrado: false,
      producto: null,
      ficha: null,
      codigo_barras: CODIGO,
    });
    const user = await abrir("/insumos/nuevo/codigo");

    await buscarCodigo(user, CODIGO);

    expect(await screen.findByText("No encontramos este código. Completa los datos manualmente.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buscar por nombre" })).toHaveAttribute("href", "/insumos/nuevo/nombre");
    expect(screen.getByRole("link", { name: "Ingresar manualmente" })).toHaveAttribute(
      "href",
      "/insumos/nuevo/manual",
    );
  });

  it("fuente no disponible (T07-08): ofrece las mismas dos salidas", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(
      new ApiError("No pudimos completar la operación.", 503, {}, { mensaje: "x", motivo: "timeout" }),
    );
    const user = await abrir("/insumos/nuevo/codigo");

    await buscarCodigo(user, CODIGO);

    expect(
      await screen.findByText("No pudimos consultar la fuente en este momento. Completa los datos manualmente."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buscar por nombre" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ingresar manualmente" })).toBeInTheDocument();
  });

  it("«Ingresar manualmente» conserva el código escrito en el formulario y quita el bloque de búsqueda", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue({
      ...PROPUESTA,
      encontrado: false,
      producto: null,
      ficha: null,
      codigo_barras: CODIGO,
    });
    const user = await abrir("/insumos/nuevo/codigo");
    await buscarCodigo(user, CODIGO);
    await user.click(await screen.findByRole("link", { name: "Ingresar manualmente" }));

    expect(await screen.findByRole("heading", { name: "Completar ficha manual", level: 2 })).toBeInTheDocument();
    expect(campo("Código de barras")).toHaveValue(CODIGO);
    expect(screen.queryByRole("region", { name: "Buscar por código de barras" })).not.toBeInTheDocument();
  });
});

describe("Búsqueda por nombre en la pantalla (T07-07 A)", () => {
  it("muestra el método, la fuente (solo Jumbo), el estado vacío y la nota de control", async () => {
    await abrirBusquedaPorNombre();

    const metodos = screen.getByRole("navigation", { name: "Método de búsqueda" });
    expect(within(metodos).getByRole("link", { name: "Nombre o marca" })).toHaveAttribute("aria-current", "page");
    expect(within(bloque()).getByText("Jumbo.cl")).toBeInTheDocument();
    expect(within(bloque()).queryByText("Open Food Facts")).not.toBeInTheDocument();
    expect(within(bloque()).getByText("Busca por nombre comercial o marca")).toBeInTheDocument();
    expect(screen.getByText("Tú mantienes el control")).toBeInTheDocument();
  });

  it("sin resultados o con Jumbo caído ofrece «Ingresar manualmente»", async () => {
    vi.mocked(insumoService.buscarPorNombre).mockResolvedValueOnce([]);
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "zzzz");
    expect(await within(bloque()).findByRole("link", { name: "Ingresar manualmente" })).toHaveAttribute(
      "href",
      "/insumos/nuevo/manual",
    );

    vi.mocked(insumoService.buscarPorNombre).mockRejectedValueOnce(
      new ApiError("No pudimos completar la operación.", 503, {}, { mensaje: "x", motivo: "timeout" }),
    );
    await user.click(within(bloque()).getByRole("button", { name: "Buscar en Jumbo" }));
    await within(bloque()).findByText(/No pudimos consultar Jumbo/);
    expect(within(bloque()).getByRole("link", { name: "Ingresar manualmente" })).toBeInTheDocument();
  });
});

describe("Resultados de la búsqueda por nombre: tarjetas en escritorio, filas en celular", () => {
  it("la lista es una grilla de 3 columnas (4 desde 2xl) en escritorio y una columna en celular", async () => {
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");

    const lista = await within(bloque()).findByRole("list", { name: "Resultados de la búsqueda" });

    expect(lista).toHaveClass("lg:grid", "lg:grid-cols-3", "2xl:grid-cols-4");
  });

  it("cada resultado es un solo botón (toda la fila o tarjeta), con el nombre completo como nombre accesible", async () => {
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");

    const lista = await within(bloque()).findByRole("list", { name: "Resultados de la búsqueda" });
    const filas = within(lista).getAllByRole("listitem");
    for (const [indice, fila] of filas.entries()) {
      const botones = within(fila).getAllByRole("button");
      expect(botones).toHaveLength(1);
      expect(botones[0]).toHaveAccessibleName(`Revisar ficha de ${RESULTADOS[indice].nombre}`);
      expect(botones[0]).toHaveClass("min-h-11");
    }
  });

  it("el nombre se limita a 2 líneas y la imagen cambia de 72 px (celular) a 120 px (escritorio)", async () => {
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");

    const lista = await within(bloque()).findByRole("list", { name: "Resultados de la búsqueda" });
    const fila = within(lista).getAllByRole("listitem")[0];

    expect(within(fila).getByText(RESULTADOS[0].nombre)).toHaveClass("line-clamp-2");
    const caja = fila.querySelector("[data-miniatura-producto]") as HTMLElement;
    expect(caja).toHaveClass("h-[72px]", "w-[72px]", "lg:h-[120px]", "lg:w-full");
    expect(within(fila).getByRole("img", { name: RESULTADOS[0].nombre })).toHaveClass("object-contain");
  });

  it("el encabezado atribuye resultados e imágenes a Jumbo, con el texto buscado", async () => {
    const user = await abrirBusquedaPorNombre();
    await buscar(user, "queso quilque");

    await within(bloque()).findByRole("list", { name: "Resultados de la búsqueda" });

    const encabezado = within(bloque()).getByText("Resultados e imágenes de Jumbo").parentElement as HTMLElement;
    expect(encabezado).toHaveTextContent("Resultados e imágenes de Jumbo para “queso quilque”");
  });
});
