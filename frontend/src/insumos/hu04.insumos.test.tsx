import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import InsumoForm from "@/components/insumos/InsumoForm";
import { useInsumoForm } from "@/hooks/useInsumoForm";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as ingredientService from "@/services/ingredientService";
import * as insumoService from "@/services/insumoService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { AlergenoCatalogo, Ingrediente } from "@/types/ingredient";
import {
  EMPTY_INSUMO_FORM_VALUES,
  type AlergenoDeclarado,
  type Insumo,
} from "@/types/insumo";

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
  listInsumoAlergenos: vi.fn(),
  addInsumoAlergeno: vi.fn(),
  updateInsumoAlergenoTipo: vi.fn(),
  deleteInsumoAlergeno: vi.fn(),
}));

vi.mock("@/services/ingredientService", () => ({
  listIngredients: vi.fn(),
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

const EAN_13 = "7802910000971";
const OTRO_EAN_13 = "4006381333931";

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

const LECHE = ingrediente(1, "Leche");
const CHOCOLATE = ingrediente(2, "Chocolate");

const CATALOGO: AlergenoCatalogo[] = [
  { id: 1, codigo: "lacteos", nombre: "Leche", obligatorio_chile: true },
  { id: 2, codigo: "cacahuetes", nombre: "Maní", obligatorio_chile: true },
  { id: 3, codigo: "soja", nombre: "Soya", obligatorio_chile: true },
  { id: 4, codigo: "sesamo", nombre: "Sésamo", obligatorio_chile: false },
];

const DECLARADOS: AlergenoDeclarado[] = [
  { alergeno_id: 1, codigo: "lacteos", nombre: "Leche", obligatorio_chile: true, tipo: "contiene" },
  { alergeno_id: 2, codigo: "cacahuetes", nombre: "Maní", obligatorio_chile: true, tipo: "trazas" },
];

function insumo(overrides: Partial<Insumo> = {}): Insumo {
  return {
    id: 10,
    productor_id: 1,
    ingrediente_id: 1,
    ingrediente: { id: 1, nombre: "Leche" },
    nombre: "Leche Colun Semidescremada 1 L",
    marca_origen: "Colun",
    presentacion: "Caja de 1 L",
    codigo_barras: EAN_13,
    ingredientes_declarados: "Leche semidescremada",
    advertencias: "Puede contener trazas de maní",
    ficha: null,
    fuente: "manual",
    fecha_recuperacion: null,
    habitual: true,
    activo: true,
    created_at: "2026-10-04T12:00:00Z",
    updated_at: "2026-10-04T12:00:00Z",
    alergenos_declarados: DECLARADOS,
    ...overrides,
  };
}

const INS_LECHE = insumo();
const INS_CHOCOLATE = insumo({
  id: 11,
  ingrediente_id: 2,
  ingrediente: { id: 2, nombre: "Chocolate" },
  nombre: "Chocolate Ambrosoli 500 g",
  marca_origen: "Ambrosoli",
  presentacion: null,
  codigo_barras: null,
  habitual: false,
  alergenos_declarados: [],
});
const INS_INACTIVO = insumo({
  id: 12,
  nombre: "Leche vieja",
  marca_origen: "Soprole",
  codigo_barras: OTRO_EAN_13,
  habitual: false,
  activo: false,
  alergenos_declarados: [],
});

const MENSAJE_ACTIVO = "Ya existe un insumo con ese código de barras.";
const MENSAJE_INACTIVO =
  "Ya existe un insumo desactivado con ese código de barras. Puedes reactivarlo.";

function duplicateError(insumoId: number, activo: boolean): ApiError {
  const mensaje = activo ? MENSAJE_ACTIVO : MENSAJE_INACTIVO;
  return new ApiError(mensaje, 409, {}, { mensaje, insumo_id: insumoId, activo });
}

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([LECHE, CHOCOLATE]);
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue(CATALOGO);
  vi.mocked(insumoService.listInsumos).mockImplementation(async (params) =>
    params?.activo === false ? [INS_INACTIVO] : [INS_LECHE, INS_CHOCOLATE],
  );
  vi.mocked(insumoService.getInsumo).mockImplementation(async (id) => {
    const found = [INS_LECHE, INS_CHOCOLATE, INS_INACTIVO].find((item) => item.id === id);
    if (!found) throw new ApiError("Insumo no encontrado", 404);
    return found;
  });
  vi.mocked(insumoService.listInsumoAlergenos).mockResolvedValue(DECLARADOS);
});

function openPage(path: string) {
  return renderWithProviders(<App />, { initialEntries: [path] });
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("option", { name: "Leche" });
  await user.type(screen.getByLabelText("Nombre"), "Leche Colun Entera 1 L");
  await user.type(screen.getByLabelText("Marca u origen"), "Colun");
  await user.selectOptions(screen.getByLabelText("Ingrediente"), "1");
}

// --- menú ---

describe("Menú", () => {
  it("agrega Insumos junto a Ingredientes y lleva al listado", async () => {
    const user = userEvent.setup();
    openPage("/dashboard");

    const nav = await screen.findByRole("navigation", { name: "Secciones" });
    const enlaces = within(nav).getAllByRole("link").map((link) => link.textContent);
    expect(enlaces.indexOf("Insumos")).toBe(enlaces.indexOf("Ingredientes") + 1);
    expect(within(nav).getByRole("link", { name: "Insumos" })).toHaveAttribute("href", "/insumos");

    await user.click(within(nav).getByRole("link", { name: "Insumos" }));

    expect(await screen.findByRole("heading", { name: "Insumos", level: 1 })).toBeInTheDocument();
    // Each page renders its own shell: query the menu again after navigating.
    const navActual = screen.getByRole("navigation", { name: "Secciones" });
    expect(within(navActual).getByRole("link", { name: "Insumos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

// --- listado ---

describe("Listado de insumos", () => {
  it("muestra nombre, marca u origen, ingrediente, código de barras y la marca Habitual", async () => {
    openPage("/insumos");

    const tabla = await screen.findByRole("table");
    const filaLeche = within(tabla).getByRole("row", { name: /Leche Colun Semidescremada 1 L/ });
    expect(within(filaLeche).getByText("Colun")).toBeInTheDocument();
    expect(within(filaLeche).getByText("Leche")).toBeInTheDocument();
    expect(within(filaLeche).getByText(EAN_13)).toBeInTheDocument();
    expect(within(filaLeche).getByText("Habitual")).toBeInTheDocument();

    const filaChocolate = within(tabla).getByRole("row", { name: /Chocolate Ambrosoli 500 g/ });
    expect(within(filaChocolate).getByText("Ambrosoli")).toBeInTheDocument();
    expect(within(filaChocolate).queryByText("Habitual")).not.toBeInTheDocument();
    expect(screen.getByText("2 insumos registrados")).toBeInTheDocument();
  });

  it("ofrece tabla en escritorio y tarjetas en celular, con enlaces reales al detalle", async () => {
    openPage("/insumos");

    const enlaces = await screen.findAllByRole("link", {
      name: "Ver insumo Leche Colun Semidescremada 1 L",
    });
    expect(enlaces).toHaveLength(2);
    for (const enlace of enlaces) expect(enlace).toHaveAttribute("href", "/insumos/10");
    expect(screen.getByRole("table").closest("div")?.parentElement).toHaveClass("md:block");
  });

  it("abre el detalle al elegir un insumo", async () => {
    const user = userEvent.setup();
    openPage("/insumos");

    const [enlace] = await screen.findAllByRole("link", {
      name: "Ver insumo Chocolate Ambrosoli 500 g",
    });
    await user.click(enlace);

    expect(
      await screen.findByRole("heading", { name: "Chocolate Ambrosoli 500 g", level: 1 }),
    ).toBeInTheDocument();
  });

  it("muestra el estado de carga", async () => {
    let resolver!: (insumos: Insumo[]) => void;
    vi.mocked(insumoService.listInsumos).mockReturnValueOnce(
      new Promise<Insumo[]>((resolve) => {
        resolver = resolve;
      }),
    );
    openPage("/insumos");

    expect(await screen.findByText("Cargando insumos...")).toBeInTheDocument();

    act(() => resolver([INS_LECHE]));
    expect((await screen.findAllByText("Leche Colun Semidescremada 1 L")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Cargando insumos...")).not.toBeInTheDocument();
  });

  it("muestra el error y permite reintentar", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.listInsumos).mockRejectedValueOnce(new Error("fallo"));
    openPage("/insumos");

    expect(
      await screen.findByRole("heading", { name: "No pudimos cargar tus insumos." }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect((await screen.findAllByText("Chocolate Ambrosoli 500 g")).length).toBeGreaterThan(0);
  });

  it("sin insumos, explica qué hacer y lleva al formulario", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.listInsumos).mockResolvedValue([]);
    openPage("/insumos");

    expect(await screen.findByRole("heading", { name: "Aún no tienes insumos" })).toBeInTheDocument();
    expect(screen.getByText("Declara sus alérgenos desde el detalle.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Registrar primer insumo" }));

    expect(await screen.findByRole("heading", { name: "Nuevo insumo", level: 1 })).toBeInTheDocument();
  });

  it("el botón + Nuevo insumo abre el formulario", async () => {
    const user = userEvent.setup();
    openPage("/insumos");

    await user.click(await screen.findByRole("button", { name: "+ Nuevo insumo" }));

    expect(await screen.findByRole("heading", { name: "Nuevo insumo", level: 1 })).toBeInTheDocument();
  });
});

describe("Filtros del listado", () => {
  it("filtra por ingrediente y lo muestra como chip que se puede quitar", async () => {
    const user = userEvent.setup();
    openPage("/insumos");
    await screen.findByRole("table");

    await user.selectOptions(screen.getByLabelText("Filtrar por ingrediente"), "2");

    expect(screen.queryAllByRole("link", { name: /Ver insumo Leche Colun/ })).toHaveLength(0);
    expect(screen.getAllByRole("link", { name: /Ver insumo Chocolate Ambrosoli/ }).length).toBeGreaterThan(0);
    const chips = screen.getByRole("group", { name: "Filtros activos" });
    expect(within(chips).getByText("Ingrediente: Chocolate")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar filtro: Ingrediente: Chocolate" }));

    expect(screen.getAllByRole("link", { name: /Ver insumo Leche Colun/ }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Filtrar por ingrediente")).toHaveValue("all");
  });

  it("muestra solo activos por defecto y pide al servidor los inactivos al cambiar el estado", async () => {
    const user = userEvent.setup();
    openPage("/insumos");
    await screen.findByRole("table");
    expect(insumoService.listInsumos).toHaveBeenLastCalledWith({ activo: true });
    expect(screen.getByLabelText("Filtrar por estado")).toHaveValue("activos");

    await user.selectOptions(screen.getByLabelText("Filtrar por estado"), "inactivos");

    await waitFor(() =>
      expect(insumoService.listInsumos).toHaveBeenLastCalledWith({ activo: false }),
    );
    expect((await screen.findAllByText("Leche vieja")).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Chocolate Ambrosoli 500 g")).toHaveLength(0);
    expect(screen.getAllByText("Inactivo").length).toBeGreaterThan(0);
    expect(screen.getByText("1 insumo inactivo registrado")).toBeInTheDocument();
    const chips = screen.getByRole("group", { name: "Filtros activos" });
    expect(within(chips).getByText("Estado: Inactivos")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar filtro: Estado: Inactivos" }));

    await waitFor(() => expect(insumoService.listInsumos).toHaveBeenLastCalledWith({ activo: true }));
    expect((await screen.findAllByText("Chocolate Ambrosoli 500 g")).length).toBeGreaterThan(0);
  });

  it("sin insumos inactivos lo explica", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.listInsumos).mockImplementation(async (params) =>
      params?.activo === false ? [] : [INS_LECHE],
    );
    openPage("/insumos");
    await screen.findByRole("table");

    await user.selectOptions(screen.getByLabelText("Filtrar por estado"), "inactivos");

    expect(await screen.findByRole("heading", { name: "No tienes insumos inactivos" })).toBeInTheDocument();
  });

  it("busca por nombre, marca u origen o código de barras y permite limpiar", async () => {
    const user = userEvent.setup();
    openPage("/insumos");
    await screen.findByRole("table");

    await user.type(screen.getByLabelText("Buscar insumos"), "ambro");
    expect(screen.queryAllByRole("link", { name: /Ver insumo Leche Colun/ })).toHaveLength(0);

    await user.clear(screen.getByLabelText("Buscar insumos"));
    await user.type(screen.getByLabelText("Buscar insumos"), "78029");
    expect(screen.queryAllByRole("link", { name: /Ver insumo Chocolate/ })).toHaveLength(0);
    expect(screen.getAllByRole("link", { name: /Ver insumo Leche Colun/ }).length).toBeGreaterThan(0);

    await user.clear(screen.getByLabelText("Buscar insumos"));
    await user.type(screen.getByLabelText("Buscar insumos"), "zzz");
    expect(await screen.findByRole("heading", { name: "No encontramos insumos" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getAllByRole("link", { name: /Ver insumo Chocolate/ }).length).toBeGreaterThan(0);
  });
});

// --- formulario ---

describe("Formulario de insumo", () => {
  it("muestra todos los campos, el selector de ingredientes activos y los textos de ayuda", async () => {
    openPage("/insumos/nuevo");

    expect(await screen.findByRole("heading", { name: "Nuevo insumo", level: 1 })).toBeInTheDocument();
    await screen.findByRole("option", { name: "Leche" });
    for (const label of [
      "Nombre",
      "Marca u origen",
      "Ingrediente",
      "Presentación",
      "Código de barras",
      "Ingredientes declarados",
      "Advertencias",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("checkbox", { name: "Insumo habitual" })).not.toBeChecked();
    expect(screen.getByText("Por ejemplo, la marca del producto o 'Feria local'.")).toBeInTheDocument();
    expect(screen.getByText("Se preselecciona al registrar una elaboración.")).toBeInTheDocument();
    expect(screen.getByLabelText("Marca u origen")).toHaveAccessibleDescription(
      "Por ejemplo, la marca del producto o 'Feria local'.",
    );
    expect(screen.getByRole("checkbox", { name: "Insumo habitual" })).toHaveAccessibleDescription(
      "Se preselecciona al registrar una elaboración.",
    );
    const opciones = within(screen.getByLabelText("Ingrediente"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(opciones).toEqual(["Selecciona un ingrediente", "Chocolate", "Leche"]);
  });

  it("valida los campos obligatorios y no envía", async () => {
    const user = userEvent.setup();
    openPage("/insumos/nuevo");
    await screen.findByRole("option", { name: "Leche" });

    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    expect(await screen.findByText("El nombre es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("La marca u origen es obligatoria.")).toBeInTheDocument();
    expect(screen.getByText("Selecciona el ingrediente que abastece este insumo.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveFocus();
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
  });

  it("informa el dígito verificador inválido en el campo y no envía", async () => {
    const user = userEvent.setup();
    openPage("/insumos/nuevo");
    await fillValidForm(user);

    await user.type(screen.getByLabelText("Código de barras"), "7802910000972");
    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    expect(
      await screen.findByText("El dígito verificador del código de barras no es válido."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Código de barras")).toHaveFocus();
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
  });

  it("crea el insumo con la carga normalizada y avisa con un enlace para declarar alérgenos", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.createInsumo).mockResolvedValue(insumo({ id: 20 }));
    openPage("/insumos/nuevo");
    await fillValidForm(user);
    await user.type(screen.getByLabelText("Código de barras"), " 780 291 0000971 ");
    await user.type(screen.getByLabelText("Advertencias"), "Contiene leche");
    await user.click(screen.getByRole("checkbox", { name: "Insumo habitual" }));

    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    await waitFor(() =>
      expect(insumoService.createInsumo).toHaveBeenCalledWith({
        ingrediente_id: 1,
        nombre: "Leche Colun Entera 1 L",
        marca_origen: "Colun",
        presentacion: null,
        codigo_barras: EAN_13,
        ingredientes_declarados: null,
        advertencias: "Contiene leche",
        habitual: true,
      }),
    );
    expect(await screen.findByRole("heading", { name: "Insumos", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText("Insumo creado correctamente.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Declarar alérgenos" })).toHaveAttribute("href", "/insumos/20");
  });

  it("muestra el error del backend en el campo que corresponde", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.createInsumo).mockRejectedValueOnce(
      new ApiError("Revisa los datos enviados.", 422, {
        marca_origen: "Revisa la marca u origen.",
      }),
    );
    openPage("/insumos/nuevo");
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    expect(await screen.findByText("Revisa la marca u origen.")).toBeInTheDocument();
    expect(screen.getByLabelText("Marca u origen")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Marca u origen")).toHaveFocus();
  });

  it("muestra «Ingrediente no válido» en el selector de ingrediente", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.createInsumo).mockRejectedValueOnce(
      new ApiError("Ingrediente no válido", 422),
    );
    openPage("/insumos/nuevo");
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    expect(await screen.findByText("Ingrediente no válido")).toBeInTheDocument();
    expect(screen.getByLabelText("Ingrediente")).toHaveAttribute("aria-invalid", "true");
  });

  it("un error inesperado muestra un mensaje general", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.createInsumo).mockRejectedValueOnce(new Error("caído"));
    openPage("/insumos/nuevo");
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    expect(
      await screen.findByText("No pudimos guardar el insumo. Inténtalo nuevamente."),
    ).toBeInTheDocument();
  });

  it("sin ingredientes activos ofrece crear uno", async () => {
    vi.mocked(ingredientService.listIngredients).mockResolvedValue([]);
    openPage("/insumos/nuevo");

    expect(await screen.findByText(/Aún no tienes ingredientes activos\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crear un ingrediente" })).toHaveAttribute(
      "href",
      "/ingredientes/nuevo",
    );
  });

  it("si falla la carga de ingredientes permite reintentar", async () => {
    const user = userEvent.setup();
    vi.mocked(ingredientService.listIngredients).mockRejectedValueOnce(new Error("fallo"));
    openPage("/insumos/nuevo");

    expect(await screen.findByText("No pudimos cargar tus ingredientes.")).toBeInTheDocument();
    expect(screen.getByLabelText("Ingrediente")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("option", { name: "Leche" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ingrediente")).toBeEnabled();
  });

  it("avisa antes de salir con cambios sin guardar", async () => {
    const user = userEvent.setup();
    openPage("/insumos/nuevo");
    await screen.findByRole("option", { name: "Leche" });
    await user.type(screen.getByLabelText("Nombre"), "Algo");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Tienes cambios sin guardar");
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(await screen.findByRole("button", { name: "Salir sin guardar" }));
    expect(await screen.findByRole("heading", { name: "Insumos", level: 1 })).toBeInTheDocument();
  });
});

describe("Código de barras repetido (409)", () => {
  async function submitWithDuplicate(user: ReturnType<typeof userEvent.setup>, error: ApiError) {
    vi.mocked(insumoService.createInsumo).mockRejectedValueOnce(error);
    openPage("/insumos/nuevo");
    await fillValidForm(user);
    await user.type(screen.getByLabelText("Código de barras"), EAN_13);
    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));
  }

  it("si el existente está activo muestra el mensaje con un enlace a ese insumo", async () => {
    const user = userEvent.setup();
    await submitWithDuplicate(user, duplicateError(10, true));

    expect(await screen.findByText(MENSAJE_ACTIVO)).toBeInTheDocument();
    expect(screen.getByLabelText("Código de barras")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("link", { name: "Ver insumo existente" })).toHaveAttribute("href", "/insumos/10");
    expect(screen.queryByRole("button", { name: "Reactivar" })).not.toBeInTheDocument();
  });

  it("si el existente está inactivo muestra el mensaje con un botón Reactivar", async () => {
    const user = userEvent.setup();
    await submitWithDuplicate(user, duplicateError(12, false));

    expect(await screen.findByText(MENSAJE_INACTIVO)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivar" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver insumo existente" })).not.toBeInTheDocument();
  });

  it("Reactivar reactiva el insumo existente y lleva a su detalle", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.reactivateInsumo).mockResolvedValue({ ...INS_INACTIVO, activo: true });
    vi.mocked(insumoService.getInsumo).mockResolvedValue({ ...INS_INACTIVO, activo: true });
    await submitWithDuplicate(user, duplicateError(12, false));

    await user.click(await screen.findByRole("button", { name: "Reactivar" }));

    expect(insumoService.reactivateInsumo).toHaveBeenCalledWith(12);
    expect(await screen.findByRole("heading", { name: "Leche vieja", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText("Insumo reactivado correctamente.")).toBeInTheDocument();
    expect(insumoService.createInsumo).toHaveBeenCalledTimes(1);
  });

  it("si Reactivar falla lo informa y se queda en el formulario", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.reactivateInsumo).mockRejectedValueOnce(new Error("fallo"));
    await submitWithDuplicate(user, duplicateError(12, false));

    await user.click(await screen.findByRole("button", { name: "Reactivar" }));

    expect(
      await screen.findByText("No pudimos reactivar el insumo. Inténtalo nuevamente."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nuevo insumo", level: 1 })).toBeInTheDocument();
  });

  it("al cambiar el código de barras desaparece el aviso del duplicado", async () => {
    const user = userEvent.setup();
    await submitWithDuplicate(user, duplicateError(10, true));
    await screen.findByRole("link", { name: "Ver insumo existente" });

    await user.type(screen.getByLabelText("Código de barras"), "0");

    expect(screen.queryByRole("link", { name: "Ver insumo existente" })).not.toBeInTheDocument();
    expect(screen.queryByText(MENSAJE_ACTIVO)).not.toBeInTheDocument();
  });

  it("un 409 de otro tipo se muestra como mensaje general", async () => {
    const user = userEvent.setup();
    await submitWithDuplicate(
      user,
      new ApiError("No se pudo guardar el insumo por un cambio simultáneo. Inténtalo nuevamente.", 409),
    );

    expect(await screen.findByText(/cambio simultáneo/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reactivar" })).not.toBeInTheDocument();
  });
});

// --- edición ---

describe("Edición de insumo", () => {
  it("carga los valores guardados y envía solo lo que cambió", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.updateInsumo).mockResolvedValue({ ...INS_LECHE, nombre: "Leche Colun Entera 1 L" });
    openPage("/insumos/10/editar");

    expect(await screen.findByRole("heading", { name: "Editar insumo", level: 1 })).toBeInTheDocument();
    await screen.findByRole("option", { name: "Chocolate" });
    expect(screen.getByLabelText("Nombre")).toHaveValue("Leche Colun Semidescremada 1 L");
    expect(screen.getByLabelText("Marca u origen")).toHaveValue("Colun");
    expect(screen.getByLabelText("Ingrediente")).toHaveValue("1");
    expect(screen.getByLabelText("Código de barras")).toHaveValue(EAN_13);
    expect(screen.getByRole("checkbox", { name: "Insumo habitual" })).toBeChecked();

    await user.clear(screen.getByLabelText("Nombre"));
    await user.type(screen.getByLabelText("Nombre"), "Leche Colun Entera 1 L");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(insumoService.updateInsumo).toHaveBeenCalledWith(10, { nombre: "Leche Colun Entera 1 L" }),
    );
    expect(await screen.findByText("Insumo actualizado correctamente.")).toBeInTheDocument();
  });

  it("sin cambios no envía nada y vuelve al detalle", async () => {
    const user = userEvent.setup();
    openPage("/insumos/10/editar");
    await screen.findByRole("option", { name: "Chocolate" });

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("heading", { name: INS_LECHE.nombre, level: 1 })).toBeInTheDocument();
    expect(insumoService.updateInsumo).not.toHaveBeenCalled();
  });

  it("conserva como opción el ingrediente actual aunque ya no esté activo", async () => {
    vi.mocked(insumoService.getInsumo).mockResolvedValue(
      insumo({ ingrediente_id: 9, ingrediente: { id: 9, nombre: "Azúcar" } }),
    );
    openPage("/insumos/10/editar");

    expect(await screen.findByRole("option", { name: "Azúcar (desactivado)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ingrediente")).toHaveValue("9");
  });

  it("un código repetido de un insumo inactivo permite reactivarlo desde la edición", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.updateInsumo).mockRejectedValueOnce(duplicateError(12, false));
    vi.mocked(insumoService.reactivateInsumo).mockResolvedValue({ ...INS_INACTIVO, activo: true });
    openPage("/insumos/10/editar");
    await screen.findByRole("option", { name: "Chocolate" });

    await user.clear(screen.getByLabelText("Código de barras"));
    await user.type(screen.getByLabelText("Código de barras"), OTRO_EAN_13);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await user.click(await screen.findByRole("button", { name: "Reactivar" }));

    expect(insumoService.reactivateInsumo).toHaveBeenCalledWith(12);
    expect(await screen.findByRole("heading", { name: "Leche vieja", level: 1 })).toBeInTheDocument();
  });

  it("un insumo inexistente muestra el aviso de no disponible", async () => {
    openPage("/insumos/999/editar");

    expect(await screen.findByRole("heading", { name: "Insumo no disponible." })).toBeInTheDocument();
  });
});

// --- detalle ---

describe("Detalle de insumo", () => {
  it("muestra la información, el estado y la fuente", async () => {
    vi.mocked(insumoService.getInsumo).mockResolvedValue(
      insumo({ fuente: "open_food_facts", fecha_recuperacion: "2026-10-04T18:30:00Z" }),
    );
    openPage("/insumos/10");

    expect(await screen.findByRole("heading", { name: INS_LECHE.nombre, level: 1 })).toBeInTheDocument();
    const general = screen.getByRole("region", { name: "Información general" });
    expect(within(general).getByText("Colun")).toBeInTheDocument();
    expect(within(general).getByRole("link", { name: "Leche" })).toHaveAttribute("href", "/ingredientes/1");
    expect(within(general).getByText("Caja de 1 L")).toBeInTheDocument();
    expect(within(general).getByText(EAN_13)).toBeInTheDocument();
    const declarado = screen.getByRole("region", { name: "Información declarada" });
    expect(within(declarado).getByText("Leche semidescremada")).toBeInTheDocument();
    expect(within(declarado).getByText("Puede contener trazas de maní")).toBeInTheDocument();
    const origen = screen.getByRole("region", { name: "Estado y fuente" });
    expect(within(origen).getByText("Activo")).toBeInTheDocument();
    expect(within(origen).getByText("Open Food Facts")).toBeInTheDocument();
    expect(within(origen).getByText(/15:30/)).toBeInTheDocument();
  });

  it("de un insumo manual no muestra fecha de recuperación", async () => {
    openPage("/insumos/10");

    const origen = await screen.findByRole("region", { name: "Estado y fuente" });
    expect(within(origen).getByText("Registro manual")).toBeInTheDocument();
    expect(within(origen).queryByText("Recuperado el")).not.toBeInTheDocument();
  });

  it("el botón Editar insumo abre el formulario de edición", async () => {
    const user = userEvent.setup();
    openPage("/insumos/10");

    await user.click(await screen.findByRole("button", { name: "Editar insumo" }));

    expect(await screen.findByRole("heading", { name: "Editar insumo", level: 1 })).toBeInTheDocument();
  });

  it("desactivar pide confirmación y deja el insumo inactivo con opción de reactivar", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.deactivateInsumo).mockResolvedValue(undefined);
    vi.mocked(insumoService.getInsumo)
      .mockResolvedValueOnce(INS_LECHE)
      .mockResolvedValueOnce({ ...INS_LECHE, activo: false, habitual: false });
    openPage("/insumos/10");
    await screen.findByRole("heading", { name: INS_LECHE.nombre, level: 1 });

    await user.click(screen.getByRole("button", { name: "Desactivar insumo" }));

    const dialogo = await screen.findByRole("alertdialog");
    expect(dialogo).toHaveTextContent("No se ofrecerá en nuevas elaboraciones");
    expect(insumoService.deactivateInsumo).not.toHaveBeenCalled();

    await user.click(within(dialogo).getByRole("button", { name: "Desactivar insumo" }));

    await waitFor(() => expect(insumoService.deactivateInsumo).toHaveBeenCalledWith(10));
    expect(await screen.findByText("Insumo desactivado correctamente.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Reactivar insumo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar insumo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desactivar insumo" })).not.toBeInTheDocument();
    expect(screen.getByText(/Este insumo está desactivado y no se ofrecerá/)).toBeInTheDocument();
    expect(screen.queryByText("Habitual")).not.toBeInTheDocument();
  });

  it("cancelar la desactivación no hace nada", async () => {
    const user = userEvent.setup();
    openPage("/insumos/10");
    await screen.findByRole("heading", { name: INS_LECHE.nombre, level: 1 });

    await user.click(screen.getByRole("button", { name: "Desactivar insumo" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(insumoService.deactivateInsumo).not.toHaveBeenCalled();
  });

  it("si desactivar falla lo informa y el insumo sigue activo", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.deactivateInsumo).mockRejectedValueOnce(new Error("fallo"));
    openPage("/insumos/10");
    await screen.findByRole("heading", { name: INS_LECHE.nombre, level: 1 });

    await user.click(screen.getByRole("button", { name: "Desactivar insumo" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Desactivar insumo" }));

    expect(
      await screen.findByText("No pudimos desactivar el insumo. Inténtalo nuevamente."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar insumo" })).toBeInTheDocument();
  });

  it("un insumo inactivo se puede reactivar", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.reactivateInsumo).mockResolvedValue({ ...INS_INACTIVO, activo: true });
    openPage("/insumos/12");

    const boton = await screen.findByRole("button", { name: "Reactivar insumo" });
    const estado = screen.getByRole("region", { name: "Estado y fuente" });
    expect(within(estado).getByText("Inactivo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desactivar insumo" })).not.toBeInTheDocument();

    await user.click(boton);

    await waitFor(() => expect(insumoService.reactivateInsumo).toHaveBeenCalledWith(12));
    expect(await screen.findByText("Insumo reactivado correctamente.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Editar insumo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desactivar insumo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reactivar insumo" })).not.toBeInTheDocument();
  });

  it("si reactivar falla lo informa", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.reactivateInsumo).mockRejectedValueOnce(new Error("fallo"));
    openPage("/insumos/12");

    await user.click(await screen.findByRole("button", { name: "Reactivar insumo" }));

    expect(
      await screen.findByText("No pudimos reactivar el insumo. Inténtalo nuevamente."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivar insumo" })).toBeInTheDocument();
  });

  it("un insumo inexistente o ajeno muestra el aviso de no disponible", async () => {
    openPage("/insumos/999");

    expect(await screen.findByRole("heading", { name: "Insumo no disponible." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a insumos" })).toBeInTheDocument();
  });
});

// --- alérgenos del insumo ---

describe("Alérgenos declarados del insumo", () => {
  async function openDetail() {
    openPage("/insumos/10");
    await screen.findByRole("region", { name: "Contiene" });
  }

  it("muestra el texto de ayuda y los alérgenos en dos grupos, con la etiqueta de rotulación obligatoria", async () => {
    await openDetail();

    expect(
      screen.getByText(
        "Estos son los alérgenos declarados en el envase del insumo. Se conservan en cada elaboración que lo utilice y son los que verá el consumidor.",
      ),
    ).toBeInTheDocument();
    const contiene = screen.getByRole("region", { name: "Contiene" });
    const trazas = screen.getByRole("region", { name: "Puede contener" });
    expect(within(contiene).getByText("Leche")).toBeInTheDocument();
    expect(within(contiene).queryByText("Maní")).not.toBeInTheDocument();
    expect(within(trazas).getByText("Maní")).toBeInTheDocument();
    expect(within(contiene).getByText("Rotulación obligatoria")).toBeInTheDocument();
    expect(within(trazas).getByText("Rotulación obligatoria")).toBeInTheDocument();
    expect(within(contiene).getByText("Rotulación obligatoria")).toHaveAttribute(
      "title",
      expect.stringContaining("Resolución Exenta N.º 427"),
    );
  });

  it("no marca como obligatorios los que no lo son y explica los grupos vacíos", async () => {
    vi.mocked(insumoService.listInsumoAlergenos).mockResolvedValue([
      { alergeno_id: 4, codigo: "sesamo", nombre: "Sésamo", obligatorio_chile: false, tipo: "trazas" },
    ]);
    await openDetail();

    const trazas = screen.getByRole("region", { name: "Puede contener" });
    expect(within(trazas).getByText("Sésamo")).toBeInTheDocument();
    expect(within(trazas).queryByText("Rotulación obligatoria")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Contiene" })).getByText(
        "No hay alérgenos declarados como «Contiene».",
      ),
    ).toBeInTheDocument();
  });

  it("agrega un alérgeno del catálogo agrupado en obligatorios y otros, eligiendo el tipo", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.addInsumoAlergeno).mockResolvedValue({
      alergeno_id: 4, codigo: "sesamo", nombre: "Sésamo", obligatorio_chile: false, tipo: "trazas",
    });
    await openDetail();

    await user.click(screen.getByRole("button", { name: "+ Agregar alérgeno" }));

    const selector = await screen.findByLabelText("Alérgeno del catálogo");
    const grupos = Array.from(selector.querySelectorAll("optgroup")).map((group) => ({
      etiqueta: group.label,
      opciones: Array.from(group.querySelectorAll("option")).map((option) => option.textContent),
    }));
    // The ones already declared (Leche, Maní) are not offered again.
    expect(grupos).toEqual([
      { etiqueta: "Declaración obligatoria", opciones: ["Soya"] },
      { etiqueta: "Otros alérgenos", opciones: ["Sésamo"] },
    ]);
    const tipos = within(screen.getByLabelText("Tipo de declaración"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(tipos).toEqual(["Contiene", "Puede contener (trazas)"]);

    vi.mocked(insumoService.listInsumoAlergenos).mockResolvedValueOnce([
      ...DECLARADOS,
      { alergeno_id: 4, codigo: "sesamo", nombre: "Sésamo", obligatorio_chile: false, tipo: "trazas" },
    ]);
    await user.selectOptions(selector, "4");
    await user.selectOptions(screen.getByLabelText("Tipo de declaración"), "trazas");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => expect(insumoService.addInsumoAlergeno).toHaveBeenCalledWith(10, 4, "trazas"));
    expect(
      await within(screen.getByRole("region", { name: "Puede contener" })).findByText("Sésamo"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Alérgeno del catálogo")).not.toBeInTheDocument();
  });

  it("por defecto declara el alérgeno como «Contiene»", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.addInsumoAlergeno).mockResolvedValue({
      alergeno_id: 3, codigo: "soja", nombre: "Soya", obligatorio_chile: true, tipo: "contiene",
    });
    await openDetail();

    await user.click(screen.getByRole("button", { name: "+ Agregar alérgeno" }));
    await user.selectOptions(await screen.findByLabelText("Alérgeno del catálogo"), "3");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => expect(insumoService.addInsumoAlergeno).toHaveBeenCalledWith(10, 3, "contiene"));
  });

  it("pide elegir un alérgeno antes de agregar", async () => {
    const user = userEvent.setup();
    await openDetail();

    await user.click(screen.getByRole("button", { name: "+ Agregar alérgeno" }));
    await user.click(await screen.findByRole("button", { name: "Agregar" }));

    expect(await screen.findByText("Selecciona un alérgeno del catálogo.")).toBeInTheDocument();
    expect(insumoService.addInsumoAlergeno).not.toHaveBeenCalled();
  });

  it("muestra el mensaje del backend si no se pudo agregar", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.addInsumoAlergeno).mockRejectedValueOnce(
      new ApiError("El alérgeno ya está asociado al insumo.", 422),
    );
    await openDetail();

    await user.click(screen.getByRole("button", { name: "+ Agregar alérgeno" }));
    await user.selectOptions(await screen.findByLabelText("Alérgeno del catálogo"), "3");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(await screen.findByText("El alérgeno ya está asociado al insumo.")).toBeInTheDocument();
  });

  it("cambia el tipo de un alérgeno ya declarado", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.updateInsumoAlergenoTipo).mockResolvedValue({ ...DECLARADOS[0], tipo: "trazas" });
    await openDetail();

    vi.mocked(insumoService.listInsumoAlergenos).mockResolvedValueOnce([
      { ...DECLARADOS[0], tipo: "trazas" },
      DECLARADOS[1],
    ]);
    await user.click(screen.getByRole("button", { name: "Cambiar Leche a Puede contener" }));

    await waitFor(() => expect(insumoService.updateInsumoAlergenoTipo).toHaveBeenCalledWith(10, 1, "trazas"));
    const trazas = screen.getByRole("region", { name: "Puede contener" });
    expect(await within(trazas).findByText("Leche")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Contiene" })).queryByText("Leche"),
    ).not.toBeInTheDocument();
  });

  it("de «Puede contener» pasa a «Contiene»", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.updateInsumoAlergenoTipo).mockResolvedValue({ ...DECLARADOS[1], tipo: "contiene" });
    await openDetail();

    await user.click(screen.getByRole("button", { name: "Cambiar Maní a Contiene" }));

    await waitFor(() => expect(insumoService.updateInsumoAlergenoTipo).toHaveBeenCalledWith(10, 2, "contiene"));
  });

  it("quita un alérgeno tras confirmar", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.deleteInsumoAlergeno).mockResolvedValue(undefined);
    await openDetail();

    await user.click(screen.getByRole("button", { name: "Quitar alérgeno Maní" }));
    const dialogo = await screen.findByRole("alertdialog");
    expect(dialogo).toHaveTextContent("Maní");
    expect(insumoService.deleteInsumoAlergeno).not.toHaveBeenCalled();

    vi.mocked(insumoService.listInsumoAlergenos).mockResolvedValueOnce([DECLARADOS[0]]);
    await user.click(within(dialogo).getByRole("button", { name: "Quitar alérgeno" }));

    await waitFor(() => expect(insumoService.deleteInsumoAlergeno).toHaveBeenCalledWith(10, 2));
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Puede contener" })).queryByText("Maní"),
      ).not.toBeInTheDocument(),
    );
  });

  it("cancelar el quitado no elimina nada", async () => {
    const user = userEvent.setup();
    await openDetail();

    await user.click(screen.getByRole("button", { name: "Quitar alérgeno Leche" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));

    expect(insumoService.deleteInsumoAlergeno).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("region", { name: "Contiene" })).getByText("Leche"),
    ).toBeInTheDocument();
  });

  it("muestra el error si falla la carga y permite reintentar", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.listInsumoAlergenos).mockRejectedValueOnce(new Error("fallo"));
    openPage("/insumos/10");

    expect(await screen.findByText("No pudimos cargar los alérgenos.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("region", { name: "Contiene" })).toBeInTheDocument();
  });

  it("si falla el catálogo no ofrece agregar y permite reintentar", async () => {
    const user = userEvent.setup();
    vi.mocked(ingredientService.listAlergenosCatalog).mockRejectedValueOnce(new Error("fallo"));
    openPage("/insumos/10");

    expect(await screen.findByText("No pudimos cargar el catálogo de alérgenos.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Agregar alérgeno" })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Reintentar" })[0]);

    expect(await screen.findByRole("button", { name: "+ Agregar alérgeno" })).toBeInTheDocument();
  });

  it("los alérgenos de un insumo inactivo se pueden gestionar", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.updateInsumoAlergenoTipo).mockResolvedValue({ ...DECLARADOS[0], tipo: "trazas" });
    vi.mocked(insumoService.listInsumoAlergenos).mockResolvedValue(DECLARADOS);
    openPage("/insumos/12");
    await screen.findByRole("region", { name: "Contiene" });

    await user.click(screen.getByRole("button", { name: "Cambiar Leche a Puede contener" }));

    await waitFor(() => expect(insumoService.updateInsumoAlergenoTipo).toHaveBeenCalledWith(12, 1, "trazas"));
    expect(screen.getByRole("button", { name: "+ Agregar alérgeno" })).toBeEnabled();
  });
});

// --- casos del plan de pruebas que faltaban en la interfaz (T04-06) ---

describe("Plan de pruebas HU04: casos de la interfaz", () => {
  it("PT04-03: registra un insumo con origen en vez de marca, por ejemplo «Feria local», sin código de barras", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.createInsumo).mockResolvedValue(
      insumo({ id: 21, nombre: "Huevos de campo", marca_origen: "Feria local", codigo_barras: null }),
    );
    openPage("/insumos/nuevo");
    await screen.findByRole("option", { name: "Leche" });

    await user.type(screen.getByLabelText("Nombre"), "Huevos de campo");
    await user.type(screen.getByLabelText("Marca u origen"), "Feria local");
    await user.selectOptions(screen.getByLabelText("Ingrediente"), "1");
    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    await waitFor(() =>
      expect(insumoService.createInsumo).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: "Huevos de campo",
          marca_origen: "Feria local",
          codigo_barras: null,
        }),
      ),
    );
    expect(await screen.findByText("Insumo creado correctamente.")).toBeInTheDocument();
  });

  it("PT04-07: varios insumos de un mismo ingrediente se listan y el filtro por ingrediente los muestra todos", async () => {
    const user = userEvent.setup();
    const otraLeche = insumo({
      id: 13,
      nombre: "Leche Soprole Entera 1 L",
      marca_origen: "Soprole",
      codigo_barras: null,
      habitual: false,
      alergenos_declarados: [],
    });
    vi.mocked(insumoService.listInsumos).mockResolvedValue([INS_LECHE, otraLeche, INS_CHOCOLATE]);
    openPage("/insumos");
    await screen.findByRole("table");

    await user.selectOptions(screen.getByLabelText("Filtrar por ingrediente"), "1");

    expect(screen.getAllByRole("link", { name: "Ver insumo Leche Colun Semidescremada 1 L" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Ver insumo Leche Soprole Entera 1 L" }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("link", { name: /Ver insumo Chocolate/ })).toHaveLength(0);
    // The ingredient appears once in the filter, not once per supply.
    const opciones = within(screen.getByLabelText("Filtrar por ingrediente")).getAllByRole("option");
    expect(opciones.map((option) => option.textContent)).toEqual(["Todos", "Chocolate", "Leche"]);
  });

  it("PT04-07: se puede registrar un segundo insumo para un ingrediente que ya tiene uno", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.createInsumo).mockResolvedValue(insumo({ id: 22, habitual: false }));
    openPage("/insumos/nuevo");
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Guardar insumo" }));

    await waitFor(() =>
      expect(insumoService.createInsumo).toHaveBeenCalledWith(
        expect.objectContaining({ ingrediente_id: 1, habitual: false }),
      ),
    );
  });

  it("PT04-08: marcar un insumo como habitual al editarlo envía solo habitual: true", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.updateInsumo).mockResolvedValue({ ...INS_CHOCOLATE, habitual: true });
    openPage("/insumos/11/editar");
    await screen.findByRole("option", { name: "Leche" });
    const casilla = screen.getByRole("checkbox", { name: "Insumo habitual" });
    expect(casilla).not.toBeChecked();

    await user.click(casilla);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(insumoService.updateInsumo).toHaveBeenCalledWith(11, { habitual: true }));
  });

  it("PT04-08: el detalle refleja que otro insumo pasó a ser el habitual", async () => {
    vi.mocked(insumoService.getInsumo).mockResolvedValue({ ...INS_LECHE, habitual: false });
    openPage("/insumos/10");

    await screen.findByRole("heading", { name: INS_LECHE.nombre, level: 1 });

    expect(screen.queryByText("Habitual")).not.toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("PT04-08: al quitar la marca de habitual se envía habitual: false", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.updateInsumo).mockResolvedValue({ ...INS_LECHE, habitual: false });
    openPage("/insumos/10/editar");
    await screen.findByRole("option", { name: "Chocolate" });

    await user.click(screen.getByRole("checkbox", { name: "Insumo habitual" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(insumoService.updateInsumo).toHaveBeenCalledWith(10, { habitual: false }));
  });
});

// jsdom no calcula estilos: estas pruebas verifican que la interfaz declare el comportamiento
// adaptable (clases responsive), no la apariencia real. La verificación en un celular real
// (PT04-13) queda como prueba manual pendiente.
describe("PT04-13: adaptación a dispositivos móviles (verificación estructural)", () => {
  it("el formulario usa campos y botones a ancho completo en celular y en fila desde sm", async () => {
    openPage("/insumos/nuevo");
    await screen.findByRole("option", { name: "Leche" });

    for (const label of ["Nombre", "Marca u origen", "Ingrediente", "Código de barras", "Advertencias"]) {
      expect(screen.getByLabelText(label)).toHaveClass("w-full");
    }
    const guardar = screen.getByRole("button", { name: "Guardar insumo" });
    const cancelar = screen.getByRole("button", { name: "Cancelar" });
    for (const boton of [guardar, cancelar]) {
      expect(boton).toHaveClass("w-full", "sm:w-auto", "min-h-11");
    }
    expect(guardar.parentElement).toHaveClass("flex-col-reverse", "sm:flex-row");
    expect(guardar.closest("form")).toHaveClass("max-w-2xl");
  });

  it("el listado muestra tarjetas en celular y tabla desde md", async () => {
    openPage("/insumos");
    await screen.findByRole("table");

    expect(screen.getByRole("table").closest("div.hidden")).toHaveClass("md:block");
    const tarjetas = screen.getAllByRole("article");
    expect(tarjetas).toHaveLength(2);
    expect(tarjetas[0].parentElement).toHaveClass("md:hidden");
  });

  it("los filtros se pliegan detrás de un botón en celular", async () => {
    const user = userEvent.setup();
    openPage("/insumos");
    await screen.findByRole("table");

    const boton = screen.getByRole("button", { name: /^Filtros/ });
    expect(boton).toHaveClass("sm:hidden");
    expect(boton).toHaveAttribute("aria-expanded", "false");

    await user.click(boton);

    expect(boton).toHaveAttribute("aria-expanded", "true");
  });

  it("el detalle apila las acciones a ancho completo en celular", async () => {
    openPage("/insumos/10");
    await screen.findByRole("heading", { name: INS_LECHE.nombre, level: 1 });

    for (const nombre of ["Volver a insumos", "Editar insumo"]) {
      expect(screen.getByRole("button", { name: nombre })).toHaveClass("w-full", "sm:w-auto");
    }
  });

  it("la sección de alérgenos pasa de una a dos columnas desde sm", async () => {
    openPage("/insumos/10");
    const contiene = await screen.findByRole("region", { name: "Contiene" });

    expect(contiene.parentElement).toHaveClass("grid", "sm:grid-cols-2");
  });

  it("el formulario embebido (diálogo de HU05) conserva los botones a ancho completo", () => {
    render(
      <MemoryRouter>
        <InsumoForm
          values={EMPTY_INSUMO_FORM_VALUES}
          errors={{}}
          ingredientes={[LECHE]}
          embedded
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Guardar insumo" })).toHaveClass("w-full", "sm:w-auto");
  });
});

// --- reutilización: diálogo (HU05) y precarga (HU13) ---

describe("Formulario reutilizable", () => {
  const baseProps = {
    values: EMPTY_INSUMO_FORM_VALUES,
    errors: {},
    ingredientes: [LECHE],
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  it("en modo embedded no usa tarjeta ni la barra flotante de acciones", () => {
    const { container } = render(
      <MemoryRouter>
        <InsumoForm {...baseProps} embedded submitLabel="Crear insumo" />
      </MemoryRouter>,
    );

    expect(container.querySelector("[data-floating]")).toBeNull();
    expect(container.querySelector("form")).toHaveClass("space-y-4");
    expect(screen.getByRole("button", { name: "Crear insumo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("en la página usa la barra de acciones flotante", () => {
    const { container } = render(
      <MemoryRouter>
        <InsumoForm {...baseProps} />
      </MemoryRouter>,
    );

    expect(container.querySelector("[data-floating]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Guardar insumo" })).toBeInTheDocument();
  });

  it("el hook admite precarga y campos de una fuente externa para HU13", async () => {
    const onSaved = vi.fn();
    vi.mocked(insumoService.createInsumo).mockResolvedValue(insumo({ id: 30 }));
    const { result } = renderHook(() =>
      useInsumoForm({
        mode: "create",
        initialValues: {
          nombre: "Leche sin lactosa 1 L",
          marca_origen: "Colun",
          ingrediente_id: "1",
          codigo_barras: EAN_13,
          ingredientes_declarados: "Leche, lactasa",
        },
        extraPayload: {
          fuente: "open_food_facts",
          ficha: { product_name: "Leche sin lactosa" },
          fecha_recuperacion: "2026-10-04T15:30:00Z",
        },
        onSaved,
      }),
    );

    expect(result.current.values.nombre).toBe("Leche sin lactosa 1 L");
    expect(result.current.dirty).toBe(false);

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(insumoService.createInsumo).toHaveBeenCalledWith({
      ingrediente_id: 1,
      nombre: "Leche sin lactosa 1 L",
      marca_origen: "Colun",
      presentacion: null,
      codigo_barras: EAN_13,
      ingredientes_declarados: "Leche, lactasa",
      advertencias: null,
      habitual: false,
      fuente: "open_food_facts",
      ficha: { product_name: "Leche sin lactosa" },
      fecha_recuperacion: "2026-10-04T15:30:00Z",
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 30 }));
  });
});
