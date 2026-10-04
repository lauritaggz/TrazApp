import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import ProductFormulationSection from "@/components/products/ProductFormulationSection";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as formulationService from "@/services/formulationService";
import * as ingredientService from "@/services/ingredientService";
import * as productService from "@/services/productService";
import { EMPTY_PRODUCT_COMMERCIAL_FIELDS, mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type {
  FormulacionGuardada,
  FormulacionLinea,
  FormulacionVersion,
  FormulacionVigente,
  ResultadoGuardadoFormulacion,
} from "@/types/formulation";
import type { Ingrediente } from "@/types/ingredient";

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

vi.mock("@/services/ingredientService", () => ({
  listIngredients: vi.fn(),
}));

const PRODUCTO_ID = 7;

function ingrediente(id: number, nombre: string, codigo: string, activo = true): Ingrediente {
  return {
    id,
    productor_id: 1,
    codigo_interno: codigo,
    nombre,
    descripcion: null,
    tipo: null,
    activo,
    created_at: "2026-09-01T12:00:00Z",
  };
}

const HARINA = ingrediente(1, "Harina", "HAR-001");
const AGUA = ingrediente(2, "Agua", "AGU-001");
const SAL = ingrediente(3, "Sal", "SAL-001");
const AZUCAR_INACTIVA = ingrediente(4, "Azúcar", "AZU-001", false);

function linea(
  id: number,
  ing: Ingrediente,
  overrides: Partial<FormulacionLinea> = {},
): FormulacionLinea {
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

function version(numero: number, lineas: FormulacionLinea[]): FormulacionVersion {
  return {
    id: 100 + numero,
    producto_id: PRODUCTO_ID,
    numero_version: numero,
    descripcion: `Versión ${numero}`,
    fecha_creacion: "2026-09-28T12:00:00Z",
    vigente: true,
    usada_en_elaboracion: false,
    lineas,
  };
}

const SIN_FORMULACION: FormulacionVigente = { existe: false, version: null };

function conFormulacion(v: FormulacionVersion): FormulacionVigente {
  return { existe: true, version: v };
}

const V2 = version(2, [
  linea(1, HARINA, { cantidad: "500.000", unidad: "g" }),
  linea(2, AGUA, { cantidad: "1.500", unidad: "kg", notas: "Tibia" }),
  linea(3, SAL),
]);

function renderSection() {
  return render(<ProductFormulationSection productoId={PRODUCTO_ID} />);
}

async function openEditor(buttonName: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: buttonName }));
  await screen.findByRole("button", { name: "Guardar formulación" });
  await waitFor(() => {
    expect(screen.queryByText("Cargando ingredientes...")).not.toBeInTheDocument();
  });
  return user;
}

function savedPayload() {
  return vi.mocked(formulationService.saveProductFormulation).mock.calls[0][1];
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(formulationService.listProductVersions).mockResolvedValue([]);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([
    HARINA,
    AGUA,
    SAL,
    AZUCAR_INACTIVA,
  ]);
});

describe("HU03 — vista de la formulación", () => {
  it("muestra el estado de carga", async () => {
    let resolve!: (value: FormulacionVigente) => void;
    const pending = new Promise<FormulacionVigente>((r) => {
      resolve = r;
    });
    vi.mocked(formulationService.getProductFormulation).mockReturnValue(pending);

    renderSection();

    expect(screen.getByText("Cargando formulación...")).toBeInTheDocument();
    resolve(SIN_FORMULACION);
    expect(await screen.findByText("Este producto aún no tiene formulación.")).toBeInTheDocument();
    expect(formulationService.getProductFormulation).toHaveBeenCalledWith(PRODUCTO_ID);
  });

  it("muestra el error de carga y permite reintentar", async () => {
    vi.mocked(formulationService.getProductFormulation)
      .mockRejectedValueOnce(new ApiError("fallo", 500))
      .mockResolvedValueOnce(SIN_FORMULACION);
    const user = userEvent.setup();

    renderSection();

    expect(await screen.findByText("No pudimos cargar la formulación.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Este producto aún no tiene formulación.")).toBeInTheDocument();
    expect(formulationService.getProductFormulation).toHaveBeenCalledTimes(2);
  });

  it("muestra el estado vacío con el botón para definirla", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(SIN_FORMULACION);

    renderSection();

    expect(await screen.findByText("Este producto aún no tiene formulación.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Definir formulación" })).toBeInTheDocument();
    expect(screen.queryByText(/Versión vigente/)).not.toBeInTheDocument();
  });

  it("lista las líneas con cantidad y unidad e indica la versión vigente", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(conFormulacion(V2));

    renderSection();

    expect(await screen.findByText("Versión vigente: 2")).toBeInTheDocument();
    const items = within(
      screen.getByRole("list", { name: "Ingredientes de la formulación" }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Harina");
    expect(items[0]).toHaveTextContent("HAR-001");
    expect(items[0]).toHaveTextContent("500 g");
    expect(items[1]).toHaveTextContent("1,5 kg");
    expect(items[2]).toHaveTextContent("Sin cantidad");
    expect(screen.queryByText("Ingrediente desactivado")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("marca las líneas con ingrediente desactivado", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(
      conFormulacion(
        version(1, [linea(1, HARINA), linea(2, AZUCAR_INACTIVA, { ingrediente_desactivado: true })]),
      ),
    );

    renderSection();

    const items = within(
      await screen.findByRole("list", { name: "Ingredientes de la formulación" }),
    ).getAllByRole("listitem");
    expect(within(items[0]).queryByText("Ingrediente desactivado")).not.toBeInTheDocument();
    expect(within(items[1]).getByText("Ingrediente desactivado")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Hay ingredientes desactivados en la formulación. Quítalos antes de guardar.",
    );
  });

  it("se muestra en el detalle del producto", async () => {
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
    vi.mocked(productService.getProduct).mockResolvedValue({
      id: PRODUCTO_ID,
      productor_id: 1,
      codigo_interno: "PAN-001",
      nombre: "Pan amasado",
      descripcion: null,
      contenido_neto: "500.000",
      unidad_medida: "g",
      presentacion: null,
      ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
      activo: true,
      created_at: "2026-09-01T12:00:00Z",
    });
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(conFormulacion(V2));

    renderWithProviders(<App />, { initialEntries: [`/productos/${PRODUCTO_ID}`] });

    const section = (await screen.findByRole("heading", { name: "Formulación", level: 2 })).closest(
      "section",
    )!;
    expect(await within(section).findByText("Versión vigente: 2")).toBeInTheDocument();
    expect(formulationService.getProductFormulation).toHaveBeenCalledWith(PRODUCTO_ID);
  });
});

describe("HU03 — edición de la formulación", () => {
  it("el selector solo ofrece ingredientes activos que no están en la formulación", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(
      conFormulacion(version(1, [linea(1, HARINA)])),
    );
    renderSection();

    await openEditor("Editar formulación");

    const options = within(
      screen.getByRole("combobox", { name: "Ingrediente para agregar" }),
    ).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Selecciona un ingrediente",
      "Agua (AGU-001)",
      "Sal (SAL-001)",
    ]);
  });

  it("muestra el error del catálogo de ingredientes y permite reintentar", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(SIN_FORMULACION);
    vi.mocked(ingredientService.listIngredients)
      .mockRejectedValueOnce(new ApiError("fallo", 500))
      .mockResolvedValueOnce([HARINA]);
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole("button", { name: "Definir formulación" }));
    expect(await screen.findByText("No pudimos cargar tus ingredientes.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(
      await screen.findByRole("combobox", { name: "Ingrediente para agregar" }),
    ).toBeInTheDocument();
  });

  it("define la formulación agregando ingredientes y envía la lista completa por PUT", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(SIN_FORMULACION);
    vi.mocked(formulationService.saveProductFormulation).mockResolvedValue({
      resultado: "version_creada",
      version: version(1, [linea(1, HARINA, { cantidad: "0.500", unidad: "kg" }), linea(2, SAL)]),
    });
    renderSection();

    const user = await openEditor("Definir formulación");
    const selector = screen.getByRole("combobox", { name: "Ingrediente para agregar" });
    await user.selectOptions(selector, String(HARINA.id));
    await user.click(screen.getByRole("button", { name: "+ Agregar ingrediente" }));
    await user.selectOptions(selector, String(SAL.id));
    await user.click(screen.getByRole("button", { name: "+ Agregar ingrediente" }));
    await user.type(screen.getByLabelText("Cantidad de Harina"), "0,5");
    await user.selectOptions(screen.getByLabelText("Unidad de Harina"), "kg");
    await user.click(screen.getByRole("button", { name: "Guardar formulación" }));

    expect(await screen.findByText("Formulación guardada (versión 1).")).toBeInTheDocument();
    expect(formulationService.saveProductFormulation).toHaveBeenCalledTimes(1);
    expect(vi.mocked(formulationService.saveProductFormulation).mock.calls[0][0]).toBe(PRODUCTO_ID);
    expect(savedPayload()).toStrictEqual({
      lineas: [
        { ingrediente_id: HARINA.id, cantidad: "0.5", unidad: "kg" },
        { ingrediente_id: SAL.id },
      ],
    });
    expect(screen.getByText("Versión vigente: 1")).toBeInTheDocument();
    expect(screen.getByText("0,5 kg")).toBeInTheDocument();
  });

  it("exige la unidad si se indica la cantidad, y la cantidad si se indica la unidad", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(
      conFormulacion(version(1, [linea(1, HARINA), linea(2, AGUA)])),
    );
    renderSection();

    const user = await openEditor("Editar formulación");
    await user.type(screen.getByLabelText("Cantidad de Harina"), "500");
    await user.selectOptions(screen.getByLabelText("Unidad de Agua"), "L");
    await user.click(screen.getByRole("button", { name: "Guardar formulación" }));

    expect(await screen.findByText("Indica la unidad para esta cantidad.")).toBeInTheDocument();
    expect(screen.getByText("Indica la cantidad para esta unidad.")).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad de Harina")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Unidad de Agua")).toHaveAttribute(
      "aria-describedby",
      `formulacion-cantidad-${AGUA.id}-error`,
    );
    expect(formulationService.saveProductFormulation).not.toHaveBeenCalled();
  });

  it("rechaza cantidades no válidas", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(
      conFormulacion(version(1, [linea(1, HARINA)])),
    );
    renderSection();

    const user = await openEditor("Editar formulación");
    await user.type(screen.getByLabelText("Cantidad de Harina"), "0");
    await user.selectOptions(screen.getByLabelText("Unidad de Harina"), "g");
    await user.click(screen.getByRole("button", { name: "Guardar formulación" }));

    expect(
      await screen.findByText("Ingresa una cantidad mayor que 0, con hasta 3 decimales."),
    ).toBeInTheDocument();
    expect(formulationService.saveProductFormulation).not.toHaveBeenCalled();
  });

  it("quita líneas y conserva cantidad, unidad y notas de las demás", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(conFormulacion(V2));
    vi.mocked(formulationService.saveProductFormulation).mockResolvedValue({
      resultado: "modificada_en_lugar",
      version: version(2, [V2.lineas[0], V2.lineas[1]]),
    });
    renderSection();

    const user = await openEditor("Editar formulación");
    expect(screen.getByText("No hay más ingredientes activos para agregar.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar Sal" }));
    expect(screen.queryByLabelText("Cantidad de Sal")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("combobox", { name: "Ingrediente para agregar" })).getByRole("option", {
        name: "Sal (SAL-001)",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar formulación" }));

    await screen.findByText("Formulación actualizada.");
    expect(savedPayload()).toStrictEqual({
      lineas: [
        { ingrediente_id: HARINA.id, cantidad: "500", unidad: "g" },
        { ingrediente_id: AGUA.id, cantidad: "1.5", unidad: "kg", notas: "Tibia" },
      ],
    });
  });

  it("no permite guardar una formulación vacía", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(
      conFormulacion(version(1, [linea(1, HARINA)])),
    );
    renderSection();

    const user = await openEditor("Editar formulación");
    await user.click(screen.getByRole("button", { name: "Quitar Harina" }));
    await user.click(screen.getByRole("button", { name: "Guardar formulación" }));

    expect(
      await screen.findByText("Agrega al menos un ingrediente a la formulación."),
    ).toBeInTheDocument();
    expect(formulationService.saveProductFormulation).not.toHaveBeenCalled();
  });

  it("exige quitar los ingredientes desactivados antes de guardar", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(
      conFormulacion(
        version(1, [linea(1, HARINA), linea(2, AZUCAR_INACTIVA, { ingrediente_desactivado: true })]),
      ),
    );
    vi.mocked(formulationService.saveProductFormulation).mockResolvedValue({
      resultado: "modificada_en_lugar",
      version: version(1, [linea(1, HARINA)]),
    });
    renderSection();

    const user = await openEditor("Editar formulación");
    expect(
      screen.getByText("Hay ingredientes desactivados en la formulación. Quítalos antes de guardar."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar formulación" })).toBeDisabled();
    expect(screen.getByLabelText("Cantidad de Azúcar")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Quitar Azúcar" }));
    const guardar = screen.getByRole("button", { name: "Guardar formulación" });
    expect(guardar).toBeEnabled();
    await user.click(guardar);

    await screen.findByText("Formulación actualizada.");
    expect(savedPayload()).toStrictEqual({ lineas: [{ ingrediente_id: HARINA.id }] });
  });

  it.each([
    [422, "El ingrediente «Harina» está desactivado. Quítelo de la formulación para poder guardar."],
    [409, "Otra modificación de la formulación se guardó al mismo tiempo. Recargue la formulación e intente nuevamente."],
  ])("muestra el mensaje del backend ante un error %i", async (status, message) => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(
      conFormulacion(version(1, [linea(1, HARINA)])),
    );
    vi.mocked(formulationService.saveProductFormulation).mockRejectedValue(
      new ApiError(message, status),
    );
    renderSection();

    const user = await openEditor("Editar formulación");
    await user.click(screen.getByRole("button", { name: "Guardar formulación" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Guardar formulación" })).toBeInTheDocument();
  });

  it("muestra un mensaje genérico ante otros errores", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(
      conFormulacion(version(1, [linea(1, HARINA)])),
    );
    vi.mocked(formulationService.saveProductFormulation).mockRejectedValue(
      new ApiError("No se pudo completar la operación.", 500),
    );
    renderSection();

    const user = await openEditor("Editar formulación");
    await user.click(screen.getByRole("button", { name: "Guardar formulación" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos guardar la formulación. Inténtalo nuevamente.",
    );
  });

  it("cancelar descarta los cambios", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(conFormulacion(V2));
    renderSection();

    const user = await openEditor("Editar formulación");
    await user.click(screen.getByRole("button", { name: "Quitar Sal" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    const items = within(
      screen.getByRole("list", { name: "Ingredientes de la formulación" }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(formulationService.saveProductFormulation).not.toHaveBeenCalled();
  });
});

describe("HU03 — mensaje según el resultado del guardado", () => {
  const casos: [ResultadoGuardadoFormulacion, number, string][] = [
    ["version_creada", 1, "Formulación guardada (versión 1)."],
    ["modificada_en_lugar", 1, "Formulación actualizada."],
    ["nueva_version", 3, "Se creó la versión 3, porque la anterior ya se utilizó en una elaboración."],
    ["sin_cambios", 2, "No hay cambios para guardar."],
  ];

  it.each(casos)("%s", async (resultado, numero, mensaje) => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(
      conFormulacion(version(numero === 3 ? 2 : numero, [linea(1, HARINA)])),
    );
    const guardada: FormulacionGuardada = { resultado, version: version(numero, [linea(1, HARINA)]) };
    vi.mocked(formulationService.saveProductFormulation).mockResolvedValue(guardada);
    renderSection();

    const user = await openEditor("Editar formulación");
    await user.click(screen.getByRole("button", { name: "Guardar formulación" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(mensaje);
    });
    expect(screen.getByText(`Versión vigente: ${numero}`)).toBeInTheDocument();
  });
});
