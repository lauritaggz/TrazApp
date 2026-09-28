import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import IngredientCompositionSection from "@/components/ingredients/IngredientCompositionSection";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as ingredientService from "@/services/ingredientService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type {
  Alergeno,
  AlergenoCatalogo,
  ComposicionComponente,
  Ingrediente,
} from "@/types/ingredient";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
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

const mockIngredients: Ingrediente[] = [
  {
    id: 2,
    productor_id: 1,
    codigo_interno: "HAR-001",
    nombre: "Harina de trigo",
    descripcion: "Harina integral",
    tipo: "simple",
    activo: true,
    created_at: "2026-08-25T12:00:00Z",
  },
  {
    id: 1,
    productor_id: 1,
    codigo_interno: "MAS-001",
    nombre: "Masa base",
    descripcion: "Masa compuesta",
    tipo: "compuesto",
    activo: true,
    created_at: "2026-08-24T12:00:00Z",
  },
];

const mockComposition: ComposicionComponente[] = [
  {
    id: 10,
    ingrediente_componente_id: 2,
    codigo_interno: "HAR-001",
    nombre: "Harina de trigo",
    tipo: "simple",
    porcentaje: "60.000",
    orden: 1,
  },
];

const mockAllergens: Alergeno[] = [
  { id: 1, codigo: "gluten", nombre: "Gluten" },
  { id: 7, codigo: "lacteos", nombre: "Lácteos" },
];

const mockCatalog: AlergenoCatalogo[] = [
  { id: 2, codigo: "crustaceos", nombre: "Crustáceos", obligatorio_chile: true },
  { id: 1, codigo: "gluten", nombre: "Gluten", obligatorio_chile: true },
  { id: 7, codigo: "lacteos", nombre: "Lácteos", obligatorio_chile: true },
  { id: 9, codigo: "apio", nombre: "Apio", obligatorio_chile: false },
  { id: 10, codigo: "mostaza", nombre: "Mostaza", obligatorio_chile: false },
];

function setupAuthenticated() {
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
}

function setupDefaultMocks() {
  vi.mocked(ingredientService.listIngredientComposition).mockResolvedValue([]);
  vi.mocked(ingredientService.listIngredientAllergens).mockResolvedValue([]);
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue(mockCatalog);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue(mockIngredients);
}

async function openIngredientsPage(initialEntries = ["/ingredientes"]) {
  renderWithProviders(<App />, { initialEntries });
  if (initialEntries[0] === "/ingredientes") {
    expect(
      await screen.findByRole("heading", { name: "Ingredientes", level: 1 }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Cargando ingredientes...")).not.toBeInTheDocument();
    });
  }
}

async function openIngredientDetailPage(path: string, heading?: string) {
  renderWithProviders(<App />, { initialEntries: [path] });
  if (heading) {
    expect(
      await screen.findByRole("heading", { name: heading, level: 1 }),
    ).toBeInTheDocument();
    return;
  }
  await waitFor(() => {
    expect(screen.queryByText("Cargando ingrediente...")).not.toBeInTheDocument();
  });
}

async function fillValidIngredientForm(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.type(screen.getByLabelText(/Código interno/), "AZU-001");
  await user.type(screen.getByLabelText(/^Nombre/), "Azúcar");
  await user.type(screen.getByLabelText(/Descripción/), "Azúcar refinada");
}

describe("Ingredientes HU02 — listado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setupAuthenticated();
    setupDefaultMocks();
  });

  it("muestra listado con código, nombre y estado, sin tipo", async () => {
    await openIngredientsPage();
    expect(screen.getByText("2 ingredientes registrados")).toBeInTheDocument();
    expect(screen.getAllByText("HAR-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Harina de trigo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Activo").length).toBeGreaterThan(0);
    expect(screen.queryByText("Simple")).not.toBeInTheDocument();
    expect(screen.queryByText("Compuesto")).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Tipo" })).not.toBeInTheDocument();
    expect(screen.queryByText("Tipo")).not.toBeInTheDocument();
  });

  it("muestra estado vacío y error con reintento", async () => {
    const user = userEvent.setup();
    vi.mocked(ingredientService.listIngredients)
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce([]);

    await openIngredientsPage();
    expect(
      screen.getByRole("heading", {
        name: "No pudimos cargar tus ingredientes.",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByRole("heading", { name: "Aún no tienes ingredientes" }),
    ).toBeInTheDocument();
  });
});

describe("Ingredientes HU02 — creación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setupAuthenticated();
    setupDefaultMocks();
    vi.mocked(ingredientService.listIngredients).mockResolvedValue([]);
  });

  it("crea ingrediente sin tipo y muestra feedback", async () => {
    const user = userEvent.setup();
    vi.mocked(ingredientService.createIngredient).mockResolvedValue({
      ...mockIngredients[0],
      id: 3,
      codigo_interno: "AZU-001",
      nombre: "Azúcar",
      tipo: null,
    });

    renderWithProviders(<App />, { initialEntries: ["/ingredientes/nuevo"] });
    expect(
      await screen.findByRole("heading", { name: "Nuevo ingrediente" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Tipo/)).not.toBeInTheDocument();

    await fillValidIngredientForm(user);
    await user.click(screen.getByRole("button", { name: "Guardar ingrediente" }));

    expect(
      await screen.findByText("Ingrediente creado correctamente."),
    ).toBeInTheDocument();
    const [payload] = vi.mocked(ingredientService.createIngredient).mock.calls[0];
    expect(payload).toStrictEqual({
      codigo_interno: "AZU-001",
      nombre: "Azúcar",
      descripcion: "Azúcar refinada",
    });
    expect(Object.keys(payload)).not.toContain("tipo");
  });

  it("muestra error de código duplicado desde API", async () => {
    const user = userEvent.setup();
    vi.mocked(ingredientService.createIngredient).mockRejectedValue(
      new ApiError("Ya existe un ingrediente con ese código interno.", 409),
    );

    renderWithProviders(<App />, { initialEntries: ["/ingredientes/nuevo"] });
    await screen.findByRole("heading", { name: "Nuevo ingrediente" });
    await fillValidIngredientForm(user);
    await user.click(screen.getByRole("button", { name: "Guardar ingrediente" }));

    expect(
      await screen.findByText("Ya existe un ingrediente con este código interno."),
    ).toBeInTheDocument();
  });
});

describe("Ingredientes HU02 — detalle, edición y desactivación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setupAuthenticated();
    setupDefaultMocks();
    vi.mocked(ingredientService.getIngredient).mockImplementation(async (id) => {
      const found = mockIngredients.find((item) => item.id === id);
      if (!found) throw new ApiError("No encontrado", 404);
      return found;
    });
  });

  it("muestra detalle con información general", async () => {
    await openIngredientDetailPage("/ingredientes/2", "Harina de trigo");
    expect(screen.getByText("Información general")).toBeInTheDocument();
    expect(screen.getByText("Alérgenos")).toBeInTheDocument();
  });

  it("edita ingrediente y confirma cancelación con cambios", async () => {
    const user = userEvent.setup();

    await openIngredientDetailPage("/ingredientes/2", "Harina de trigo");
    await user.click(screen.getByRole("button", { name: "Editar ingrediente" }));
    expect(
      await screen.findByRole("heading", { name: "Editar ingrediente", level: 1 }),
    ).toBeInTheDocument();

    const nombre = screen.getByLabelText(/^Nombre/);
    await user.clear(nombre);
    await user.type(nombre, "Harina premium");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      await screen.findByRole("heading", { name: "Salir sin guardar" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salir sin guardar" }));

    expect(
      await screen.findByRole("heading", { name: "Harina de trigo", level: 1 }),
    ).toBeInTheDocument();
  });

  it("guarda cambios y desactiva ingrediente con confirmación", async () => {
    const user = userEvent.setup();
    vi.mocked(ingredientService.updateIngredient).mockResolvedValue({
      ...mockIngredients[0],
      nombre: "Harina premium",
    });
    vi.mocked(ingredientService.deleteIngredient).mockResolvedValue();

    await openIngredientDetailPage("/ingredientes/2", "Harina de trigo");

    await user.click(screen.getByRole("button", { name: "Editar ingrediente" }));
    const nombre = await screen.findByLabelText(/^Nombre/);
    await user.clear(nombre);
    await user.type(nombre, "Harina premium");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText("Ingrediente actualizado correctamente."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Desactivar ingrediente" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Desactivar ingrediente" }),
    );

    expect(
      await screen.findByText("Ingrediente desactivado correctamente."),
    ).toBeInTheDocument();
    expect(ingredientService.deleteIngredient).toHaveBeenCalledWith(2);
  });

  it("edita el nombre de un compuesto existente sin enviar tipo", async () => {
    const user = userEvent.setup();
    vi.mocked(ingredientService.updateIngredient).mockResolvedValue({
      ...mockIngredients[1],
      nombre: "Masa base editada",
    });

    renderWithProviders(<App />, { initialEntries: ["/ingredientes/1/editar"] });
    const nombre = await screen.findByLabelText(/^Nombre/);
    await waitFor(() => expect(nombre).toHaveValue("Masa base"));
    expect(screen.queryByLabelText(/^Tipo/)).not.toBeInTheDocument();

    await user.clear(nombre);
    await user.type(nombre, "Masa base editada");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText("Ingrediente actualizado correctamente."),
    ).toBeInTheDocument();
    expect(ingredientService.updateIngredient).toHaveBeenCalledTimes(1);
    const [id, payload] = vi.mocked(ingredientService.updateIngredient).mock.calls[0];
    expect(id).toBe(1);
    expect(payload).toStrictEqual({ nombre: "Masa base editada" });
    expect(Object.keys(payload)).not.toContain("tipo");
  });

  it("muestra ingrediente no disponible ante 404", async () => {
    vi.mocked(ingredientService.getIngredient).mockRejectedValue(
      new ApiError("No encontrado", 404),
    );
    await openIngredientDetailPage("/ingredientes/999");
    expect(
      await screen.findByText("Ingrediente no disponible."),
    ).toBeInTheDocument();
  });
});

describe("Ingredientes HU02 — composición y alérgenos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setupAuthenticated();
    setupDefaultMocks();
    vi.mocked(ingredientService.getIngredient).mockResolvedValue(mockIngredients[1]);
    vi.mocked(ingredientService.listIngredientComposition).mockResolvedValue(
      mockComposition,
    );
    vi.mocked(ingredientService.listIngredientAllergens).mockResolvedValue(
      mockAllergens,
    );
  });

  it("el detalle de un compuesto no muestra tipo ni composición declarada", async () => {
    await openIngredientDetailPage("/ingredientes/1", "Masa base");
    expect(await screen.findByText("Gluten")).toBeInTheDocument();
    expect(screen.queryByText("Composición declarada")).not.toBeInTheDocument();
    expect(screen.queryByText("Tipo")).not.toBeInTheDocument();
    expect(screen.queryByText("Compuesto")).not.toBeInTheDocument();
    expect(ingredientService.listIngredientComposition).not.toHaveBeenCalled();
  });

  it("IngredientCompositionSection se conserva: agrega componente y muestra error de API", async () => {
    const user = userEvent.setup();
    vi.mocked(ingredientService.listIngredientComposition).mockResolvedValue([]);
    vi.mocked(ingredientService.addCompositionComponent).mockRejectedValue(
      new ApiError("La composición generaría un ciclo entre ingredientes.", 422),
    );

    render(<IngredientCompositionSection ingredienteId={1} ingredienteTipo="compuesto" />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "+ Agregar componente" }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "+ Agregar componente" }));
    await user.selectOptions(screen.getByLabelText("Componente"), "2");
    await user.type(screen.getByLabelText(/^Porcentaje/), "40");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(
      await screen.findByText("La composición generaría un ciclo entre ingredientes."),
    ).toBeInTheDocument();
  });

  it("muestra alérgenos asociados y permite agregar", async () => {
    const user = userEvent.setup();
    vi.mocked(ingredientService.addIngredientAllergen).mockResolvedValue(
      mockCatalog[1],
    );
    vi.mocked(ingredientService.listIngredientAllergens)
      .mockResolvedValueOnce(mockAllergens)
      .mockResolvedValueOnce([
        ...mockAllergens,
        mockCatalog[1],
      ]);

    await openIngredientDetailPage("/ingredientes/1", "Masa base");
    expect(await screen.findByText("Gluten")).toBeInTheDocument();
    expect(screen.getByText("Lácteos")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ Agregar alérgeno" }));
    await user.selectOptions(
      screen.getByLabelText("Alérgeno del catálogo"),
      "2",
    );
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => {
      expect(ingredientService.addIngredientAllergen).toHaveBeenCalledWith(1, 2);
    });
  });

  it("elimina asociación de alérgeno", async () => {
    const user = userEvent.setup();
    vi.mocked(ingredientService.deleteIngredientAllergen).mockResolvedValue();
    vi.mocked(ingredientService.listIngredientAllergens)
      .mockResolvedValueOnce(mockAllergens)
      .mockResolvedValueOnce([mockAllergens[1]]);

    await openIngredientDetailPage("/ingredientes/1", "Masa base");
    await screen.findByText("Gluten");
    await user.click(
      screen.getByRole("button", { name: "Eliminar alérgeno Gluten" }),
    );
    await user.click(screen.getByRole("button", { name: "Eliminar asociación" }));

    await waitFor(() => {
      expect(ingredientService.deleteIngredientAllergen).toHaveBeenCalledWith(1, 1);
    });
  });

  it("agrupa el catálogo en obligatorios y otros, en el orden del backend", async () => {
    const user = userEvent.setup();

    await openIngredientDetailPage("/ingredientes/1", "Masa base");
    const glutenChip = (await screen.findByText("Gluten")).parentElement as HTMLElement;
    expect(within(glutenChip).getByText("Obligatorio")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ Agregar alérgeno" }));
    const select = screen.getByLabelText("Alérgeno del catálogo");
    const groups = Array.from(select.querySelectorAll("optgroup")).map((group) => ({
      label: group.label,
      options: Array.from(group.querySelectorAll("option")).map((o) => o.textContent),
    }));
    expect(groups).toEqual([
      { label: "Declaración obligatoria", options: ["Crustáceos"] },
      { label: "Otros alérgenos", options: ["Apio", "Mostaza"] },
    ]);
  });

  it("si falla el catálogo muestra error y no usa una copia local", async () => {
    vi.mocked(ingredientService.listAlergenosCatalog).mockRejectedValue(
      new ApiError("fallo", 500),
    );

    await openIngredientDetailPage("/ingredientes/1", "Masa base");
    expect(
      await screen.findByText("No pudimos cargar el catálogo de alérgenos."),
    ).toBeInTheDocument();
    expect(screen.getByText("Gluten")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Agregar alérgeno" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Alérgeno del catálogo")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
