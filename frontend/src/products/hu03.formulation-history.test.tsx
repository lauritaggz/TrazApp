import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductFormulationSection from "@/components/products/ProductFormulationSection";
import * as formulationService from "@/services/formulationService";
import * as ingredientService from "@/services/ingredientService";
import { ApiError } from "@/types/auth";
import type {
  FormulacionLinea,
  FormulacionVersion,
  VersionProductoHistorial,
} from "@/types/formulation";

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
const EXPLICACION =
  "Se crea una nueva versión cuando se modifica la receta de un producto que ya se utilizó en una elaboración.";

function linea(id: number, nombre: string, overrides: Partial<FormulacionLinea> = {}): FormulacionLinea {
  return {
    id,
    ingrediente_id: id,
    ingrediente_nombre: nombre,
    ingrediente_codigo_interno: `ING-${id}`,
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

function vigente(numero: number, lineas: FormulacionLinea[]): FormulacionVersion {
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

function historial(
  numero: number,
  fecha: string,
  cantidad: number,
  { vigente = false, usada = true } = {},
): VersionProductoHistorial {
  return {
    id: 100 + numero,
    numero_version: numero,
    descripcion: `Versión ${numero}`,
    fecha_creacion: fecha,
    vigente,
    usada_en_elaboracion: usada,
    cantidad_lineas: cantidad,
  };
}

const V3 = historial(3, "2026-09-28T12:00:00Z", 2, { vigente: true, usada: false });
const V2 = historial(2, "2026-08-10T18:30:00Z", 3);
const V1 = historial(1, "2026-06-15T18:30:00Z", 1);

function renderSection() {
  return render(<ProductFormulationSection productoId={PRODUCTO_ID} />);
}

async function expandHistory(total: number) {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: `Ver historial de versiones (${total})` }),
  );
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(formulationService.getProductFormulation).mockResolvedValue({
    existe: true,
    version: vigente(3, [linea(1, "Harina"), linea(2, "Agua")]),
  });
  vi.mocked(formulationService.listProductVersions).mockResolvedValue([V3, V2, V1]);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([]);
});

describe("HU03 — historial de versiones", () => {
  it("no se muestra si el producto tiene una sola versión", async () => {
    vi.mocked(formulationService.listProductVersions).mockResolvedValue([
      historial(1, "2026-09-28T12:00:00Z", 2, { vigente: true, usada: false }),
    ]);

    renderSection();

    await waitFor(() => {
      expect(formulationService.listProductVersions).toHaveBeenCalledWith(PRODUCTO_ID);
    });
    await waitFor(() => {
      expect(screen.queryByText("Cargando historial de versiones...")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Historial de versiones")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver historial/ })).not.toBeInTheDocument();
  });

  it("no consulta el historial si el producto no tiene formulación", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue({
      existe: false,
      version: null,
    });

    renderSection();

    await screen.findByText("Este producto aún no tiene formulación.");
    expect(formulationService.listProductVersions).not.toHaveBeenCalled();
  });

  it("aparece plegado, con la explicación y el total de versiones", async () => {
    renderSection();

    const toggle = await screen.findByRole("button", { name: "Ver historial de versiones (3)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("heading", { name: "Historial de versiones" })).toBeInTheDocument();
    expect(screen.getByText(EXPLICACION)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Versiones de la formulación" })).not.toBeInTheDocument();
  });

  it("lista las versiones de la más reciente a la más antigua, con fecha, ingredientes y marcas", async () => {
    renderSection();

    const user = await expandHistory(3);

    const items = within(
      screen.getByRole("list", { name: "Versiones de la formulación" }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(3);

    expect(items[0]).toHaveTextContent("Versión 3");
    expect(items[0]).toHaveTextContent("28-09-2026, 09:00");
    expect(items[0]).toHaveTextContent("2 ingredientes");
    expect(within(items[0]).getByText("Vigente")).toBeInTheDocument();
    expect(within(items[0]).queryByText("Usada en elaboraciones")).not.toBeInTheDocument();
    expect(within(items[0]).queryByRole("button")).not.toBeInTheDocument();

    expect(items[1]).toHaveTextContent("Versión 2");
    expect(items[1]).toHaveTextContent("10-08-2026, 14:30");
    expect(items[1]).toHaveTextContent("3 ingredientes");
    expect(within(items[1]).queryByText("Vigente")).not.toBeInTheDocument();
    expect(within(items[1]).getByText("Usada en elaboraciones")).toBeInTheDocument();

    expect(items[2]).toHaveTextContent("Versión 1");
    expect(items[2]).toHaveTextContent("15-06-2026, 14:30");
    expect(items[2]).toHaveTextContent("1 ingrediente");
    expect(within(items[2]).getByText("Usada en elaboraciones")).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "Ocultar historial de versiones" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(screen.queryByRole("list", { name: "Versiones de la formulación" })).not.toBeInTheDocument();
  });

  it("muestra los ingredientes de una versión anterior en solo lectura", async () => {
    vi.mocked(formulationService.getVersionFormulation).mockResolvedValue([
      linea(1, "Harina", { cantidad: "1.000", unidad: "kg" }),
      linea(3, "Sal"),
    ]);
    renderSection();

    const user = await expandHistory(3);
    await user.click(screen.getByRole("button", { name: "Ver ingredientes de la versión 1" }));

    const detalle = await screen.findByRole("region", { name: "Ingredientes de la versión 1" });
    expect(formulationService.getVersionFormulation).toHaveBeenCalledWith(PRODUCTO_ID, V1.id);
    expect(await within(detalle).findByText("Harina")).toBeInTheDocument();
    expect(within(detalle).getByText("1 kg")).toBeInTheDocument();
    expect(within(detalle).getByText("Sal")).toBeInTheDocument();
    expect(within(detalle).getByText("Sin cantidad")).toBeInTheDocument();
    expect(within(detalle).getByText("Versión 1 (solo lectura)")).toBeInTheDocument();
    expect(within(detalle).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(detalle).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(detalle).queryByRole("button", { name: /Quitar/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ver ingredientes de la versión 1" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(within(detalle).getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("region", { name: "Ingredientes de la versión 1" })).not.toBeInTheDocument();
  });

  it("muestra la carga y el error del detalle, y permite reintentar", async () => {
    let reject!: (reason: unknown) => void;
    const pending = new Promise<FormulacionLinea[]>((_, r) => {
      reject = r;
    });
    // Marca la promesa como atendida: el rechazo puede llegar antes de que el componente
    // adjunte su manejador (los efectos corren tras el render), y eso se vería como
    // "Unhandled Rejection" aunque el componente sí lo maneja después.
    pending.catch(() => {});
    vi.mocked(formulationService.getVersionFormulation)
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce([linea(1, "Harina")]);
    renderSection();

    const user = await expandHistory(3);
    await user.click(screen.getByRole("button", { name: "Ver ingredientes de la versión 2" }));

    const detalle = screen.getByRole("region", { name: "Ingredientes de la versión 2" });
    expect(within(detalle).getByText("Cargando ingredientes de la versión...")).toBeInTheDocument();
    reject(new ApiError("fallo", 500));
    expect(
      await within(detalle).findByText("No pudimos cargar los ingredientes de esta versión."),
    ).toBeInTheDocument();

    await user.click(within(detalle).getByRole("button", { name: "Reintentar" }));
    expect(await within(detalle).findByText("Harina")).toBeInTheDocument();
    expect(formulationService.getVersionFormulation).toHaveBeenCalledTimes(2);
  });

  it("ignora la respuesta de una versión que ya no está seleccionada", async () => {
    let resolveV2!: (lineas: FormulacionLinea[]) => void;
    vi.mocked(formulationService.getVersionFormulation).mockImplementation((_, versionId) =>
      versionId === V2.id
        ? new Promise((resolve) => {
            resolveV2 = resolve;
          })
        : Promise.resolve([linea(3, "Sal")]),
    );
    renderSection();

    const user = await expandHistory(3);
    await user.click(screen.getByRole("button", { name: "Ver ingredientes de la versión 2" }));
    await user.click(screen.getByRole("button", { name: "Ver ingredientes de la versión 1" }));
    const detalle = await screen.findByRole("region", { name: "Ingredientes de la versión 1" });
    expect(await within(detalle).findByText("Sal")).toBeInTheDocument();

    resolveV2([linea(9, "Azúcar")]);
    await waitFor(() => {
      expect(formulationService.getVersionFormulation).toHaveBeenCalledTimes(2);
    });
    await Promise.resolve();
    expect(within(detalle).queryByText("Azúcar")).not.toBeInTheDocument();
    expect(within(detalle).getByText("Sal")).toBeInTheDocument();
  });

  it("muestra la carga y el error del historial, y permite reintentar", async () => {
    let reject!: (reason: unknown) => void;
    const pending = new Promise<VersionProductoHistorial[]>((_, r) => {
      reject = r;
    });
    // Marca la promesa como atendida: el rechazo puede llegar antes de que el componente
    // adjunte su manejador (los efectos corren tras el render), y eso se vería como
    // "Unhandled Rejection" aunque el componente sí lo maneja después.
    pending.catch(() => {});
    vi.mocked(formulationService.listProductVersions)
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce([V3, V2, V1]);
    const user = userEvent.setup();
    renderSection();

    expect(await screen.findByText("Cargando historial de versiones...")).toBeInTheDocument();
    reject(new ApiError("fallo", 500));
    expect(
      await screen.findByText("No pudimos cargar el historial de versiones."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar historial" }));
    expect(
      await screen.findByRole("button", { name: "Ver historial de versiones (3)" }),
    ).toBeInTheDocument();
  });

  it("se actualiza tras guardar la formulación", async () => {
    const V4 = historial(4, "2026-09-28T15:00:00Z", 1, { vigente: true, usada: false });
    vi.mocked(formulationService.listProductVersions)
      .mockResolvedValueOnce([V3, V2, V1])
      .mockResolvedValueOnce([V4, { ...V3, vigente: false, usada_en_elaboracion: true }, V2, V1]);
    vi.mocked(formulationService.saveProductFormulation).mockResolvedValue({
      resultado: "nueva_version",
      version: vigente(4, [linea(1, "Harina")]),
    });
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole("button", { name: "Ver historial de versiones (3)" });
    await user.click(screen.getByRole("button", { name: "Editar formulación" }));
    await user.click(await screen.findByRole("button", { name: "Quitar Agua" }));
    await user.click(screen.getByRole("button", { name: "Guardar formulación" }));

    expect(
      await screen.findByText(
        "Se creó la versión 4, porque la anterior ya se utilizó en una elaboración.",
      ),
    ).toBeInTheDocument();
    await user.click(
      await screen.findByRole("button", { name: "Ver historial de versiones (4)" }),
    );
    const items = within(
      screen.getByRole("list", { name: "Versiones de la formulación" }),
    ).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Versión 4");
    expect(within(items[0]).getByText("Vigente")).toBeInTheDocument();
    expect(within(items[1]).queryByText("Vigente")).not.toBeInTheDocument();
    expect(within(items[1]).getByText("Usada en elaboraciones")).toBeInTheDocument();
    expect(formulationService.listProductVersions).toHaveBeenCalledTimes(2);
  });
});
