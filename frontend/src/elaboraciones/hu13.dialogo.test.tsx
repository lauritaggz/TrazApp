/**
 * The barcode lookup inside the dialog that registers a supply from an elaboración (T13-05 / HU13),
 * with the API simulated. The ingredient is fixed (the one of the line).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InsumoCreateDialog from "@/components/insumos/InsumoCreateDialog";
import * as ingredientService from "@/services/ingredientService";
import * as insumoService from "@/services/insumoService";
import { ApiError } from "@/types/auth";
import type { ConsultaCodigo } from "@/types/consultaCodigo";
import type { AlergenoCatalogo } from "@/types/ingredient";
import type { Insumo } from "@/types/insumo";

vi.mock("@/services/insumoService", () => ({
  listInsumos: vi.fn(),
  getInsumo: vi.fn(),
  createInsumo: vi.fn(),
  updateInsumo: vi.fn(),
  reactivateInsumo: vi.fn(),
  consultarCodigoBarras: vi.fn(),
  replaceInsumoAlergenos: vi.fn(),
  addInsumoAlergeno: vi.fn(),
}));

vi.mock("@/services/ingredientService", () => ({
  listAlergenosCatalog: vi.fn(),
}));

const CODIGO = "7802910000971";

const CATALOGO: AlergenoCatalogo[] = [
  { id: 1, codigo: "lacteos", nombre: "Leche", obligatorio_chile: true },
  { id: 2, codigo: "cacahuetes", nombre: "Maní", obligatorio_chile: true },
];

const FICHA = { product_name: "LONCO LECHE SIN LACTOSA", url: "https://fuente.ejemplo.test/producto/7802910000971" };

const LONCOLECHE: ConsultaCodigo = {
  codigo_barras: CODIGO,
  encontrado: true,
  fuente: "open_food_facts",
  fecha_recuperacion: "2026-10-19T15:00:00Z",
  producto: {
    nombre: "LONCO LECHE SIN LACTOSA",
    marca_origen: "Lonco Leche",
    presentacion: "1L",
    ingredientes_declarados: "Leche fluida natural entera.",
  },
  alergenos: {
    contiene: [{ alergeno_id: 1, codigo: "lacteos", nombre: "Leche", origen: "texto" }],
    trazas: [],
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

const DE_LECHE = insumo({ id: 10, ingrediente_id: 1, ingrediente: { id: 1, nombre: "Leche" } });
const DE_HARINA = insumo({ id: 11, ingrediente_id: 2, ingrediente: { id: 2, nombre: "Harina" }, nombre: "Harina Selecta" });

function duplicado(insumoId: number, activo: boolean) {
  return new ApiError("Ya existe un insumo con ese código de barras.", 409, {}, {
    mensaje: "Ya existe un insumo con ese código de barras.",
    insumo_id: insumoId,
    activo,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue(CATALOGO);
  vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(LONCOLECHE);
  vi.mocked(insumoService.createInsumo).mockResolvedValue(insumo({ id: 50 }));
});

type Usuario = ReturnType<typeof userEvent.setup>;

function abrirDialogo() {
  const onAssigned = vi.fn();
  const onCancel = vi.fn();
  render(
    <MemoryRouter>
      <InsumoCreateDialog ingrediente={{ id: 1, nombre: "Leche" }} onAssigned={onAssigned} onCancel={onCancel} />
    </MemoryRouter>,
  );
  return { onAssigned, onCancel, dialogo: screen.getByRole("dialog", { name: "Registrar insumo nuevo" }) };
}

/** Opens the scanner of the block and delivers a code through its field to type the number. */
async function entregarCodigo(user: Usuario, dialogo: HTMLElement, codigo = CODIGO) {
  await user.click(within(dialogo).getByRole("button", { name: "Escanear código de barras" }));
  const escaner = await within(dialogo).findByRole("dialog", { name: "Escanear código de barras" });
  await user.type(within(escaner).getByLabelText("Número del código de barras"), codigo);
  await user.click(within(escaner).getByRole("button", { name: "Buscar" }));
}

const campo = (dialogo: HTMLElement, nombre: string) => within(dialogo).getByLabelText(nombre) as HTMLInputElement;

// =============================================================================================

describe("Bloque de búsqueda en el diálogo", () => {
  it("el foco inicial sigue en «Nombre»: el bloque no se lo quita", () => {
    const { dialogo } = abrirDialogo();

    expect(campo(dialogo, "Nombre")).toHaveFocus();
    expect(within(dialogo).getByRole("button", { name: "Escanear código de barras" })).not.toHaveFocus();
  });

  it("no ofrece «Crear ingrediente»: el ingrediente de la línea es fijo (T13-09)", () => {
    const { dialogo } = abrirDialogo();

    expect(within(dialogo).queryByRole("button", { name: "Crear ingrediente" })).not.toBeInTheDocument();
    expect(campo(dialogo, "Ingrediente")).toBeDisabled();
  });

  it("el bloque está dentro del diálogo, sobre el formulario", () => {
    const { dialogo } = abrirDialogo();

    const bloque = within(dialogo).getByRole("region", { name: "Buscar por código de barras" });
    expect(bloque.compareDocumentPosition(campo(dialogo, "Nombre")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("encontrado: precarga el formulario, el ingrediente sigue fijo, y se registra solo al guardar", async () => {
    const user = userEvent.setup();
    const { dialogo, onAssigned } = abrirDialogo();

    await entregarCodigo(user, dialogo);

    await waitFor(() => expect(campo(dialogo, "Nombre")).toHaveValue("LONCO LECHE SIN LACTOSA"));
    expect(campo(dialogo, "Marca u origen")).toHaveValue("Lonco Leche");
    expect(campo(dialogo, "Código de barras")).toHaveValue(CODIGO);
    expect(campo(dialogo, "Ingrediente")).toHaveValue("1");
    expect(campo(dialogo, "Ingrediente")).toBeDisabled();
    expect(within(dialogo).getByText("(según el texto de ingredientes)")).toBeInTheDocument();
    expect(within(dialogo).getByText("No pudimos asociar:")).toBeInTheDocument();
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
    expect(onAssigned).not.toHaveBeenCalled();

    await user.click(within(dialogo).getByRole("button", { name: "Registrar insumo" }));

    await waitFor(() => expect(onAssigned).toHaveBeenCalledWith(expect.objectContaining({ id: 50 })));
    expect(insumoService.createInsumo).toHaveBeenCalledWith(
      expect.objectContaining({
        ingrediente_id: 1,
        codigo_barras: CODIGO,
        fuente: "open_food_facts",
        fecha_recuperacion: "2026-10-19T15:00:00Z",
        ficha: FICHA,
        alergenos: [{ alergeno_id: 1, tipo: "contiene" }],
      }),
    );
  });

  it("con datos escritos pide confirmación antes de reemplazarlos", async () => {
    const user = userEvent.setup();
    const { dialogo } = abrirDialogo();
    await user.type(campo(dialogo, "Nombre"), "Lo que yo escribí");

    await entregarCodigo(user, dialogo);

    expect(await screen.findByRole("alertdialog", { name: "Reemplazar los datos del formulario" })).toBeInTheDocument();
    expect(campo(dialogo, "Nombre")).toHaveValue("Lo que yo escribí");
    await user.click(screen.getByRole("button", { name: "Reemplazar datos" }));
    await waitFor(() => expect(campo(dialogo, "Nombre")).toHaveValue("LONCO LECHE SIN LACTOSA"));
    expect(campo(dialogo, "Ingrediente")).toHaveValue("1");
  });

  it("«Conservar lo escrito» deja el formulario como estaba", async () => {
    const user = userEvent.setup();
    const { dialogo } = abrirDialogo();
    await user.type(campo(dialogo, "Nombre"), "Lo que yo escribí");
    await entregarCodigo(user, dialogo);

    await user.click(await screen.findByRole("button", { name: "Conservar lo escrito" }));

    expect(campo(dialogo, "Nombre")).toHaveValue("Lo que yo escribí");
    expect(campo(dialogo, "Código de barras")).toHaveValue("");
  });

  it("no encontrado: conserva lo escrito, agrega el código y avisa", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue({
      ...LONCOLECHE,
      encontrado: false,
      producto: null,
      ficha: null,
      alergenos: { contiene: [], trazas: [], sin_reconocer: [] },
    });
    const user = userEvent.setup();
    const { dialogo } = abrirDialogo();
    await user.type(campo(dialogo, "Nombre"), "Lo que yo escribí");

    await entregarCodigo(user, dialogo);

    expect(
      await within(dialogo).findByText("No encontramos este código. Completa los datos manualmente."),
    ).toBeInTheDocument();
    expect(campo(dialogo, "Código de barras")).toHaveValue(CODIGO);
    expect(campo(dialogo, "Nombre")).toHaveValue("Lo que yo escribí");
    expect(campo(dialogo, "Ingrediente")).toHaveValue("1");
  });

  it("fuente no disponible: avisa y deja el código escrito", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(new ApiError("x", 503));
    const user = userEvent.setup();
    const { dialogo } = abrirDialogo();

    await entregarCodigo(user, dialogo);

    expect(
      await within(dialogo).findByText("No pudimos consultar la fuente en este momento. Completa los datos manualmente."),
    ).toBeInTheDocument();
    expect(campo(dialogo, "Código de barras")).toHaveValue(CODIGO);
  });
});

// =============================================================================================

describe("El código ya está registrado: usarlo o reactivarlo solo para el ingrediente de la línea", () => {
  it("activo y del mismo ingrediente: «Usar este insumo» lo asigna a la línea", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(duplicado(10, true));
    vi.mocked(insumoService.getInsumo).mockResolvedValue(DE_LECHE);
    const user = userEvent.setup();
    const { dialogo, onAssigned } = abrirDialogo();
    await entregarCodigo(user, dialogo);

    await user.click(await within(dialogo).findByRole("button", { name: "Usar este insumo" }));

    await waitFor(() => expect(onAssigned).toHaveBeenCalledWith(DE_LECHE));
    expect(insumoService.getInsumo).toHaveBeenCalledWith(10);
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
  });

  it("activo pero de otro ingrediente: lo explica y no lo asigna", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(duplicado(11, true));
    vi.mocked(insumoService.getInsumo).mockResolvedValue(DE_HARINA);
    const user = userEvent.setup();
    const { dialogo, onAssigned } = abrirDialogo();
    await entregarCodigo(user, dialogo);

    await user.click(await within(dialogo).findByRole("button", { name: "Usar este insumo" }));

    expect(await within(dialogo).findByText("Ese insumo está asociado a «Harina».")).toBeInTheDocument();
    expect(onAssigned).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Registrar insumo nuevo" })).toBeInTheDocument();
  });

  it("en el diálogo no hay enlace a otra pantalla: solo usar o reactivar", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(duplicado(10, true));
    const user = userEvent.setup();
    const { dialogo } = abrirDialogo();

    await entregarCodigo(user, dialogo);

    await within(dialogo).findByText(/Ya tienes este insumo registrado/);
    expect(within(dialogo).queryByRole("link", { name: "Ver insumo" })).not.toBeInTheDocument();
    expect(within(dialogo).queryByRole("button", { name: "Reactivar" })).not.toBeInTheDocument();
  });

  it("desactivado y del mismo ingrediente: «Reactivar» lo reactiva y lo asigna", async () => {
    const inactivo = insumo({ id: 10, activo: false });
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(duplicado(10, false));
    vi.mocked(insumoService.getInsumo).mockResolvedValue(inactivo);
    vi.mocked(insumoService.reactivateInsumo).mockResolvedValue({ ...inactivo, activo: true });
    const user = userEvent.setup();
    const { dialogo, onAssigned } = abrirDialogo();
    await entregarCodigo(user, dialogo);

    await user.click(await within(dialogo).findByRole("button", { name: "Reactivar" }));

    await waitFor(() => expect(onAssigned).toHaveBeenCalledWith({ ...inactivo, activo: true }));
    expect(insumoService.reactivateInsumo).toHaveBeenCalledWith(10);
    expect(within(dialogo).queryByRole("button", { name: "Usar este insumo" })).not.toBeInTheDocument();
  });

  it("desactivado y de otro ingrediente: no lo reactiva y lo explica", async () => {
    const inactivo = insumo({ ...DE_HARINA, activo: false });
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(duplicado(11, false));
    vi.mocked(insumoService.getInsumo).mockResolvedValue(inactivo);
    const user = userEvent.setup();
    const { dialogo, onAssigned } = abrirDialogo();
    await entregarCodigo(user, dialogo);

    await user.click(await within(dialogo).findByRole("button", { name: "Reactivar" }));

    expect(await within(dialogo).findByText("Ese insumo está asociado a «Harina».")).toBeInTheDocument();
    expect(insumoService.reactivateInsumo).not.toHaveBeenCalled();
    expect(onAssigned).not.toHaveBeenCalled();
  });

  it("si no se puede comprobar el insumo existente, lo informa y no lo asigna", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(duplicado(10, true));
    vi.mocked(insumoService.getInsumo).mockRejectedValue(new ApiError("falla", 500));
    const user = userEvent.setup();
    const { dialogo, onAssigned } = abrirDialogo();
    await entregarCodigo(user, dialogo);

    await user.click(await within(dialogo).findByRole("button", { name: "Usar este insumo" }));

    expect(await within(dialogo).findByText(/No pudimos comprobar el insumo existente/)).toBeInTheDocument();
    expect(onAssigned).not.toHaveBeenCalled();
  });
});

// =============================================================================================

describe("Escape en el diálogo con el escáner", () => {
  it("con el escáner abierto, Escape cierra el escáner y el diálogo sigue", async () => {
    const user = userEvent.setup();
    const { dialogo, onCancel } = abrirDialogo();
    await user.click(within(dialogo).getByRole("button", { name: "Escanear código de barras" }));
    await within(dialogo).findByRole("dialog", { name: "Escanear código de barras" });

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Escanear código de barras" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog", { name: "Registrar insumo nuevo" })).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("con la confirmación de reemplazo abierta, Escape la cierra y el diálogo sigue", async () => {
    const user = userEvent.setup();
    const { dialogo, onCancel } = abrirDialogo();
    await user.type(campo(dialogo, "Nombre"), "Lo que yo escribí");
    await entregarCodigo(user, dialogo);
    await screen.findByRole("alertdialog", { name: "Reemplazar los datos del formulario" });

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(onCancel).not.toHaveBeenCalled();
    expect(campo(dialogo, "Nombre")).toHaveValue("Lo que yo escribí");
  });
});
