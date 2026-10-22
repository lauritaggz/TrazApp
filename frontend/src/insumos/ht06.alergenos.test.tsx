import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import AlergenosSelector from "@/components/insumos/AlergenosSelector";
import InsumoAllergensSection from "@/components/insumos/InsumoAllergensSection";
import InsumoCreateDialog from "@/components/insumos/InsumoCreateDialog";
import { MENSAJE_ALERGENOS_INVALIDOS } from "@/lib/alergenosDeclaracion";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as ingredientService from "@/services/ingredientService";
import * as insumoService from "@/services/insumoService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { AlergenoCatalogo, Ingrediente } from "@/types/ingredient";
import { ALERGENOS_VACIOS, type AlergenoDeclarado, type AlergenosValue, type Insumo } from "@/types/insumo";

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
  replaceInsumoAlergenos: vi.fn(),
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

// --- datos ---

const LECHE: Ingrediente = {
  id: 1,
  productor_id: 1,
  codigo_interno: "ING-1",
  nombre: "Leche",
  descripcion: null,
  tipo: null,
  activo: true,
  created_at: "2026-10-01T12:00:00Z",
};

const CATALOGO: AlergenoCatalogo[] = [
  { id: 1, codigo: "lacteos", nombre: "Leche", obligatorio_chile: true },
  { id: 2, codigo: "cacahuetes", nombre: "Maní", obligatorio_chile: true },
  { id: 4, codigo: "sesamo", nombre: "Sésamo", obligatorio_chile: false },
];

const DECLARADOS: AlergenoDeclarado[] = [
  { alergeno_id: 1, codigo: "lacteos", nombre: "Leche", obligatorio_chile: true, tipo: "contiene" },
];

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

const SIN_REVISAR = insumo({ id: 11, nombre: "Chocolate sin revisar", alergenos_revisados: false, alergenos_revisados_at: null });
const REVISADO_SIN_ALERGENOS = insumo({ id: 12, nombre: "Sal de mesa" });
const REVISADO_CON_ALERGENOS = insumo({ id: 13, nombre: "Leche entera", alergenos_declarados: DECLARADOS });

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([LECHE]);
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue(CATALOGO);
  vi.mocked(insumoService.listInsumos).mockResolvedValue([SIN_REVISAR, REVISADO_SIN_ALERGENOS, REVISADO_CON_ALERGENOS]);
  vi.mocked(insumoService.getInsumo).mockImplementation(async (id) => {
    const found = [SIN_REVISAR, REVISADO_SIN_ALERGENOS, REVISADO_CON_ALERGENOS].find((item) => item.id === id);
    if (!found) throw new ApiError("Insumo no encontrado", 404);
    return found;
  });
  vi.mocked(insumoService.listInsumoAlergenos).mockResolvedValue([]);
});

type Usuario = ReturnType<typeof userEvent.setup>;

/** Declares an allergen with the add form of the selector (inside `contenedor`). */
async function declarar(user: Usuario, contenedor: HTMLElement, alergenoId: string, tipo?: "trazas") {
  await user.click(await within(contenedor).findByRole("button", { name: "+ Agregar alérgeno" }));
  await user.selectOptions(within(contenedor).getByLabelText("Alérgeno del catálogo"), alergenoId);
  if (tipo) await user.selectOptions(within(contenedor).getByLabelText("Tipo de declaración"), tipo);
  await user.click(within(contenedor).getByRole("button", { name: "Agregar" }));
}

// --- el selector controlado ---

function Controlado({
  inicial = ALERGENOS_VACIOS,
  mostrarError = false,
  onValue,
}: {
  inicial?: AlergenosValue;
  mostrarError?: boolean;
  onValue?: (value: AlergenosValue) => void;
}) {
  const [value, setValue] = useState(inicial);
  return (
    <AlergenosSelector
      value={value}
      mostrarError={mostrarError}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
}

function grupo() {
  return screen.getByRole("group", { name: "Alérgenos del insumo" });
}

describe("AlergenosSelector: los tres estados", () => {
  it("sin declarar: lista vacía, la casilla se puede marcar y no hay mensaje de error", async () => {
    render(<Controlado />);

    expect(await screen.findByRole("button", { name: "+ Agregar alérgeno" })).toBeInTheDocument();
    const casilla = within(grupo()).getByLabelText("Este insumo no contiene alérgenos");
    expect(casilla).not.toBeChecked();
    expect(casilla).toBeEnabled();
    // HT07: una sola frase, no dos grupos vacíos con «No hay alérgenos declarados como …».
    expect(screen.getByText("Aún no declaraste alérgenos.")).toBeInTheDocument();
    expect(screen.queryByText(/No hay alérgenos declarados como/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Contiene" })).not.toBeInTheDocument();
    expect(screen.queryByText(MENSAJE_ALERGENOS_INVALIDOS)).not.toBeInTheDocument();
  });

  it("con alérgenos de un solo tipo, el otro grupo dice que no hay (y la frase única desaparece) (HT07)", async () => {
    render(<Controlado inicial={{ items: [{ alergeno_id: 1, tipo: "contiene" }], sinAlergenos: false }} />);

    expect(await screen.findByRole("region", { name: "Contiene" })).toBeInTheDocument();
    expect(screen.getByText("No hay alérgenos declarados como «Puede contener».")).toBeInTheDocument();
    expect(screen.queryByText("Aún no declaraste alérgenos.")).not.toBeInTheDocument();
  });

  it("las áreas táctiles son de 44 px: la casilla (toda la fila) y los botones de cada alérgeno (HT07)", async () => {
    render(<Controlado inicial={{ items: [{ alergeno_id: 1, tipo: "contiene" }], sinAlergenos: false }} />);
    await screen.findByRole("region", { name: "Contiene" });

    expect(screen.getByLabelText("Este insumo no contiene alérgenos").closest("label")).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: /Cambiar .* a Puede contener/ })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: /Quitar alérgeno/ })).toHaveClass("h-11", "w-11");
    // No quedan pegados: separados por un espacio y con salto de línea si no caben.
    expect(screen.getByRole("button", { name: /Quitar alérgeno/ }).parentElement).toHaveClass("gap-2", "flex-wrap");
  });

  it("con alérgenos: los muestra por tipo, con la marca de rotulación obligatoria, y la casilla no se puede marcar", async () => {
    render(
      <Controlado
        inicial={{
          items: [
            { alergeno_id: 1, tipo: "contiene" },
            { alergeno_id: 4, tipo: "trazas" },
          ],
          sinAlergenos: false,
        }}
      />,
    );

    const contiene = await screen.findByRole("region", { name: "Contiene" });
    expect(within(contiene).getByText("Leche")).toBeInTheDocument();
    expect(within(contiene).getByText(/Rotulación obligatoria/)).toBeInTheDocument();
    const trazas = screen.getByRole("region", { name: "Puede contener" });
    expect(within(trazas).getByText("Sésamo")).toBeInTheDocument();
    expect(within(trazas).queryByText(/Rotulación obligatoria/)).not.toBeInTheDocument();
    const casilla = screen.getByLabelText("Este insumo no contiene alérgenos");
    expect(casilla).not.toBeChecked();
    expect(casilla).toBeDisabled();
    expect(screen.getByText("Quita los alérgenos declarados para poder marcar esta opción.")).toBeInTheDocument();
  });

  it("«no contiene alérgenos»: la casilla marcada deja el valor válido sin lista", async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlado onValue={onValue} />);

    await user.click(await screen.findByLabelText("Este insumo no contiene alérgenos"));

    expect(screen.getByLabelText("Este insumo no contiene alérgenos")).toBeChecked();
    expect(onValue).toHaveBeenLastCalledWith({ items: [], sinAlergenos: true });
  });
});

describe("AlergenosSelector: comportamiento", () => {
  it("al agregar un alérgeno la casilla marcada se desmarca sola y queda deshabilitada", async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlado inicial={{ items: [], sinAlergenos: true }} onValue={onValue} />);
    expect(await screen.findByLabelText("Este insumo no contiene alérgenos")).toBeChecked();

    await declarar(user, grupo(), "1");

    const casilla = screen.getByLabelText("Este insumo no contiene alérgenos");
    expect(casilla).not.toBeChecked();
    expect(casilla).toBeDisabled();
    expect(onValue).toHaveBeenLastCalledWith({ items: [{ alergeno_id: 1, tipo: "contiene" }], sinAlergenos: false });
  });

  it("quitar el último alérgeno vuelve a permitir la casilla, que sigue desmarcada", async () => {
    const user = userEvent.setup();
    render(<Controlado inicial={{ items: [{ alergeno_id: 1, tipo: "contiene" }], sinAlergenos: false }} />);

    await user.click(await screen.findByRole("button", { name: "Quitar alérgeno Leche" }));

    const casilla = screen.getByLabelText("Este insumo no contiene alérgenos");
    expect(casilla).toBeEnabled();
    expect(casilla).not.toBeChecked();
  });

  it("agrega con el tipo elegido, cambia el tipo y quita, todo sin llamar a la API de insumos", async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlado onValue={onValue} />);

    await declarar(user, grupo(), "2", "trazas");
    expect(onValue).toHaveBeenLastCalledWith({ items: [{ alergeno_id: 2, tipo: "trazas" }], sinAlergenos: false });
    await user.click(screen.getByRole("button", { name: "Cambiar Maní a Contiene" }));
    expect(onValue).toHaveBeenLastCalledWith({ items: [{ alergeno_id: 2, tipo: "contiene" }], sinAlergenos: false });
    await user.click(screen.getByRole("button", { name: "Quitar alérgeno Maní" }));
    expect(onValue).toHaveBeenLastCalledWith({ items: [], sinAlergenos: false });

    expect(insumoService.addInsumoAlergeno).not.toHaveBeenCalled();
    expect(insumoService.updateInsumoAlergenoTipo).not.toHaveBeenCalled();
    expect(insumoService.deleteInsumoAlergeno).not.toHaveBeenCalled();
    expect(insumoService.replaceInsumoAlergenos).not.toHaveBeenCalled();
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
  });

  it("agrupa el catálogo en obligatorios y otros, y no ofrece los ya declarados", async () => {
    const user = userEvent.setup();
    render(<Controlado inicial={{ items: [{ alergeno_id: 1, tipo: "contiene" }], sinAlergenos: false }} />);

    await user.click(await screen.findByRole("button", { name: "+ Agregar alérgeno" }));

    const select = screen.getByLabelText("Alérgeno del catálogo");
    expect(within(select).queryByRole("option", { name: "Leche" })).not.toBeInTheDocument();
    expect(within(within(select).getByRole("group", { name: "Declaración obligatoria" })).getByRole("option", { name: "Maní" })).toBeInTheDocument();
    expect(within(within(select).getByRole("group", { name: "Otros alérgenos" })).getByRole("option", { name: "Sésamo" })).toBeInTheDocument();
  });

  it("pide elegir un alérgeno antes de agregar", async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlado onValue={onValue} />);

    await user.click(await screen.findByRole("button", { name: "+ Agregar alérgeno" }));
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(screen.getByText("Selecciona un alérgeno del catálogo.")).toBeInTheDocument();
    expect(onValue).not.toHaveBeenCalled();
  });

  it("si falla el catálogo lo informa y permite reintentar", async () => {
    vi.mocked(ingredientService.listAlergenosCatalog).mockRejectedValueOnce(new Error("falla"));
    const user = userEvent.setup();
    render(<Controlado />);

    expect(await screen.findByText("No pudimos cargar el catálogo de alérgenos.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Agregar alérgeno" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("button", { name: "+ Agregar alérgeno" })).toBeInTheDocument();
  });
});

describe("AlergenosSelector: validación y accesibilidad", () => {
  it("inválido (sin alérgenos y sin confirmar) muestra el mensaje cuando se pide mostrarlo", async () => {
    render(<Controlado mostrarError />);

    const mensaje = await screen.findByText(MENSAJE_ALERGENOS_INVALIDOS);
    expect(mensaje).toHaveAttribute("role", "alert");
    expect(MENSAJE_ALERGENOS_INVALIDOS).toBe("Declara los alérgenos del insumo o confirma que no contiene.");
  });

  it("el mensaje está ligado con aria-describedby al grupo y a la casilla", async () => {
    render(<Controlado mostrarError />);

    const mensaje = await screen.findByText(MENSAJE_ALERGENOS_INVALIDOS);
    const casilla = screen.getByLabelText("Este insumo no contiene alérgenos");
    expect(casilla.getAttribute("aria-describedby")).toContain(mensaje.id);
    expect(casilla).toHaveAttribute("aria-invalid", "true");
    expect(grupo().getAttribute("aria-describedby")).toContain(mensaje.id);
  });

  it("es un grupo con leyenda y la casilla tiene su etiqueta asociada", async () => {
    render(<Controlado />);

    expect(await screen.findByRole("group", { name: "Alérgenos del insumo" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Este insumo no contiene alérgenos" })).toBeInTheDocument();
  });

  it("no muestra el mensaje si todavía no se pide, ni cuando el valor es válido", async () => {
    const { rerender } = render(
      <AlergenosSelector value={ALERGENOS_VACIOS} onChange={() => undefined} mostrarError={false} />,
    );
    await screen.findByRole("button", { name: "+ Agregar alérgeno" });
    expect(screen.queryByText(MENSAJE_ALERGENOS_INVALIDOS)).not.toBeInTheDocument();

    rerender(<AlergenosSelector value={{ items: [], sinAlergenos: true }} onChange={() => undefined} mostrarError />);
    expect(screen.queryByText(MENSAJE_ALERGENOS_INVALIDOS)).not.toBeInTheDocument();
    rerender(
      <AlergenosSelector
        value={{ items: [{ alergeno_id: 1, tipo: "contiene" }], sinAlergenos: false }}
        onChange={() => undefined}
        mostrarError
      />,
    );
    expect(screen.queryByText(MENSAJE_ALERGENOS_INVALIDOS)).not.toBeInTheDocument();
  });

  it("el mensaje desaparece al declarar un alérgeno", async () => {
    const user = userEvent.setup();
    render(<Controlado mostrarError />);
    expect(await screen.findByText(MENSAJE_ALERGENOS_INVALIDOS)).toBeInTheDocument();

    await declarar(user, grupo(), "1");

    expect(screen.queryByText(MENSAJE_ALERGENOS_INVALIDOS)).not.toBeInTheDocument();
  });

  it("acepta un valor inicial (por ejemplo, sugerido por una fuente) y no lo da por revisado ni lo emite", async () => {
    const onValue = vi.fn();
    render(
      <Controlado inicial={{ items: [{ alergeno_id: 2, tipo: "trazas" }], sinAlergenos: false }} onValue={onValue} />,
    );

    const trazas = await screen.findByRole("region", { name: "Puede contener" });
    expect(within(trazas).getByText("Maní")).toBeInTheDocument();
    // Showing a starting value changes nothing and saves nothing: the review happens on saving the form.
    expect(onValue).not.toHaveBeenCalled();
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
    expect(insumoService.replaceInsumoAlergenos).not.toHaveBeenCalled();
  });
});

// --- el formulario de creación ---

function openPage(path: string) {
  return renderWithProviders(<App />, { initialEntries: [path] });
}

async function llenarDatos(user: Usuario) {
  await screen.findByRole("option", { name: "Leche" });
  await user.type(screen.getByLabelText("Nombre"), "Leche Colun Entera 1 L");
  await user.type(screen.getByLabelText("Marca u origen"), "Colun");
  await user.selectOptions(screen.getByLabelText("Ingrediente"), "1");
}

describe("Formulario de creación de insumo: alérgenos (HT06)", () => {
  it("incluye el selector de alérgenos", async () => {
    openPage("/insumos/nuevo");

    expect(await screen.findByRole("group", { name: "Alérgenos del insumo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alérgenos", level: 2 })).toBeInTheDocument();
  });

  it("no guarda sin declarar los alérgenos ni confirmar que no contiene: muestra el mensaje y enfoca la casilla", async () => {
    const user = userEvent.setup();
    openPage("/insumos/nuevo");
    await llenarDatos(user);

    await user.click(screen.getByRole("button", { name: "Crear insumo" }));

    expect(await screen.findByText(MENSAJE_ALERGENOS_INVALIDOS)).toBeInTheDocument();
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText("Este insumo no contiene alérgenos")).toHaveFocus());
  });

  it("envía la lista de alérgenos declarados en el mismo POST", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.createInsumo).mockResolvedValue(insumo({ id: 20 }));
    openPage("/insumos/nuevo");
    await llenarDatos(user);
    await declarar(user, grupo(), "1");
    await declarar(user, grupo(), "2", "trazas");

    await user.click(screen.getByRole("button", { name: "Crear insumo" }));

    await waitFor(() => expect(insumoService.createInsumo).toHaveBeenCalledTimes(1));
    expect(insumoService.createInsumo).toHaveBeenCalledWith(
      expect.objectContaining({
        ingrediente_id: 1,
        alergenos: [
          { alergeno_id: 1, tipo: "contiene" },
          { alergeno_id: 2, tipo: "trazas" },
        ],
      }),
    );
    expect(await screen.findByText("Insumo creado.")).toBeInTheDocument();
  });

  it("con «Este insumo no contiene alérgenos» envía una lista vacía", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.createInsumo).mockResolvedValue(insumo({ id: 20 }));
    openPage("/insumos/nuevo");
    await llenarDatos(user);
    await user.click(screen.getByLabelText("Este insumo no contiene alérgenos"));

    await user.click(screen.getByRole("button", { name: "Crear insumo" }));

    await waitFor(() =>
      expect(insumoService.createInsumo).toHaveBeenCalledWith(expect.objectContaining({ alergenos: [] })),
    );
    expect(screen.queryByText(MENSAJE_ALERGENOS_INVALIDOS)).not.toBeInTheDocument();
  });

  it("tras crear, el aviso no manda a declarar los alérgenos después", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.createInsumo).mockResolvedValue(insumo({ id: 20 }));
    openPage("/insumos/nuevo");
    await llenarDatos(user);
    await user.click(screen.getByLabelText("Este insumo no contiene alérgenos"));

    await user.click(screen.getByRole("button", { name: "Crear insumo" }));

    expect(await screen.findByText("Insumo creado.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Declarar alérgenos" })).not.toBeInTheDocument();
  });

  it("agregar un alérgeno cuenta como cambio sin guardar al salir", async () => {
    const user = userEvent.setup();
    openPage("/insumos/nuevo");
    await screen.findByRole("option", { name: "Leche" });
    await declarar(user, grupo(), "1");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByRole("heading", { name: "Salir sin guardar" })).toBeInTheDocument();
  });

  it("el formulario de edición no incluye el selector: los alérgenos se gestionan en el detalle", async () => {
    openPage("/insumos/12/editar");

    expect(await screen.findByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Alérgenos del insumo" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Este insumo no contiene alérgenos")).not.toBeInTheDocument();
  });

  it("editar un insumo sin cambios no exige declarar alérgenos ni envía nada", async () => {
    const user = userEvent.setup();
    openPage("/insumos/11/editar");
    await screen.findByLabelText("Nombre");

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(insumoService.updateInsumo).not.toHaveBeenCalled();
    expect(screen.queryByText(MENSAJE_ALERGENOS_INVALIDOS)).not.toBeInTheDocument();
  });
});

// --- el diálogo de la elaboración ---

describe("Diálogo «Crear insumo» de la elaboración: alérgenos (HT06)", () => {
  function abrirDialogo() {
    const onAssigned = vi.fn();
    const onCancel = vi.fn();
    render(
      <MemoryRouter>
        <InsumoCreateDialog ingrediente={{ id: 1, nombre: "Leche" }} onAssigned={onAssigned} onCancel={onCancel} />
      </MemoryRouter>,
    );
    return { onAssigned, onCancel, dialogo: screen.getByRole("dialog", { name: "Crear insumo" }) };
  }

  async function llenar(user: Usuario, dialogo: HTMLElement) {
    await user.type(within(dialogo).getByLabelText("Nombre"), "Leche Nueva 1 L");
    await user.type(within(dialogo).getByLabelText("Marca u origen"), "Nueva");
  }

  it("envía los alérgenos declarados en el mismo POST que crea el insumo", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.createInsumo).mockResolvedValue(insumo({ id: 40, alergenos_declarados: DECLARADOS }));
    const { dialogo, onAssigned } = abrirDialogo();
    await llenar(user, dialogo);
    await declarar(user, dialogo, "1");

    await user.click(within(dialogo).getByRole("button", { name: "Crear insumo" }));

    await waitFor(() => expect(onAssigned).toHaveBeenCalledWith(expect.objectContaining({ id: 40 })));
    expect(insumoService.createInsumo).toHaveBeenCalledTimes(1);
    expect(insumoService.createInsumo).toHaveBeenCalledWith(
      expect.objectContaining({
        ingrediente_id: 1,
        nombre: "Leche Nueva 1 L",
        alergenos: [{ alergeno_id: 1, tipo: "contiene" }],
      }),
    );
    expect(insumoService.replaceInsumoAlergenos).not.toHaveBeenCalled();
    expect(insumoService.addInsumoAlergeno).not.toHaveBeenCalled();
  });

  it("con «no contiene alérgenos» envía una lista vacía", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.createInsumo).mockResolvedValue(insumo({ id: 41 }));
    const { dialogo, onAssigned } = abrirDialogo();
    await llenar(user, dialogo);
    await user.click(within(dialogo).getByLabelText("Este insumo no contiene alérgenos"));

    await user.click(within(dialogo).getByRole("button", { name: "Crear insumo" }));

    await waitFor(() => expect(onAssigned).toHaveBeenCalled());
    expect(insumoService.createInsumo).toHaveBeenCalledWith(expect.objectContaining({ alergenos: [] }));
  });

  it("no registra el insumo sin declarar los alérgenos ni confirmar que no contiene", async () => {
    const user = userEvent.setup();
    const { dialogo, onAssigned } = abrirDialogo();
    await llenar(user, dialogo);

    await user.click(within(dialogo).getByRole("button", { name: "Crear insumo" }));

    expect(await within(dialogo).findByText(MENSAJE_ALERGENOS_INVALIDOS)).toBeInTheDocument();
    expect(insumoService.createInsumo).not.toHaveBeenCalled();
    expect(onAssigned).not.toHaveBeenCalled();
  });
});

// --- la sección de alérgenos del detalle ---

describe("Sección de alérgenos del detalle: estado y confirmación (HT06)", () => {
  it("sin revisar y sin alérgenos: lo indica y ofrece «Confirmar que no contiene alérgenos»", async () => {
    render(<InsumoAllergensSection insumoId={11} revisado={false} />);

    expect(await screen.findByText("Alérgenos sin revisar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar que no contiene alérgenos" })).toBeInTheDocument();
    expect(screen.queryByText("Sin alérgenos (revisado)")).not.toBeInTheDocument();
  });

  it("el botón llama al PUT con una lista vacía y el estado pasa a «Sin alérgenos (revisado)»", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.replaceInsumoAlergenos).mockResolvedValue(insumo({ id: 11 }));
    render(<InsumoAllergensSection insumoId={11} revisado={false} />);

    await user.click(await screen.findByRole("button", { name: "Confirmar que no contiene alérgenos" }));

    expect(insumoService.replaceInsumoAlergenos).toHaveBeenCalledTimes(1);
    expect(insumoService.replaceInsumoAlergenos).toHaveBeenCalledWith(11, []);
    expect(await screen.findByText("Sin alérgenos (revisado)")).toBeInTheDocument();
    expect(screen.queryByText("Alérgenos sin revisar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar que no contiene alérgenos" })).not.toBeInTheDocument();
  });

  it("si el PUT falla lo informa y el insumo sigue sin revisar", async () => {
    const user = userEvent.setup();
    vi.mocked(insumoService.replaceInsumoAlergenos).mockRejectedValue(new ApiError("Insumo no encontrado", 404));
    render(<InsumoAllergensSection insumoId={11} revisado={false} />);

    await user.click(await screen.findByRole("button", { name: "Confirmar que no contiene alérgenos" }));

    expect(await screen.findByText("Insumo no encontrado")).toBeInTheDocument();
    expect(screen.getByText("Alérgenos sin revisar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar que no contiene alérgenos" })).toBeInTheDocument();
  });

  it("revisado y sin alérgenos: muestra «Sin alérgenos (revisado)» y no ofrece confirmar", async () => {
    render(<InsumoAllergensSection insumoId={12} revisado />);

    expect(await screen.findByText("Sin alérgenos (revisado)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar que no contiene alérgenos" })).not.toBeInTheDocument();
    expect(screen.queryByText("Alérgenos sin revisar")).not.toBeInTheDocument();
  });

  it("con alérgenos declarados muestra la lista y ni el estado ni el botón, esté o no marcado como revisado", async () => {
    vi.mocked(insumoService.listInsumoAlergenos).mockResolvedValue(DECLARADOS);
    const { unmount } = render(<InsumoAllergensSection insumoId={13} revisado={false} />);

    expect(await screen.findByRole("button", { name: "Quitar alérgeno Leche" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar que no contiene alérgenos" })).not.toBeInTheDocument();
    expect(screen.queryByText("Alérgenos sin revisar")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin alérgenos (revisado)")).not.toBeInTheDocument();
    unmount();

    render(<InsumoAllergensSection insumoId={13} revisado />);
    expect(await screen.findByRole("button", { name: "Quitar alérgeno Leche" })).toBeInTheDocument();
    expect(screen.queryByText("Sin alérgenos (revisado)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar que no contiene alérgenos" })).not.toBeInTheDocument();
  });

  it("mantiene las llamadas inmediatas: agregar un alérgeno llama a su endpoint y quita el estado «sin revisar»", async () => {
    const user = userEvent.setup();
    const declarados: AlergenoDeclarado[] = [];
    vi.mocked(insumoService.listInsumoAlergenos).mockImplementation(async () => [...declarados]);
    vi.mocked(insumoService.addInsumoAlergeno).mockImplementation(async (_id, alergenoId, tipo) => {
      const item = { ...DECLARADOS[0], alergeno_id: alergenoId, tipo };
      declarados.push(item);
      return item;
    });
    render(<InsumoAllergensSection insumoId={11} revisado={false} />);
    await screen.findByText("Alérgenos sin revisar");

    await user.click(screen.getByRole("button", { name: "+ Agregar alérgeno" }));
    await user.selectOptions(screen.getByLabelText("Alérgeno del catálogo"), "1");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => expect(insumoService.addInsumoAlergeno).toHaveBeenCalledWith(11, 1, "contiene"));
    expect(await screen.findByRole("button", { name: "Quitar alérgeno Leche" })).toBeInTheDocument();
    expect(screen.queryByText("Alérgenos sin revisar")).not.toBeInTheDocument();
  });

  it("quitar el último alérgeno deja el insumo «Sin alérgenos (revisado)», no «sin revisar»", async () => {
    const user = userEvent.setup();
    let declarados: AlergenoDeclarado[] = [...DECLARADOS];
    vi.mocked(insumoService.listInsumoAlergenos).mockImplementation(async () => [...declarados]);
    vi.mocked(insumoService.deleteInsumoAlergeno).mockImplementation(async () => {
      declarados = [];
    });
    render(<InsumoAllergensSection insumoId={13} revisado />);

    await user.click(await screen.findByRole("button", { name: "Quitar alérgeno Leche" }));
    await user.click(await screen.findByRole("button", { name: "Quitar alérgeno" }));

    expect(await screen.findByText("Sin alérgenos (revisado)")).toBeInTheDocument();
    expect(screen.queryByText("Alérgenos sin revisar")).not.toBeInTheDocument();
  });

  it("en la página del detalle, un insumo sin revisar ofrece confirmar y uno revisado no", async () => {
    const { unmount } = openPage("/insumos/11");
    expect(await screen.findByRole("button", { name: "Confirmar que no contiene alérgenos" })).toBeInTheDocument();
    unmount();

    openPage("/insumos/12");
    expect(await screen.findByText("Sin alérgenos (revisado)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar que no contiene alérgenos" })).not.toBeInTheDocument();
  });
});

// --- filtro «Alérgenos sin revisar» (HT07) ---

describe("Listado de insumos: filtro «Alérgenos sin revisar» (HT07)", () => {
  const filas = () => screen.getAllByRole("row").slice(1);

  it("deja solo los insumos con los alérgenos sin revisar, con su chip, y se quita", async () => {
    const user = userEvent.setup();
    openPage("/insumos");
    await screen.findAllByText("Chocolate sin revisar");
    const todas = filas().length;
    expect(todas).toBeGreaterThan(1);

    await user.selectOptions(screen.getByLabelText("Filtrar por alérgenos"), "sin_revisar");

    expect(filas()).toHaveLength(1);
    expect(within(filas()[0]).getByText("Chocolate sin revisar")).toBeInTheDocument();
    const chip = screen.getByRole("button", { name: /Quitar.*Alérgenos sin revisar|Alérgenos sin revisar.*Quitar/ });
    await user.click(chip);
    expect(filas()).toHaveLength(todas);
  });

  it("el enlace del Dashboard (?alergenos=sin-revisar) abre el listado ya filtrado", async () => {
    openPage("/insumos?alergenos=sin-revisar");
    await screen.findAllByText("Chocolate sin revisar");

    expect(screen.getByLabelText("Filtrar por alérgenos")).toHaveValue("sin_revisar");
    expect(filas()).toHaveLength(1);
  });

  it("sin el parámetro el listado muestra todos", async () => {
    openPage("/insumos");
    await screen.findAllByText("Chocolate sin revisar");

    expect(screen.getByLabelText("Filtrar por alérgenos")).toHaveValue("todos");
  });
});

// --- la marca en el listado ---

describe("Listado de insumos: marca «Alérgenos sin revisar» (HT06)", () => {
  function filaDe(nombre: string): HTMLElement {
    const fila = screen.getAllByRole("row").find((row) => within(row).queryByText(nombre));
    if (!fila) throw new Error(`No hay fila para ${nombre}`);
    return fila;
  }

  it("marca los insumos con los alérgenos sin revisar", async () => {
    openPage("/insumos");
    await screen.findAllByText("Chocolate sin revisar");

    expect(within(filaDe("Chocolate sin revisar")).getByText("Alérgenos sin revisar")).toBeInTheDocument();
  });

  it("no marca como problema a los revisados, ni con alérgenos ni sin alérgenos", async () => {
    openPage("/insumos");
    await screen.findAllByText("Chocolate sin revisar");

    expect(within(filaDe("Sal de mesa")).queryByText("Alérgenos sin revisar")).not.toBeInTheDocument();
    expect(within(filaDe("Leche entera")).queryByText("Alérgenos sin revisar")).not.toBeInTheDocument();
  });

  it("la marca aparece también en la tarjeta del celular, solo para el insumo sin revisar", async () => {
    openPage("/insumos");
    await screen.findAllByText("Chocolate sin revisar");

    // One in the table and one in the card of the unreviewed supply: the other two have none. (The filter
    // «Alérgenos sin revisar» of HT07 is an <option>, not a badge.)
    expect(screen.getAllByText("Alérgenos sin revisar", { selector: "span" })).toHaveLength(2);
    const tarjetas = screen.getAllByRole("article");
    const marcadas = tarjetas.filter((tarjeta) => within(tarjeta).queryByText("Alérgenos sin revisar"));
    expect(marcadas).toHaveLength(1);
    expect(within(marcadas[0]).getByText("Chocolate sin revisar")).toBeInTheDocument();
  });
});
