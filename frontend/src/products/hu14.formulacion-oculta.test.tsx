import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductFormulationSection from "@/components/products/ProductFormulationSection";
import * as formulationService from "@/services/formulationService";
import * as ingredientService from "@/services/ingredientService";
import type {
  FormulacionLinea,
  FormulacionVersion,
  FormulacionVigente,
} from "@/types/formulation";
import type { Ingrediente } from "@/types/ingredient";

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

function linea(id: number, ing: Ingrediente, extra: Partial<FormulacionLinea> = {}): FormulacionLinea {
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
    ...extra,
  };
}

function formulacion(lineas: FormulacionLinea[]): FormulacionVigente {
  const version: FormulacionVersion = {
    id: 101,
    producto_id: PRODUCTO_ID,
    numero_version: 1,
    descripcion: "Versión 1",
    fecha_creacion: "2026-09-28T12:00:00Z",
    vigente: true,
    usada_en_elaboracion: true,
    lineas,
  };
  return { existe: true, version };
}

/** Una formulación con cantidades guardadas: lo que la API devuelve («500.000», «1.500»). */
const CON_CANTIDADES = [
  linea(1, HARINA, { cantidad: "500.000", unidad: "g" }),
  linea(2, AGUA, { cantidad: "1.500", unidad: "kg", notas: "Tibia" }),
];

async function abrirEditor(lineas: FormulacionLinea[]) {
  vi.mocked(formulationService.getProductFormulation).mockResolvedValue(formulacion(lineas));
  vi.mocked(formulationService.saveProductFormulation).mockResolvedValue({
    resultado: "sin_cambios",
    version: formulacion(lineas).version!,
  });
  render(<ProductFormulationSection productoId={PRODUCTO_ID} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Editar formulación" }));
  await screen.findByRole("button", { name: "Guardar formulación" });
  await waitFor(() => expect(screen.queryByText("Cargando ingredientes...")).not.toBeInTheDocument());
  return user;
}

function enviado() {
  const llamadas = vi.mocked(formulationService.saveProductFormulation).mock.calls;
  expect(llamadas).toHaveLength(1);
  return llamadas[0][1];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(formulationService.listProductVersions).mockResolvedValue([]);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([HARINA, AGUA, SAL]);
});

describe("HU14 (PT14-16) — el editor de la formulación no muestra cantidad ni unidad", () => {
  it("la vista de lectura y el editor no tienen campos ni textos de cantidad", async () => {
    vi.mocked(formulationService.getProductFormulation).mockResolvedValue(formulacion(CON_CANTIDADES));
    render(<ProductFormulationSection productoId={PRODUCTO_ID} />);

    const lectura = await screen.findByRole("list", { name: "Ingredientes de la formulación" });
    expect(within(lectura).getAllByRole("listitem")).toHaveLength(2);
    expect(within(lectura).queryByText(/500|1,5|Sin cantidad/)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Editar formulación" }));
    const edicion = await screen.findByRole("list", { name: "Ingredientes de la formulación en edición" });

    expect(within(edicion).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(edicion).queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Cantidad de|Unidad de/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sin cantidad|Sin unidad|Opcional/)).not.toBeInTheDocument();
    expect(screen.queryByText(/La cantidad y la unidad/)).not.toBeInTheDocument();
  });

  it("guardar SIN cambios reenvía cantidad, unidad y notas tal como vinieron, sin ningún null", async () => {
    const user = await abrirEditor(CON_CANTIDADES);

    await user.click(screen.getByRole("button", { name: "Guardar formulación" }));

    await waitFor(() => expect(formulationService.saveProductFormulation).toHaveBeenCalledTimes(1));
    const payload = enviado();
    expect(payload).toStrictEqual({
      lineas: [
        { ingrediente_id: HARINA.id, cantidad: "500.000", unidad: "g" },
        { ingrediente_id: AGUA.id, cantidad: "1.500", unidad: "kg", notas: "Tibia" },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain("null");
  });

  it("agregar un ingrediente reenvía las cantidades guardadas intactas y la línea nueva viaja sin cantidad", async () => {
    const user = await abrirEditor(CON_CANTIDADES);

    await user.selectOptions(screen.getByRole("combobox", { name: "Ingrediente para agregar" }), String(SAL.id));
    await user.click(screen.getByRole("button", { name: "+ Agregar ingrediente" }));
    await user.click(screen.getByRole("button", { name: "Guardar formulación" }));

    await waitFor(() => expect(formulationService.saveProductFormulation).toHaveBeenCalledTimes(1));
    expect(enviado()).toStrictEqual({
      lineas: [
        { ingrediente_id: HARINA.id, cantidad: "500.000", unidad: "g" },
        { ingrediente_id: AGUA.id, cantidad: "1.500", unidad: "kg", notas: "Tibia" },
        { ingrediente_id: SAL.id },
      ],
    });
  });

  it("quitar un ingrediente conserva las cantidades de los demás", async () => {
    const user = await abrirEditor(CON_CANTIDADES);

    await user.click(screen.getByRole("button", { name: "Quitar Agua" }));
    await user.click(screen.getByRole("button", { name: "Guardar formulación" }));

    await waitFor(() => expect(formulationService.saveProductFormulation).toHaveBeenCalledTimes(1));
    expect(enviado()).toStrictEqual({
      lineas: [{ ingrediente_id: HARINA.id, cantidad: "500.000", unidad: "g" }],
    });
  });

  it("una formulación sin cantidades se guarda sin cantidades (no se inventan ceros ni nulos)", async () => {
    const user = await abrirEditor([linea(1, HARINA), linea(2, AGUA)]);

    await user.click(screen.getByRole("button", { name: "Guardar formulación" }));

    await waitFor(() => expect(formulationService.saveProductFormulation).toHaveBeenCalledTimes(1));
    expect(enviado()).toStrictEqual({ lineas: [{ ingrediente_id: HARINA.id }, { ingrediente_id: AGUA.id }] });
  });
});

describe("HU14 (PT14-16) — la ficha pública y la vista previa no muestran cantidades", () => {
  function archivos(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? archivos(join(dir, e.name)) : [join(dir, e.name)],
    );
  }

  const rutas = [
    ...archivos("src/components/fichaPublica"),
    "src/pages/FichaPublica.tsx",
    "src/pages/VistaPreviaFicha.tsx",
    "src/types/consultaPublica.ts",
  ];

  it("encuentra los archivos que debe revisar", () => {
    expect(rutas.length).toBeGreaterThanOrEqual(5);
  });

  it("ninguno de esos archivos lee ni muestra la cantidad o la unidad de un ingrediente", () => {
    const infractores = rutas.filter((ruta) => /\bcantidad\b|formatFormulacionCantidad/.test(readFileSync(ruta, "utf8")));
    expect(infractores).toEqual([]);
  });
});
