/**
 * The history of elaboraciones (T06-03 / HU06): filters in the URL, search by code, totals, pages,
 * states, rows and the menu. The server is a function over a fixed list of 45 elaboraciones.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocation, useNavigate } from "react-router-dom";
import App from "@/App";
import { textoAvanceBorrador } from "@/components/elaboraciones/historial/HistorialFila";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import type { ListElaboracionesParams } from "@/services/elaboracionService";
import * as ingredientService from "@/services/ingredientService";
import * as insumoService from "@/services/insumoService";
import * as productService from "@/services/productService";
import { mockProductor, paginaElaboraciones, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { Elaboracion, ElaboracionResumen } from "@/types/elaboracion";
import type { Product } from "@/types/product";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("@/services/productService", () => ({
  listProducts: vi.fn(),
  listCategories: vi.fn(),
  getProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  uploadProductImage: vi.fn(),
}));

vi.mock("@/services/ingredientService", () => ({
  listIngredients: vi.fn(),
  listAlergenosCatalog: vi.fn(),
}));

vi.mock("@/services/insumoService", () => ({
  listInsumos: vi.fn(),
}));

vi.mock("@/services/elaboracionService", () => ({
  getCodigoSugerido: vi.fn(),
  createElaboracion: vi.fn(),
  listElaboraciones: vi.fn(),
  getElaboracion: vi.fn(),
  updateElaboracion: vi.fn(),
  replaceUsos: vi.fn(),
  deleteElaboracion: vi.fn(),
  finalizarElaboracion: vi.fn(),
  listLotesInsumo: vi.fn(),
}));

// --- datos ---

function producto(id: number, nombre: string): Product {
  return {
    id,
    productor_id: 1,
    codigo_interno: `P-${id}`,
    nombre,
    descripcion: "Producto",
    contenido_neto: "250.000",
    unidad_medida: "g",
    presentacion: null,
    costo_produccion: null,
    precio_venta: "1000",
    imagen_url: null,
    categorias: [],
    activo: true,
    created_at: "2026-08-12T12:00:00Z",
    tiene_formulacion: true,
  };
}

const QUEQUE = producto(5, "Queque de vainilla");
const PAN = producto(7, "Pan amasado");

/** 45 elaboraciones, the newest first (the server's order): ids 45 … 1. Odd ids are drafts of the queque. */
const MUNDO: ElaboracionResumen[] = Array.from({ length: 45 }, (_, i) => {
  const id = 45 - i;
  const borrador = id % 2 === 1;
  const prod = id % 3 === 0 ? PAN : QUEQUE;
  return {
    id,
    producto: { id: prod.id, nombre: prod.nombre },
    version: { id: 1, numero_version: 1 },
    codigo: `E-${String(id).padStart(3, "0")}`,
    fecha: `2026-10-${String(Math.min(28, id)).padStart(2, "0")}`,
    estado: borrador ? "borrador" : "finalizada",
    finalizada_at: borrador ? null : "2026-10-01T12:00:00Z",
    total_ingredientes: 5,
    pendientes: borrador ? (id % 5 === 0 ? 0 : 2) : 0,
  };
});

/** What the API answers for some parameters. */
function servidor(params: ListElaboracionesParams = {}) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const codigo = params.codigo?.trim().toLowerCase();
  const filtradas = MUNDO.filter(
    (e) =>
      (params.productoId === undefined || e.producto.id === params.productoId) &&
      (params.estado === undefined || e.estado === params.estado) &&
      (!params.fechaDesde || e.fecha >= params.fechaDesde) &&
      (!params.fechaHasta || e.fecha <= params.fechaHasta) &&
      (!codigo || e.codigo.toLowerCase().includes(codigo)),
  );
  return { items: filtradas.slice(offset, offset + limit), total: filtradas.length, limit, offset };
}

function elaboracion(id: number, estado: "borrador" | "finalizada"): Elaboracion {
  return {
    id,
    producto: { id: 5, nombre: "Queque de vainilla" },
    version: { id: 1, numero_version: 1 },
    codigo: `E-${String(id).padStart(3, "0")}`,
    fecha: "2026-10-06",
    estado,
    finalizada_at: estado === "finalizada" ? "2026-10-06T18:30:00Z" : null,
    created_at: "2026-10-06T12:00:00Z",
    updated_at: "2026-10-06T12:00:00Z",
    usos: [],
  };
}

/** Shows the URL and goes back, so the tests can see what the filters do to the history. */
function Sonda() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="url">{location.pathname + location.search}</output>
      <button type="button" onClick={() => navigate(-1)}>
        sonda-atras
      </button>
    </>
  );
}

const url = () => screen.getByTestId("url").textContent ?? "";
const llamadas = () => vi.mocked(elaboracionService.listElaboraciones).mock.calls.map(([p]) => p ?? {});
const llamadasDeLaLista = () => llamadas().filter((p) => p.limit === 20);
const ultimaDeLaLista = () => llamadasDeLaLista().at(-1);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listProducts).mockResolvedValue([QUEQUE, PAN]);
  vi.mocked(productService.listCategories).mockResolvedValue([]);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([]);
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue([]);
  vi.mocked(insumoService.listInsumos).mockResolvedValue([]);
  vi.mocked(elaboracionService.listElaboraciones).mockImplementation(async (params) => servidor(params));
  vi.mocked(elaboracionService.getCodigoSugerido).mockResolvedValue({ codigo: "E-100" });
  vi.mocked(elaboracionService.listLotesInsumo).mockResolvedValue([]);
  vi.mocked(elaboracionService.getElaboracion).mockImplementation(async (id) =>
    elaboracion(id, id % 2 === 0 ? "finalizada" : "borrador"),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

async function abrir(ruta = "/elaboraciones") {
  const vista = renderWithProviders(
    <>
      <App />
      <Sonda />
    </>,
    { initialEntries: [ruta] },
  );
  await screen.findByRole("heading", { name: "Elaboraciones", level: 1 });
  await waitFor(() => expect(screen.queryByText("Cargando elaboraciones...")).not.toBeInTheDocument());
  return vista;
}

const lista = () => screen.getByRole("list", { name: "Elaboraciones" });

// --- filtros en la URL ---

describe("Historial: los filtros viven en la URL", () => {
  it("lee cada parámetro y se lo pide al servicio, con la página como offset", async () => {
    await abrir("/elaboraciones?producto=5&estado=borrador&desde=2026-10-01&hasta=2026-10-31&codigo=e-0&pagina=2");

    // La primera petición: la segunda página de ese filtro (con tan pocas, el historial después va a la última que tiene).
    expect(llamadasDeLaLista()[0]).toEqual({
      limit: 20,
      offset: 20,
      productoId: 5,
      estado: "borrador",
      fechaDesde: "2026-10-01",
      fechaHasta: "2026-10-31",
      codigo: "e-0",
    });
  });

  it("ignora los valores que no son válidos", async () => {
    await abrir("/elaboraciones?estado=cancelada&producto=abc&desde=2026-13-45&hasta=ayer&pagina=0");

    expect(ultimaDeLaLista()).toEqual({ limit: 20, offset: 0 });
  });

  it("los campos reflejan lo que trae la URL", async () => {
    await abrir("/elaboraciones?producto=7&estado=finalizada&desde=2026-10-02&hasta=2026-10-20&codigo=e-04");

    expect(screen.getByRole("searchbox", { name: "Buscar elaboración por código" })).toHaveValue("e-04");
    // En celular los controles quedan tras «Filtros»; el DOM los tiene igual.
    expect(screen.getByLabelText("Producto")).toHaveValue("7");
    expect(screen.getByLabelText("Estado")).toHaveValue("finalizada");
    expect(screen.getByLabelText("Desde")).toHaveValue("2026-10-02");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-10-20");
  });

  it("cambiar un filtro lo escribe en la URL y vuelve a la primera página", async () => {
    const user = userEvent.setup();
    await abrir("/elaboraciones?pagina=2");

    await user.selectOptions(screen.getByLabelText("Estado"), "borrador");

    await waitFor(() => expect(url()).toBe("/elaboraciones?estado=borrador"));
    expect(ultimaDeLaLista()).toEqual({ limit: 20, offset: 0, estado: "borrador" });
  });

  it("filtrar por producto y por fechas se combina en una sola petición", async () => {
    const user = userEvent.setup();
    await abrir();

    await user.selectOptions(screen.getByLabelText("Producto"), "7");
    await user.type(screen.getByLabelText("Desde"), "2026-10-05");
    await user.type(screen.getByLabelText("Hasta"), "2026-10-20");

    await waitFor(() =>
      expect(ultimaDeLaLista()).toEqual({
        limit: 20,
        offset: 0,
        productoId: 7,
        fechaDesde: "2026-10-05",
        fechaHasta: "2026-10-20",
      }),
    );
  });

  it("filtrar es una entrada nueva del historial: «atrás» la deshace", async () => {
    const user = userEvent.setup();
    await abrir("/elaboraciones?estado=borrador");

    await user.selectOptions(screen.getByLabelText("Producto"), "5");
    await waitFor(() => expect(url()).toBe("/elaboraciones?producto=5&estado=borrador"));
    await user.click(screen.getByRole("button", { name: "sonda-atras" }));

    await waitFor(() => expect(url()).toBe("/elaboraciones?estado=borrador"));
    expect(screen.getByLabelText("Producto")).toHaveValue("");
  });

  it("escribir el código reemplaza la entrada actual: no llena el historial", async () => {
    const user = userEvent.setup();
    await abrir("/elaboraciones?estado=borrador");
    await user.selectOptions(screen.getByLabelText("Producto"), "5");
    await waitFor(() => expect(url()).toContain("producto=5"));

    await user.type(screen.getByRole("searchbox", { name: "Buscar elaboración por código" }), "e-01{Enter}");
    await waitFor(() => expect(url()).toContain("codigo=e-01"));
    await user.click(screen.getByRole("button", { name: "sonda-atras" }));

    // Con «push» «atrás» dejaría el producto; con «replace» la entrada del producto ya fue reemplazada.
    await waitFor(() => expect(url()).toBe("/elaboraciones?estado=borrador"));
  });
});

// --- búsqueda por código ---

describe("Historial: búsqueda por código", () => {
  it("espera a que se deje de escribir (400 ms) y pide una sola vez", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    await abrir();
    const antes = llamadasDeLaLista().length;

    await user.type(screen.getByRole("searchbox", { name: "Buscar elaboración por código" }), "e-01");
    expect(llamadasDeLaLista()).toHaveLength(antes);
    expect(llamadasDeLaLista().some((p) => p.codigo)).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    await waitFor(() => expect(llamadasDeLaLista().filter((p) => p.codigo === "e-01")).toHaveLength(1));
    expect(llamadasDeLaLista().filter((p) => p.codigo)).toHaveLength(1);
  });

  it("con Enter pide al instante, sin esperar", async () => {
    const user = userEvent.setup();
    await abrir();

    await user.type(screen.getByRole("searchbox", { name: "Buscar elaboración por código" }), "e-02{Enter}");

    await waitFor(() => expect(ultimaDeLaLista()).toEqual({ limit: 20, offset: 0, codigo: "e-02" }));
    expect(llamadasDeLaLista().filter((p) => p.codigo)).toHaveLength(1);
  });

  it("buscar un código vuelve a la primera página", async () => {
    const user = userEvent.setup();
    await abrir("/elaboraciones?pagina=2");

    await user.type(screen.getByRole("searchbox", { name: "Buscar elaboración por código" }), "e-0{Enter}");

    await waitFor(() => expect(url()).toBe("/elaboraciones?codigo=e-0"));
  });
});

// --- tarjetas de cifras ---

describe("Historial: tarjetas de cifras", () => {
  it("muestran los totales, las finalizadas y los borradores con una consulta de una fila cada una", async () => {
    await abrir();

    const resumen = screen.getByRole("group", { name: "Resumen de elaboraciones" });
    await waitFor(() => expect(within(resumen).getByText("45")).toBeInTheDocument());
    expect(within(resumen).getByText("Elaboraciones totales")).toBeInTheDocument();
    expect(within(resumen).getByText("22")).toBeInTheDocument();
    expect(within(resumen).getByText("Finalizadas")).toBeInTheDocument();
    expect(within(resumen).getByText("23")).toBeInTheDocument();
    expect(within(resumen).getByText("En borrador")).toBeInTheDocument();
    expect(within(resumen).queryByText(/Productos elaborados/)).not.toBeInTheDocument();
    const deUna = llamadas().filter((p) => p.limit === 1);
    expect(deUna).toEqual(expect.arrayContaining([{ limit: 1 }, { estado: "finalizada", limit: 1 }, { estado: "borrador", limit: 1 }]));
    expect(deUna).toHaveLength(3);
  });

  it("no siguen los filtros: son globales y no se vuelven a pedir al filtrar", async () => {
    const user = userEvent.setup();
    await abrir();
    const resumen = screen.getByRole("group", { name: "Resumen de elaboraciones" });
    await waitFor(() => expect(within(resumen).getByText("45")).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("Producto"), "7");
    await waitFor(() => expect(screen.getByText("15 elaboraciones encontradas")).toBeInTheDocument());

    expect(within(resumen).getByText("45")).toBeInTheDocument();
    expect(llamadas().filter((p) => p.limit === 1)).toHaveLength(3);
  });

  it("el contador «N elaboraciones encontradas» sí sigue los filtros", async () => {
    const user = userEvent.setup();
    await abrir();
    expect(screen.getByText("45 elaboraciones encontradas")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Estado"), "borrador");

    expect(await screen.findByText("23 elaboraciones encontradas")).toBeInTheDocument();
  });
});

// --- filas ---

describe("Historial: filas", () => {
  it("cada fila trae código, producto, fecha y estado", async () => {
    await abrir();

    const primera = within(lista()).getAllByRole("listitem")[0];
    expect(within(primera).getByText("E-045")).toBeInTheDocument();
    expect(within(primera).getByText("Pan amasado")).toBeInTheDocument();
    expect(within(primera).getByText("28-10-2026")).toBeInTheDocument();
    expect(within(primera).getByText("Borrador")).toBeInTheDocument();
    const segunda = within(lista()).getAllByRole("listitem")[1];
    expect(within(segunda).getByText("E-044")).toBeInTheDocument();
    expect(within(segunda).getByText("Finalizada")).toBeInTheDocument();
  });

  it("una finalizada lleva al detalle y un borrador al registro", async () => {
    await abrir();

    expect(within(lista()).getByRole("link", { name: /E-044/ })).toHaveAttribute("href", "/elaboraciones/44");
    expect(within(lista()).getByRole("link", { name: /E-045/ })).toHaveAttribute("href", "/elaboraciones/45/registro");
  });

  it("un borrador dice cuántos ingredientes faltan, o que está lista para finalizar; una finalizada no dice nada", async () => {
    await abrir();

    const borrador = within(lista()).getByRole("link", { name: /E-043/ });
    expect(borrador).toHaveTextContent("Faltan 2 de 5 ingredientes");
    expect(within(lista()).getByRole("link", { name: /E-045/ })).toHaveTextContent("Lista para finalizar");
    expect(within(lista()).getByRole("link", { name: /E-044/ })).not.toHaveTextContent(/Falta|Lista para finalizar/);
  });

  it("el texto de avance concuerda en singular y plural", () => {
    expect(textoAvanceBorrador(1, 5)).toBe("Falta 1 de 5 ingredientes");
    expect(textoAvanceBorrador(2, 5)).toBe("Faltan 2 de 5 ingredientes");
    expect(textoAvanceBorrador(1, 1)).toBe("Falta 1 de 1 ingrediente");
    expect(textoAvanceBorrador(0, 3)).toBe("Lista para finalizar");
  });

  it("la fila entera es el enlace y mide 44 px", async () => {
    await abrir();

    expect(within(lista()).getByRole("link", { name: /E-044/ })).toHaveClass("min-h-11");
  });
});

// --- paginación ---

describe("Historial: paginación", () => {
  it("muestra «x–y de z» y deshabilita «Anterior» en la primera página", async () => {
    await abrir();

    expect(screen.getByText("1–20 de 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled();
    expect(within(lista()).getAllByRole("listitem")).toHaveLength(20);
  });

  it("avanza y retrocede con la URL y el offset", async () => {
    const user = userEvent.setup();
    await abrir();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(await screen.findByText("21–40 de 45")).toBeInTheDocument();
    expect(url()).toBe("/elaboraciones?pagina=2");
    expect(ultimaDeLaLista()).toEqual({ limit: 20, offset: 20 });
    expect(within(lista()).getByRole("link", { name: /E-025/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(await screen.findByText("41–45 de 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(ultimaDeLaLista()).toEqual({ limit: 20, offset: 40 });

    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(await screen.findByText("21–40 de 45")).toBeInTheDocument();
  });

  it("cambiar de página solo cambia la página: conserva los filtros y es una entrada nueva del historial", async () => {
    const user = userEvent.setup();
    await abrir("/elaboraciones?estado=borrador");

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(url()).toBe("/elaboraciones?estado=borrador&pagina=2"));
    expect(ultimaDeLaLista()).toEqual({ limit: 20, offset: 20, estado: "borrador" });
    await user.click(screen.getByRole("button", { name: "sonda-atras" }));

    await waitFor(() => expect(url()).toBe("/elaboraciones?estado=borrador"));
  });

  it("cambiar un filtro desde la página 2 vuelve a la página 1 (no a la última página con filtros)", async () => {
    const user = userEvent.setup();
    await abrir("/elaboraciones?estado=borrador&pagina=2");

    await user.selectOptions(screen.getByLabelText("Producto"), "7");

    await waitFor(() => expect(url()).toBe("/elaboraciones?producto=7&estado=borrador"));
  });

  it("una página más allá de la última lleva a la última que tiene elaboraciones", async () => {
    await abrir("/elaboraciones?pagina=9");

    expect(await screen.findByText("41–45 de 45")).toBeInTheDocument();
    expect(url()).toBe("/elaboraciones?pagina=3");
  });

  it("los botones miden 44 px", async () => {
    await abrir();

    expect(screen.getByRole("button", { name: "Anterior" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Siguiente" })).toHaveClass("min-h-11");
  });
});

// --- estados ---

describe("Historial: estados", () => {
  it("mientras carga lo dice", async () => {
    vi.mocked(elaboracionService.listElaboraciones).mockImplementation(
      (params) => new Promise(() => void params),
    );
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones"] });

    expect(await screen.findByText("Cargando elaboraciones...")).toBeInTheDocument();
  });

  it("si falla avisa y «Reintentar» vuelve a pedir", async () => {
    const user = userEvent.setup();
    vi.mocked(elaboracionService.listElaboraciones).mockImplementation(async (params) => {
      if (params?.limit === 20) throw new ApiError("falla", 500);
      return servidor(params);
    });
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones"] });
    expect(
      await screen.findByText("No pudimos cargar las elaboraciones. Revisa tu conexión e inténtalo de nuevo."),
    ).toBeInTheDocument();
    vi.mocked(elaboracionService.listElaboraciones).mockImplementation(async (params) => servidor(params));

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("1–20 de 45")).toBeInTheDocument();
  });

  it("sin elaboraciones y sin filtros dice «Aún no tienes elaboraciones» y lleva a Productos", async () => {
    vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(paginaElaboraciones([]));
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones"] });

    expect(await screen.findByText("Aún no tienes elaboraciones")).toBeInTheDocument();
    expect(screen.queryByText("Ninguna elaboración coincide")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ir a Productos" }));
    expect(await screen.findByRole("heading", { name: "Productos", level: 1 })).toBeInTheDocument();
  });

  it("con filtros y sin resultados dice «Ninguna elaboración coincide» y «Limpiar filtros» los quita", async () => {
    const user = userEvent.setup();
    await abrir("/elaboraciones?codigo=zzz&estado=borrador");
    expect(await screen.findByText("Ninguna elaboración coincide")).toBeInTheDocument();
    expect(screen.queryByText("Aún no tienes elaboraciones")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    await waitFor(() => expect(url()).toBe("/elaboraciones"));
    expect(await screen.findByText("1–20 de 45")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Buscar elaboración por código" })).toHaveValue("");
  });

  it("los filtros activos salen como chips y cada uno se puede quitar", async () => {
    const user = userEvent.setup();
    await abrir("/elaboraciones?producto=7&estado=borrador");

    const chips = screen.getByRole("group", { name: "Filtros activos" });
    expect(within(chips).getByText("Producto: Pan amasado")).toBeInTheDocument();
    expect(within(chips).getByText("Estado: Borrador")).toBeInTheDocument();

    await user.click(within(chips).getByRole("button", { name: "Quitar filtro: Estado: Borrador" }));

    await waitFor(() => expect(url()).toBe("/elaboraciones?producto=7"));
  });

  it("«desde» posterior a «hasta» avisa en el cliente y no lo pide", async () => {
    await abrir("/elaboraciones?desde=2026-10-20&hasta=2026-10-05");

    expect(await screen.findByText("La fecha desde no puede ser posterior a la fecha hasta.")).toBeInTheDocument();
    expect(llamadasDeLaLista().some((p) => p.fechaDesde === "2026-10-20")).toBe(false);
    expect(screen.queryByRole("list", { name: "Elaboraciones" })).not.toBeInTheDocument();
  });
});

// --- menú ---

describe("Menú: «Elaboraciones»", () => {
  const marcados = () =>
    within(screen.getByRole("navigation", { name: "Secciones" }))
      .getAllByRole("link")
      .filter((enlace) => enlace.getAttribute("aria-current") === "page")
      .map((enlace) => enlace.textContent);

  it("en /elaboraciones solo queda marcado «Elaboraciones»", async () => {
    await abrir("/elaboraciones");

    expect(marcados()).toEqual(["Elaboraciones"]);
  });

  it("en el detalle de una elaboración solo queda marcado «Elaboraciones»", async () => {
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones/44"] });
    await screen.findByRole("heading", { name: "Elaboración E-044", level: 1 });

    expect(marcados()).toEqual(["Elaboraciones"]);
  });

  it("en el registro de un borrador solo queda marcado «Elaboraciones»", async () => {
    renderWithProviders(<App />, { initialEntries: ["/elaboraciones/45/registro"] });
    await screen.findByRole("heading", { name: "Elaboración E-045", level: 1 });

    expect(marcados()).toEqual(["Elaboraciones"]);
  });

  it("el enlace del menú lleva al historial", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });
    await screen.findByRole("heading", { name: /Hola/ });

    await user.click(within(screen.getByRole("navigation", { name: "Secciones" })).getByRole("link", { name: "Elaboraciones" }));

    expect(await screen.findByRole("heading", { name: "Elaboraciones", level: 1 })).toBeInTheDocument();
  });
});
