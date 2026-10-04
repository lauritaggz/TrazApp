import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductFormulationSection from "@/components/products/ProductFormulationSection";
import * as formulationService from "@/services/formulationService";
import * as ingredientService from "@/services/ingredientService";
import { ApiError } from "@/types/auth";
import type { FormulacionLinea, FormulacionVersion } from "@/types/formulation";
import type { Ingrediente } from "@/types/ingredient";

vi.mock("@/services/formulationService", () => ({
  getProductFormulation: vi.fn(),
  saveProductFormulation: vi.fn(),
  listProductVersions: vi.fn(),
  getVersionFormulation: vi.fn(),
}));

vi.mock("@/services/ingredientService", () => ({
  listIngredients: vi.fn(),
  createIngredient: vi.fn(),
}));

const PRODUCTO_ID = 7;

function ingrediente(id: number, nombre: string, codigo: string): Ingrediente {
  return {
    id,
    productor_id: 1,
    codigo_interno: codigo,
    nombre,
    descripcion: null,
    tipo: null,
    activo: true,
    created_at: "2026-09-01T12:00:00Z",
  };
}

const HARINA = ingrediente(1, "Harina", "HAR-001");
const AGUA = ingrediente(2, "Agua", "AGU-001");
const SAL = ingrediente(3, "Sal", "SAL-001");
const LEVADURA = ingrediente(10, "Levadura", "LEV-001");

function linea(id: number, ing: Ingrediente, overrides: Partial<FormulacionLinea> = {}): FormulacionLinea {
  return {
    id,
    ingrediente_id: ing.id,
    ingrediente_nombre: ing.nombre,
    ingrediente_codigo_interno: ing.codigo_interno,
    ingrediente_tipo: null,
    porcentaje: null,
    cantidad: null,
    unidad: null,
    orden: id,
    notas: null,
    ingrediente_desactivado: false,
    ...overrides,
  };
}

const V1: FormulacionVersion = {
  id: 101,
  producto_id: PRODUCTO_ID,
  numero_version: 1,
  descripcion: "Versión 1",
  fecha_creacion: "2026-09-28T12:00:00Z",
  vigente: true,
  usada_en_elaboracion: false,
  lineas: [linea(1, HARINA, { cantidad: "1.000", unidad: "kg" }), linea(2, AGUA)],
};

async function openEditor() {
  const user = userEvent.setup();
  render(<ProductFormulationSection productoId={PRODUCTO_ID} />);
  await user.click(await screen.findByRole("button", { name: "Editar formulación" }));
  await screen.findByRole("button", { name: "Guardar formulación" });
  await waitFor(() => {
    expect(screen.queryByText("Cargando ingredientes...")).not.toBeInTheDocument();
  });
  return user;
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Crear ingrediente nuevo" }));
  return screen.getByRole("dialog", { name: "Nuevo ingrediente" });
}

async function fillIngredient(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  codigo: string,
  nombre: string,
) {
  await user.type(within(dialog).getByRole("textbox", { name: /Código interno/ }), codigo);
  await user.type(within(dialog).getByRole("textbox", { name: /^Nombre/ }), nombre);
}

/** Unsaved edits: Harina changes quantity and unit, Agua is removed. */
async function makeUnsavedChanges(user: ReturnType<typeof userEvent.setup>) {
  const cantidad = screen.getByRole("textbox", { name: "Cantidad de Harina" });
  await user.clear(cantidad);
  await user.type(cantidad, "2,5");
  await user.selectOptions(screen.getByRole("combobox", { name: "Unidad de Harina" }), "g");
  await user.click(screen.getByRole("button", { name: "Quitar Agua" }));
}

function expectUnsavedChangesKept() {
  expect(screen.getByRole("textbox", { name: "Cantidad de Harina" })).toHaveValue("2,5");
  expect(screen.getByRole("combobox", { name: "Unidad de Harina" })).toHaveValue("g");
  expect(screen.queryByRole("button", { name: "Quitar Agua" })).not.toBeInTheDocument();
}

function draftNames() {
  const list = screen.getByRole("list", { name: "Ingredientes de la formulación en edición" });
  return within(list)
    .getAllByRole("button", { name: /^Quitar / })
    .map((button) => button.getAttribute("aria-label"));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(formulationService.getProductFormulation).mockResolvedValue({
    existe: true,
    version: V1,
  });
  vi.mocked(formulationService.listProductVersions).mockResolvedValue([]);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([HARINA, AGUA, SAL]);
});

describe("HU03 — crear un ingrediente desde la formulación", () => {
  it("ofrece la opción junto al selector y también cuando no quedan ingredientes disponibles", async () => {
    vi.mocked(ingredientService.listIngredients).mockResolvedValue([HARINA, AGUA]);
    await openEditor();

    expect(screen.getByText("No hay más ingredientes activos para agregar.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear ingrediente nuevo" })).toBeEnabled();
  });

  it("abre un diálogo con el formulario de ingrediente y sus validaciones", async () => {
    const user = await openEditor();
    expect(screen.getByRole("combobox", { name: "Ingrediente para agregar" })).toBeInTheDocument();

    const dialog = await openDialog(user);
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("textbox", { name: /Código interno/ })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Crear ingrediente" }));

    expect(within(dialog).getByText("El código interno es obligatorio.")).toBeInTheDocument();
    expect(within(dialog).getByText("El nombre es obligatorio.")).toBeInTheDocument();
    expect(ingredientService.createIngredient).not.toHaveBeenCalled();
  });

  it("al crear, cierra el diálogo, agrega la línea y suma el ingrediente al catálogo", async () => {
    vi.mocked(ingredientService.createIngredient).mockResolvedValue(LEVADURA);
    vi.mocked(formulationService.saveProductFormulation).mockResolvedValue({
      resultado: "modificada_en_lugar",
      version: V1,
    });
    const user = await openEditor();

    const dialog = await openDialog(user);
    await fillIngredient(user, dialog, "LEV-001", "Levadura");
    await user.click(within(dialog).getByRole("button", { name: "Crear ingrediente" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(ingredientService.createIngredient).toHaveBeenCalledWith(
      expect.objectContaining({ codigo_interno: "LEV-001", nombre: "Levadura" }),
    );
    expect(draftNames()).toEqual(["Quitar Harina", "Quitar Agua", "Quitar Levadura"]);
    expect(ingredientService.listIngredients).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Guardar formulación" }));
    await waitFor(() => {
      expect(formulationService.saveProductFormulation).toHaveBeenCalled();
    });
    const payload = vi.mocked(formulationService.saveProductFormulation).mock.calls[0][1];
    expect(payload.lineas.map((l) => l.ingrediente_id)).toEqual([1, 2, 10]);
  });

  it("el ingrediente creado queda en el selector si se quita de la formulación", async () => {
    vi.mocked(ingredientService.createIngredient).mockResolvedValue(LEVADURA);
    const user = await openEditor();

    const dialog = await openDialog(user);
    await fillIngredient(user, dialog, "LEV-001", "Levadura");
    await user.click(within(dialog).getByRole("button", { name: "Crear ingrediente" }));
    await user.click(await screen.findByRole("button", { name: "Quitar Levadura" }));

    const selector = screen.getByRole("combobox", { name: "Ingrediente para agregar" });
    expect(
      within(selector).getByRole("option", { name: "Levadura (LEV-001)" }),
    ).toBeInTheDocument();
  });

  it("conserva los cambios no guardados al abrir y cancelar el diálogo", async () => {
    const user = await openEditor();
    await makeUnsavedChanges(user);

    const dialog = await openDialog(user);
    await fillIngredient(user, dialog, "LEV-001", "Levadura");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expectUnsavedChangesKept();
    expect(draftNames()).toEqual(["Quitar Harina"]);
  });

  it("conserva los cambios no guardados al crear un ingrediente", async () => {
    vi.mocked(ingredientService.createIngredient).mockResolvedValue(LEVADURA);
    const user = await openEditor();
    await makeUnsavedChanges(user);

    const dialog = await openDialog(user);
    await fillIngredient(user, dialog, "LEV-001", "Levadura");
    await user.click(within(dialog).getByRole("button", { name: "Crear ingrediente" }));

    await screen.findByRole("button", { name: "Quitar Levadura" });
    expectUnsavedChangesKept();
    expect(draftNames()).toEqual(["Quitar Harina", "Quitar Levadura"]);
  });

  it("si el código interno está repetido, muestra el error en el diálogo y lo mantiene abierto", async () => {
    vi.mocked(ingredientService.createIngredient).mockRejectedValue(
      new ApiError("Código duplicado", 409),
    );
    const user = await openEditor();

    const dialog = await openDialog(user);
    await fillIngredient(user, dialog, "HAR-001", "Harina integral");
    await user.click(within(dialog).getByRole("button", { name: "Crear ingrediente" }));

    expect(
      await within(dialog).findByText("Ya existe un ingrediente con este código interno."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Nuevo ingrediente" })).toBe(dialog);
    expect(within(dialog).getByRole("textbox", { name: /Código interno/ })).toHaveValue("HAR-001");
    expect(draftNames()).toEqual(["Quitar Harina", "Quitar Agua"]);
  });

  it("si la creación falla por otro motivo, muestra el error general dentro del diálogo", async () => {
    vi.mocked(ingredientService.createIngredient).mockRejectedValue(new Error("red"));
    const user = await openEditor();

    const dialog = await openDialog(user);
    await fillIngredient(user, dialog, "LEV-001", "Levadura");
    await user.click(within(dialog).getByRole("button", { name: "Crear ingrediente" }));

    expect(
      await within(dialog).findByText("No pudimos guardar el ingrediente. Inténtalo nuevamente."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(draftNames()).toEqual(["Quitar Harina", "Quitar Agua"]);
  });

  it("cancelar, con el botón o con Escape, no crea nada ni cambia la formulación", async () => {
    const user = await openEditor();

    let dialog = await openDialog(user);
    await fillIngredient(user, dialog, "LEV-001", "Levadura");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    dialog = await openDialog(user);
    expect(within(dialog).getByRole("textbox", { name: /Código interno/ })).toHaveValue("");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    expect(ingredientService.createIngredient).not.toHaveBeenCalled();
    expect(draftNames()).toEqual(["Quitar Harina", "Quitar Agua"]);
    expect(
      within(screen.getByRole("combobox", { name: "Ingrediente para agregar" })).queryByRole(
        "option",
        { name: /Levadura/ },
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear ingrediente nuevo" })).toHaveFocus();
  });

  it("en celular el diálogo ocupa el ancho y se desplaza dentro de la pantalla", async () => {
    const user = await openEditor();

    const dialog = await openDialog(user);

    expect(dialog).toHaveClass("w-full", "max-h-[90dvh]", "overflow-y-auto");
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveClass("w-full");
    expect(within(dialog).getByRole("button", { name: "Crear ingrediente" })).toHaveClass("w-full");
  });
});
