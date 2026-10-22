/**
 * Crear un ingrediente sin salir del registro de un insumo (T13-09 / HU13), con la API simulada.
 *
 * El botón «Crear ingrediente» abre el diálogo de HU03; al crearlo, el ingrediente queda elegido y
 * el resto del formulario (lo escrito, lo que trajo el código, los alérgenos y la fuente, la fecha
 * y la ficha) sigue intacto.
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
  createIngredient: vi.fn(),
}));

// --- data ---

const CODIGO = "7802910000971";

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

const NUEVO = ingrediente(77, "Leche sin lactosa");

const CATALOGO: AlergenoCatalogo[] = [
  { id: 1, codigo: "lacteos", nombre: "Leche", obligatorio_chile: true },
  { id: 2, codigo: "cacahuetes", nombre: "Maní", obligatorio_chile: true },
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
    sin_reconocer: ["harina"],
  },
  ficha: FICHA,
};

function insumo(overrides: Partial<Insumo> = {}): Insumo {
  return {
    id: 10,
    productor_id: 1,
    ingrediente_id: 1,
    ingrediente: { id: 1, nombre: "Leche" },
    nombre: "Leche Colun 1 L",
    marca_origen: "Colun",
    presentacion: null,
    codigo_barras: null,
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

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([
    ingrediente(1, "Leche"),
    ingrediente(2, "Harina"),
  ]);
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue(CATALOGO);
  vi.mocked(ingredientService.createIngredient).mockResolvedValue(NUEVO);
  vi.mocked(insumoService.listInsumos).mockResolvedValue([]);
  vi.mocked(insumoService.listInsumoAlergenos).mockResolvedValue([]);
  vi.mocked(insumoService.getInsumo).mockResolvedValue(insumo());
  vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(LONCOLECHE);
  vi.mocked(insumoService.createInsumo).mockResolvedValue(insumo({ id: 99 }));
  vi.mocked(insumoService.updateInsumo).mockResolvedValue(insumo());
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

const campo = (nombre: string) => screen.getByLabelText(nombre) as HTMLInputElement;
const botonCrear = () => screen.getByRole("button", { name: "Crear ingrediente" });
const dialogoIngrediente = () => screen.getByRole("dialog", { name: "Nuevo ingrediente" });

async function entregarCodigo(user: Usuario, codigo: string) {
  await user.click(screen.getByRole("button", { name: "Escanear código de barras" }));
  const abierto = await screen.findByRole("dialog", { name: "Escanear código de barras" });
  await user.type(within(abierto).getByLabelText("Número del código de barras"), codigo);
  await user.click(within(abierto).getByRole("button", { name: "Buscar" }));
  await waitFor(() => expect(campo("Nombre")).toHaveValue("LONCO LECHE SIN LACTOSA"));
}

/** Opens the dialog, writes the ingredient and creates it. */
async function crearIngrediente(user: Usuario) {
  await user.click(botonCrear());
  const dialogo = await screen.findByRole("dialog", { name: "Nuevo ingrediente" });
  await user.type(dialogo.querySelector<HTMLElement>('[name="codigo_interno"]')!, "ING-77");
  await user.type(dialogo.querySelector<HTMLElement>('[name="nombre"]')!, "Leche sin lactosa");
  await user.click(within(dialogo).getByRole("button", { name: "Crear ingrediente" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nuevo ingrediente" })).not.toBeInTheDocument());
}

// =============================================================================================

describe("Crear un ingrediente desde «Nuevo insumo»", () => {
  it("el botón reemplaza al enlace a /ingredientes/nuevo", async () => {
    await abrirPagina();

    expect(botonCrear()).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Crear un ingrediente/ })).not.toBeInTheDocument();
  });

  it("a mano: el ingrediente creado queda elegido y lo escrito sigue igual", async () => {
    const user = await abrirPagina();
    await user.type(campo("Nombre"), "Leche Colun 1 L");
    await user.type(campo("Marca u origen"), "Colun");
    await user.type(campo("Presentación"), "1 L");

    await crearIngrediente(user);

    expect(ingredientService.createIngredient).toHaveBeenCalledTimes(1);
    expect(campo("Ingrediente")).toHaveValue("77");
    expect(within(campo("Ingrediente")).getByRole("option", { name: "Leche sin lactosa" })).toBeInTheDocument();
    expect(campo("Nombre")).toHaveValue("Leche Colun 1 L");
    expect(campo("Marca u origen")).toHaveValue("Colun");
    expect(campo("Presentación")).toHaveValue("1 L");
    // Creating the ingredient did not register the supply.
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
  });

  it("producto escaneado cuyo ingrediente no existe: todo sigue intacto y al guardar el POST lleva todo", async () => {
    const user = await abrirPagina();
    await entregarCodigo(user, CODIGO);
    await user.type(campo("Advertencias"), "Revisar envase");

    await crearIngrediente(user);

    expect(campo("Ingrediente")).toHaveValue("77");
    expect(campo("Nombre")).toHaveValue("LONCO LECHE SIN LACTOSA");
    expect(campo("Marca u origen")).toHaveValue("Lonco Leche");
    expect(campo("Presentación")).toHaveValue("1L");
    expect(campo("Código de barras")).toHaveValue(CODIGO);
    expect(campo("Advertencias")).toHaveValue("Revisar envase");
    // The suggested allergens, their origin and the unrecognized terms stay.
    expect(screen.getByRole("button", { name: "Quitar alérgeno Leche" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar alérgeno Maní" })).toBeInTheDocument();
    expect(screen.getByText("harina")).toBeInTheDocument();
    expect(insumoService.createInsumo).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Crear insumo" }));

    await waitFor(() => expect(insumoService.createInsumo).toHaveBeenCalledTimes(1));
    expect(insumoService.createInsumo).toHaveBeenCalledWith({
      ingrediente_id: 77,
      nombre: "LONCO LECHE SIN LACTOSA",
      marca_origen: "Lonco Leche",
      presentacion: "1L",
      codigo_barras: CODIGO,
      ingredientes_declarados: "Leche fluida natural entera, enzima lactasa y vitamina D3.",
      advertencias: "Revisar envase",
      habitual: false,
      fuente: "open_food_facts",
      fecha_recuperacion: "2026-10-19T15:00:00Z",
      ficha: FICHA,
      alergenos: [
        { alergeno_id: 1, tipo: "contiene" },
        { alergeno_id: 2, tipo: "trazas" },
      ],
    });
  });

  it("el foco vuelve al selector de ingrediente al crear", async () => {
    const user = await abrirPagina();

    await crearIngrediente(user);

    expect(campo("Ingrediente")).toHaveFocus();
  });

  it("cancelar no cambia nada: ni el ingrediente, ni lo escrito, y el foco vuelve al selector", async () => {
    const user = await abrirPagina();
    await entregarCodigo(user, CODIGO);
    await user.selectOptions(campo("Ingrediente"), "2");
    await user.click(botonCrear());
    const dialogo = await screen.findByRole("dialog", { name: "Nuevo ingrediente" });
    await user.type(dialogo.querySelector<HTMLElement>('[name="nombre"]')!, "Algo a medio escribir");

    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog", { name: "Nuevo ingrediente" })).not.toBeInTheDocument();
    expect(ingredientService.createIngredient).not.toHaveBeenCalled();
    expect(campo("Ingrediente")).toHaveValue("2");
    expect(campo("Nombre")).toHaveValue("LONCO LECHE SIN LACTOSA");
    expect(screen.getByRole("button", { name: "Quitar alérgeno Leche" })).toBeInTheDocument();
    expect(campo("Ingrediente")).toHaveFocus();
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
  });

  it("al abrir el diálogo de nuevo empieza vacío", async () => {
    const user = await abrirPagina();
    await user.click(botonCrear());
    await user.type(dialogoIngrediente().querySelector<HTMLElement>('[name="nombre"]')!, "Borrador");
    await user.click(within(dialogoIngrediente()).getByRole("button", { name: "Cancelar" }));

    await user.click(botonCrear());

    expect(dialogoIngrediente().querySelector<HTMLElement>('[name="nombre"]')!).toHaveValue("");
  });

  it("el formulario del insumo no se envía al guardar el diálogo del ingrediente", async () => {
    const user = await abrirPagina();
    await user.type(campo("Nombre"), "Leche Colun 1 L");
    await user.type(campo("Marca u origen"), "Colun");

    await crearIngrediente(user);

    expect(insumoService.createInsumo).not.toHaveBeenCalled();
    expect(screen.queryByText("Selecciona el ingrediente que abastece este insumo.")).not.toBeInTheDocument();
  });

  it("sin ingredientes activos, el botón sigue ahí y el creado queda elegido", async () => {
    vi.mocked(ingredientService.listIngredients).mockResolvedValue([]);
    const user = await abrirPagina();
    expect(screen.getByText(/Aún no tienes ingredientes activos\./)).toBeInTheDocument();

    await crearIngrediente(user);

    expect(campo("Ingrediente")).toHaveValue("77");
  });
});

describe("Crear un ingrediente al editar un insumo", () => {
  it("también ofrece el botón y deja elegido el ingrediente creado", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/insumos/10/editar"] });
    expect(await screen.findByRole("heading", { name: "Editar insumo", level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(campo("Ingrediente")).toBeEnabled());
    expect(campo("Nombre")).toHaveValue("Leche Colun 1 L");

    await crearIngrediente(user);

    expect(campo("Ingrediente")).toHaveValue("77");
    expect(campo("Nombre")).toHaveValue("Leche Colun 1 L");
    expect(insumoService.updateInsumo).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(insumoService.updateInsumo).toHaveBeenCalledTimes(1));
    expect(insumoService.updateInsumo).toHaveBeenCalledWith(10, { ingrediente_id: 77 });
  });
});
