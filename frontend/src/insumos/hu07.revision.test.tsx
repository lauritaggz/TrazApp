/**
 * "Nuevo insumo" (HU07 / T07-06), with the API simulated: the first screen with three ways to start, the
 * search by name or brand in Jumbo, the hit that preloads the form, the duplicate notice and the origin of
 * what the productor confirms (fuentes_campos, campos_editados, fuentes_por_alergeno).
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
  return abrir("/insumos/nuevo/nombre");
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

// =============================================================================================
// La revisión del insumo (T07-07, entrega B): fuente por campo y por alérgeno, "puede contener" (CA17),
// términos sin reconocer (CA5), "libre de" (CA16), requisitos para confirmar y el mismo diseño para editar.

const COMBINADA: ConsultaCodigo = {
  ...PROPUESTA,
  fuente: "combinada",
  fuentes_campos: {
    nombre: "open_food_facts",
    marca_origen: "open_food_facts",
    presentacion: "open_food_facts",
    ingredientes_declarados: "jumbo",
  },
  alergenos: {
    contiene: [
      {
        alergeno_id: 1,
        codigo: "lacteos",
        nombre: "Leche",
        origen: "etiqueta",
        fuentes: ["open_food_facts", "ingredientes"],
      },
    ],
    trazas: [{ alergeno_id: 2, codigo: "soja", nombre: "Soya", origen: "etiqueta", fuentes: ["jumbo"] }],
    sin_reconocer: [],
  },
  ficha: {
    url: "https://off.test/1",
    jumbo: { url: `https://www.jumbo.cl/${SLUG}/p`, condiciones_alimentarias: ["Libre de Lactosa", "Libre de Gluten"] },
  },
};

async function abrirRevision(consulta: ConsultaCodigo) {
  vi.mocked(insumoService.consultarResultadoDeBusqueda).mockResolvedValue(consulta);
  const user = await abrirBusquedaPorNombre();
  await buscar(user, "queso quilque");
  await elegirPrimero(user);
  return user;
}

const requisito = (texto: RegExp) =>
  within(screen.getByRole("list", { name: "Requisitos para confirmar" })).getByText(texto);

describe("Revisión: fuente de cada campo y de cada alérgeno (CA15)", () => {
  it("título, aviso de combinación y marcas de las fuentes usadas", async () => {
    await abrirRevision(COMBINADA);

    expect(screen.getByRole("heading", { name: "Revisar información combinada", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("· Revisión final")).toBeInTheDocument();
    expect(
      screen.getByText("Fichas combinadas. El código de barras de Jumbo coincide con el de Open Food Facts."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/con seguridad/)).not.toBeInTheDocument();
    const marcas = screen.getByRole("list", { name: "Fuentes de la ficha" });
    expect(within(marcas).getByText(/Jumbo/)).toHaveTextContent("(usada)");
    expect(within(marcas).getByText(/Open Food Facts/)).toHaveTextContent("(usada)");
  });

  it("cada campo dice solo la fuente que realmente usó; el código, ambas porque coincidió en ambas", async () => {
    await abrirRevision(COMBINADA);

    const tarjeta = screen.getByRole("heading", { name: "Identificación comercial" }).closest("section") as HTMLElement;
    // Name, brand and presentation come from Open Food Facts: one source each, never «Jumbo · Open Food Facts».
    expect(within(tarjeta).getAllByText("Open Food Facts", { selector: "strong" })).toHaveLength(3);
    expect(within(tarjeta).getByText("Open Food Facts · Jumbo", { selector: "strong" })).toBeInTheDocument();
    const ingredientes = screen.getByRole("heading", { name: "Ingredientes declarados" }).closest("section") as HTMLElement;
    expect(within(ingredientes).getAllByText("Jumbo", { selector: "strong,span" }).length).toBeGreaterThan(0);
  });

  it("una sola fuente: el código dice solo esa fuente y no hay aviso de combinación", async () => {
    await abrirRevision(PROPUESTA);

    expect(screen.getByRole("heading", { name: "Revisar información recuperada", level: 2 })).toBeInTheDocument();
    expect(screen.queryByText(/Fichas combinadas/)).not.toBeInTheDocument();
    const tarjeta = screen.getByRole("heading", { name: "Identificación comercial" }).closest("section") as HTMLElement;
    expect(within(tarjeta).getAllByText("Jumbo", { selector: "strong" }).length).toBe(4);
  });

  it("cada alérgeno lista las fuentes que lo nombran", async () => {
    await abrirRevision(COMBINADA);

    const contiene = screen.getByRole("group", { name: "Contiene" });
    expect(within(contiene).getByText("Fuentes: Open Food Facts · Detectado en los ingredientes")).toBeInTheDocument();
    const trazas = screen.getByRole("group", { name: "Puede contener" });
    expect(within(trazas).getByText("Fuentes: Jumbo")).toBeInTheDocument();
  });

  it("lo que el productor cambió dice «Modificado por ti» o «Agregado por ti»", async () => {
    const user = await abrirRevision({
      ...COMBINADA,
      producto: { ...COMBINADA.producto!, presentacion: null },
    });
    const tarjeta = screen.getByRole("heading", { name: "Identificación comercial" }).closest("section") as HTMLElement;

    await user.clear(campo("Nombre"));
    await user.type(campo("Nombre"), "Otro nombre");
    await user.type(campo("Presentación"), "1 kg");

    expect(within(tarjeta).getByText("Modificado por ti", { selector: "strong" })).toBeInTheDocument();
    expect(within(tarjeta).getByText("Agregado por ti", { selector: "strong" })).toBeInTheDocument();
  });

  it("un alérgeno que el productor agrega o cambia de columna lo dice, y los demás conservan sus fuentes", async () => {
    const user = await abrirRevision(COMBINADA);

    await user.click(screen.getByRole("button", { name: "Agregar Sésamo a Contiene" }));
    await user.click(screen.getByRole("button", { name: "Cambiar Soya a Contiene" }));

    const contiene = screen.getByRole("group", { name: "Contiene" });
    expect(within(contiene).getByText("Fuentes: Agregado por ti")).toBeInTheDocument();
    expect(within(contiene).getByText("Fuentes: Modificado por ti")).toBeInTheDocument();
    expect(within(contiene).getByText("Fuentes: Open Food Facts · Detectado en los ingredientes")).toBeInTheDocument();
  });

  it("el origen de la ficha muestra la fecha de cada fuente (CA11)", async () => {
    await abrirRevision(COMBINADA);

    const origen = screen.getByRole("heading", { name: "Origen de la ficha" }).closest("div") as HTMLElement;
    expect(within(origen).getAllByText("Recuperado el 6 de noviembre de 2026")).toHaveLength(2);
  });

  it("una ficha manual no muestra fuentes, marcas ni origen", async () => {
    await abrir("/insumos/nuevo/manual");

    expect(screen.getByRole("heading", { name: "Completar ficha manual", level: 2 })).toBeInTheDocument();
    expect(screen.queryByText(/^Fuente:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fuentes:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Origen de la ficha" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Fuentes de la ficha" })).not.toBeInTheDocument();
  });
});

describe("Revisión: avisos de las fuentes", () => {
  it("Jumbo no respondió a tiempo: lo dice y continúa con Open Food Facts", async () => {
    await abrirRevision({ ...PROPUESTA, fuente: "open_food_facts", fuentes_sin_respuesta: ["jumbo"] });

    expect(screen.getByText("Jumbo no respondió a tiempo")).toBeInTheDocument();
    expect(screen.getByText(/Continuamos con la información encontrada en Open Food Facts/)).toBeInTheDocument();
  });

  it("no encontró el mismo código en Jumbo: lo dice para no mezclar productos", async () => {
    await abrirRevision({ ...PROPUESTA, fuente: "open_food_facts" });

    expect(screen.getByText("No encontramos el mismo código en Jumbo")).toBeInTheDocument();
    expect(screen.getByText(/continuamos solo con Open Food Facts/)).toBeInTheDocument();
  });

  it("combinada: ninguno de los dos avisos", async () => {
    await abrirRevision(COMBINADA);

    expect(screen.queryByText("Jumbo no respondió a tiempo")).not.toBeInTheDocument();
    expect(screen.queryByText("No encontramos el mismo código en Jumbo")).not.toBeInTheDocument();
  });
});

describe("Revisión: «libre de», «puede contener» y términos sin reconocer", () => {
  it("«Libre de…» es información aparte y nunca quita un alérgeno (CA16)", async () => {
    await abrirRevision(COMBINADA);

    const libre = screen.getByText("Indicaciones “Libre de…”").closest("div") as HTMLElement;
    expect(within(libre).getByText("Libre de Lactosa")).toBeInTheDocument();
    expect(within(libre).getByText("Libre de Gluten")).toBeInTheDocument();
    // The milk stays in «Contiene» in spite of «Libre de Lactosa».
    expect(within(screen.getByRole("group", { name: "Contiene" })).getByText("Leche")).toBeInTheDocument();
    expect(screen.getByText(/nunca elimina un alérgeno/)).toBeInTheDocument();
  });

  it("sin «libre de» no hay ese cuadro", async () => {
    await abrirRevision(PROPUESTA);
    expect(screen.queryByText("Indicaciones “Libre de…”")).not.toBeInTheDocument();
  });

  it("si ninguna fuente informa «puede contener» pregunta, y sin responder las «Trazas verificadas» quedan pendientes (CA17)", async () => {
    const user = await abrirRevision({
      ...COMBINADA,
      alergenos: { ...COMBINADA.alergenos, trazas: [] },
    });

    expect(screen.getByText("Ninguna fuente informa “puede contener”")).toBeInTheDocument();
    expect(screen.getByText("Revisa el envase y elige una respuesta antes de continuar.")).toBeInTheDocument();
    expect(requisito(/Trazas verificadas/)).toHaveTextContent("(pendiente)");

    await user.click(screen.getByRole("button", { name: "El envase no indica “puede contener”" }));

    expect(requisito(/Trazas verificadas/)).toHaveTextContent("(listo)");
  });

  it("«El envase indica…» pide elegir alérgenos: con uno agregado las trazas quedan verificadas", async () => {
    const user = await abrirRevision({
      ...COMBINADA,
      alergenos: { ...COMBINADA.alergenos, trazas: [] },
    });

    await user.click(screen.getByRole("button", { name: "El envase indica…" }));
    expect(screen.getByText("Selecciona los alérgenos indicados")).toBeInTheDocument();
    expect(requisito(/Trazas verificadas/)).toHaveTextContent("(pendiente)");

    await user.click(screen.getByRole("button", { name: "Agregar Sésamo a Puede contener" }));

    expect(requisito(/Trazas verificadas/)).toHaveTextContent("(listo)");
    expect(within(screen.getByRole("group", { name: "Puede contener" })).getByText("Fuentes: Agregado por ti")).toBeInTheDocument();
  });

  it("si alguna fuente informó «puede contener» no hay pregunta y las trazas ya están verificadas", async () => {
    await abrirRevision(COMBINADA);

    expect(screen.queryByText("Ninguna fuente informa “puede contener”")).not.toBeInTheDocument();
    expect(requisito(/Trazas verificadas/)).toHaveTextContent("(listo)");
  });

  it("términos sin reconocer: «Asignar a…» lo agrega al catálogo como «Agregado por ti» y cuenta como decisión", async () => {
    const user = await abrirRevision({
      ...COMBINADA,
      alergenos: { ...COMBINADA.alergenos, sin_reconocer: ["ajonjolí"] },
    });
    expect(requisito(/Alérgenos revisados/)).toHaveTextContent("(pendiente)");

    await user.click(screen.getByRole("button", { name: "Asignar “ajonjolí” a un alérgeno" }));
    await user.selectOptions(screen.getByLabelText("Alérgeno para “ajonjolí”"), "4");
    await user.selectOptions(screen.getByLabelText("Tipo para “ajonjolí”"), "trazas");
    await user.click(screen.getByRole("button", { name: "Asignar" }));

    expect(screen.getByText("Asignado a Sésamo")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Puede contener" })).getByText("Sésamo")).toBeInTheDocument();
    expect(requisito(/Alérgenos revisados/)).toHaveTextContent("(listo)");
  });

  it("términos sin reconocer: «No es un alérgeno» también es una decisión y no agrega nada", async () => {
    const user = await abrirRevision({
      ...COMBINADA,
      alergenos: { ...COMBINADA.alergenos, sin_reconocer: ["harina"] },
    });

    await user.click(screen.getByRole("button", { name: "“harina” no es un alérgeno" }));

    expect(screen.getByText("No es un alérgeno")).toBeInTheDocument();
    expect(requisito(/Alérgenos revisados/)).toHaveTextContent("(listo)");
    expect(screen.queryByRole("button", { name: "Quitar alérgeno Harina" })).not.toBeInTheDocument();
  });

  it("«no contiene alérgenos» aparece en «Contiene» y, con «Contiene» vacío, es lo que revisa los alérgenos", async () => {
    const user = await abrirRevision({
      ...COMBINADA,
      alergenos: { contiene: [], trazas: COMBINADA.alergenos.trazas, sin_reconocer: [] },
    });
    const contiene = screen.getByRole("group", { name: "Contiene" });

    expect(within(contiene).getByLabelText("Este insumo no contiene alérgenos")).not.toBeChecked();
    expect(requisito(/Alérgenos revisados/)).toHaveTextContent("(pendiente)");

    await user.click(within(contiene).getByLabelText("Este insumo no contiene alérgenos"));

    expect(requisito(/Alérgenos revisados/)).toHaveTextContent("(listo)");
  });
});

describe("Revisión: requisitos para confirmar y estructura", () => {
  it("el botón se habilita solo con las 4 filas: información, ingrediente, trazas y alérgenos", async () => {
    const user = await abrirRevision(COMBINADA);
    const confirmar = screen.getByRole("button", { name: "Confirmar registro" });
    expect(requisito(/Información comercial revisada/)).toHaveTextContent("(listo)");
    expect(requisito(/Trazas verificadas/)).toHaveTextContent("(listo)");
    expect(requisito(/Alérgenos revisados/)).toHaveTextContent("(listo)");
    expect(requisito(/Ingrediente asociado/)).toHaveTextContent("(pendiente)");
    expect(confirmar).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "Leche" }));

    expect(requisito(/Ingrediente asociado/)).toHaveTextContent("(listo)");
    expect(confirmar).toBeEnabled();
  });

  it("«Información comercial revisada» exige los campos obligatorios del backend: nombre y marca", async () => {
    const user = await abrirRevision(COMBINADA);
    await user.click(screen.getByRole("radio", { name: "Leche" }));

    await user.clear(campo("Marca u origen"));

    expect(requisito(/Información comercial revisada/)).toHaveTextContent("(pendiente)");
    expect(screen.getByRole("button", { name: "Confirmar registro" })).toBeDisabled();
  });

  it("columna derecha: ingrediente, «Crear ingrediente», «Insumo habitual», confirmación y origen; a la izquierda, los datos", async () => {
    await abrirRevision(COMBINADA);

    const lateral = screen.getByRole("heading", { name: "Asociar a un ingrediente" }).closest("aside") as HTMLElement;
    expect(within(lateral).getByRole("button", { name: "Crear ingrediente" })).toBeInTheDocument();
    expect(within(lateral).getByRole("checkbox", { name: "Insumo habitual" })).toBeInTheDocument();
    expect(within(lateral).getByRole("heading", { name: "Confirmar registro" })).toBeInTheDocument();
    expect(within(lateral).getByRole("heading", { name: "Origen de la ficha" })).toBeInTheDocument();
    expect(within(lateral).queryByLabelText("Nombre")).not.toBeInTheDocument();
  });

  it("identificación en grilla de 2 columnas y «Advertencias» dentro de «Ingredientes declarados»", async () => {
    await abrirRevision(COMBINADA);

    const tarjeta = screen.getByRole("heading", { name: "Identificación comercial" }).closest("section") as HTMLElement;
    const grilla = campo("Nombre").closest(".grid") as HTMLElement;
    expect(grilla).toHaveClass("sm:grid-cols-2");
    expect(within(grilla).getByLabelText("Marca u origen")).toBeInTheDocument();
    expect(within(grilla).getByLabelText("Presentación")).toBeInTheDocument();
    expect(within(grilla).getByLabelText("Código de barras")).toBeInTheDocument();
    expect(tarjeta).toContainElement(grilla);
    const ingredientes = screen.getByRole("heading", { name: "Ingredientes declarados" }).closest("section") as HTMLElement;
    expect(within(ingredientes).getByLabelText("Advertencias")).toBeInTheDocument();
  });

  it("«Opcional» es una etiqueta junto al nombre del campo y no hay textos de ayuda repetidos", async () => {
    await abrirRevision(COMBINADA);

    for (const nombre of ["Presentación", "Código de barras", "Advertencias"]) {
      const etiqueta = screen.getByText(nombre, { selector: "label" });
      expect(etiqueta.parentElement).toHaveTextContent("Opcional");
    }
    expect(screen.queryByText("Tal como aparecen en el envase.")).not.toBeInTheDocument();
    expect(screen.getAllByText("Opcional")).toHaveLength(3);
  });

  it("«Agregar alérgeno» está en las dos columnas", async () => {
    await abrirRevision(COMBINADA);

    for (const columna of ["Contiene", "Puede contener"]) {
      const grupo = screen.getByRole("group", { name: columna });
      expect(within(grupo).getByText("Agregar alérgeno")).toBeInTheDocument();
    }
  });

  it("el ingrediente es una lista de opciones de 44 px con altura máxima y desplazamiento", async () => {
    await abrirRevision(COMBINADA);

    const grupo = screen.getByRole("radiogroup", { name: "Ingrediente" });
    expect(grupo).toHaveClass("max-h-64", "overflow-y-auto");
    for (const radio of within(grupo).getAllByRole("radio")) {
      expect(radio.closest("label")).toHaveClass("min-h-11");
    }
  });
});

describe("Editar un insumo con el mismo diseño", () => {
  const FICHA_CON_FUENTES = {
    url: "https://off.test/1",
    fuentes: [
      { fuente: "open_food_facts", fecha: "2026-11-01T12:00:00+00:00", campos: ["nombre", "marca_origen"] },
      { fuente: "jumbo", fecha: "2026-11-01T12:00:00+00:00", campos: ["ingredientes_declarados", "alergenos"] },
      { fuente: "manual", fecha: "2026-11-02T12:00:00+00:00", campos: ["presentacion"] },
    ],
  };

  async function abrirEdicion(ficha: Record<string, unknown> | null, fuente = "combinada") {
    vi.mocked(insumoService.getInsumo).mockResolvedValue(
      insumo({ ficha, fuente, fecha_recuperacion: ficha ? "2026-11-01T12:00:00Z" : null, presentacion: "500 g" }),
    );
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/insumos/10/editar"] });
    expect(await screen.findByRole("heading", { name: "Editar insumo", level: 1 })).toBeInTheDocument();
    await screen.findByRole("radio", { name: "Leche" });
    return user;
  }

  it("dos requisitos (información comercial e ingrediente), sin trazas ni alérgenos, y el botón dice «Guardar cambios»", async () => {
    await abrirEdicion(null, "manual");

    const lista = within(screen.getByRole("list", { name: "Requisitos para confirmar" }));
    expect(lista.getAllByRole("listitem")).toHaveLength(2);
    expect(lista.getByText(/Información comercial revisada/)).toHaveTextContent("(listo)");
    expect(lista.getByText(/Ingrediente asociado/)).toHaveTextContent("(listo)");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Confirmar registro" })).not.toBeInTheDocument();
    // The allergens of a saved supply are managed in its detail, as before.
    expect(screen.queryByRole("group", { name: "Alérgenos del insumo" })).not.toBeInTheDocument();
  });

  it("encabezado de edición: «Volver al insumo», etiqueta «Editar insumo» y el nombre como título", async () => {
    await abrirEdicion(null, "manual");

    expect(screen.getByRole("link", { name: /Volver al insumo/ })).toHaveAttribute("href", "/insumos/10");
    expect(screen.queryByRole("heading", { name: "Nuevo insumo", level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Queso Quilque", level: 2 })).toBeInTheDocument();
  });

  it("sin ficha de fuentes (manual) la edición no muestra fuentes ni origen", async () => {
    await abrirEdicion(null, "manual");

    expect(screen.queryByText(/^Fuente:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Origen de la ficha" })).not.toBeInTheDocument();
  });

  it("con ficha de fuentes muestra la fuente de cada campo y las fechas; lo manual no se atribuye a una fuente", async () => {
    await abrirEdicion(FICHA_CON_FUENTES);

    const tarjeta = screen.getByRole("heading", { name: "Identificación comercial" }).closest("section") as HTMLElement;
    expect(within(tarjeta).getAllByText("Open Food Facts", { selector: "strong" }).length).toBeGreaterThanOrEqual(2);
    const origen = screen.getByRole("heading", { name: "Origen de la ficha" }).closest("div") as HTMLElement;
    expect(within(origen).getAllByText("Recuperado el 1 de noviembre de 2026")).toHaveLength(2);
  });

  it("al guardar solo envía lo que cambió, como antes", async () => {
    vi.mocked(insumoService.updateInsumo).mockResolvedValue(insumo({ nombre: "Otro" }));
    const user = await abrirEdicion(FICHA_CON_FUENTES);

    await user.clear(campo("Nombre"));
    await user.type(campo("Nombre"), "Otro");
    expect(within(screen.getByRole("heading", { name: "Identificación comercial" }).closest("section") as HTMLElement).getByText("Modificado por ti", { selector: "strong" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(insumoService.updateInsumo).toHaveBeenCalledWith(10, { nombre: "Otro" }));
  });
});
