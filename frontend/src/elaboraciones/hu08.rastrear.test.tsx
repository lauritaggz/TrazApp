/**
 * «Rastrear insumo» (T08-04 / HU08): the selection in the URL, the result with its labels, the five numbers,
 * the amber notices, the links and the states. The API is simulated; the page only reads.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLocation, useNavigate } from "react-router-dom";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as insumoService from "@/services/insumoService";
import * as productService from "@/services/productService";
import * as relacionadasService from "@/services/relacionadasService";
import { mockProductor, paginaElaboraciones, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { Insumo } from "@/types/insumo";
import {
  E1,
  E4,
  INSUMO_ID,
  LOTES,
  NOMBRE_INSUMO,
  RESULTADO_INSUMO,
  elaboracion,
  resultadoDeLote,
  usoPendiente,
} from "@/elaboraciones/hu08.datos";

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

vi.mock("@/services/relacionadasService", () => ({
  getElaboracionesDeInsumo: vi.fn(),
  getElaboracionesDeLote: vi.fn(),
}));

function insumo(id: number, nombre: string, activo = true): Insumo {
  return { id, nombre, activo } as Insumo;
}

/** Shows the URL and goes back, to see what the selection does to the history. */
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

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listProducts).mockResolvedValue([]);
  vi.mocked(insumoService.listInsumos).mockImplementation(async (params) =>
    params?.activo === false ? [insumo(9, "Azúcar vieja 1 kg", false)] : [insumo(INSUMO_ID, NOMBRE_INSUMO), insumo(4, "Leche Colun 1 L")],
  );
  vi.mocked(elaboracionService.listLotesInsumo).mockResolvedValue(LOTES);
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(paginaElaboraciones([]));
  vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockResolvedValue(RESULTADO_INSUMO);
  vi.mocked(relacionadasService.getElaboracionesDeLote).mockResolvedValue(resultadoDeLote([E4, E1]));
});

async function abrir(ruta = "/elaboraciones/rastrear") {
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

const selectorInsumo = () => screen.getByLabelText("Insumo comercial") as HTMLSelectElement;
const selectorLote = () => screen.getByLabelText("Lote específico (opcional)") as HTMLSelectElement;
const lista = () => screen.getByRole("list", { name: "Elaboraciones relacionadas" });
const fila = (codigo: string) => within(lista()).getByText(codigo).closest("li") as HTMLElement;

describe("Rastrear insumo: la selección", () => {
  it("sin insumo en la URL no pide nada, invita a elegir y deja el lote deshabilitado", async () => {
    await abrir();

    expect(screen.getByRole("heading", { name: "Elige un insumo para empezar" })).toBeInTheDocument();
    expect(relacionadasService.getElaboracionesDeInsumo).not.toHaveBeenCalled();
    expect(relacionadasService.getElaboracionesDeLote).not.toHaveBeenCalled();
    expect(selectorLote()).toBeDisabled();
  });

  it("ofrece los insumos activos y los inactivos, y marca los inactivos", async () => {
    await abrir();

    await waitFor(() => expect(within(selectorInsumo()).getAllByRole("option")).toHaveLength(4));
    const opciones = within(selectorInsumo()).getAllByRole("option").map((o) => o.textContent);
    expect(opciones).toEqual(["Elige un insumo", "Azúcar vieja 1 kg (inactivo)", NOMBRE_INSUMO, "Leche Colun 1 L"]);
    expect(insumoService.listInsumos).toHaveBeenCalledWith({ activo: true });
    expect(insumoService.listInsumos).toHaveBeenCalledWith({ activo: false });
  });

  it("elegir un insumo lo pone en la URL, pide su consulta y trae sus lotes", async () => {
    await abrir();
    await waitFor(() => expect(within(selectorInsumo()).getAllByRole("option").length).toBeGreaterThan(1));

    await userEvent.selectOptions(selectorInsumo(), String(INSUMO_ID));

    await screen.findByRole("list", { name: "Elaboraciones relacionadas" });
    expect(url()).toBe(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);
    expect(relacionadasService.getElaboracionesDeInsumo).toHaveBeenCalledWith(INSUMO_ID);
    expect(elaboracionService.listLotesInsumo).toHaveBeenCalledWith(INSUMO_ID);
  });

  it("el selector de lote muestra el código y el vencimiento, del más reciente al más antiguo, y «Todos»", async () => {
    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);
    await waitFor(() => expect(within(selectorLote()).getAllByRole("option")).toHaveLength(3));

    expect(within(selectorLote()).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Todos los lotes del insumo",
      "L-43 · sin fecha de vencimiento",
      "L-42 · vence 01-12-2026",
    ]);
  });

  it("elegir un lote lo pone en la URL y pide la consulta por lote; volver a «Todos» lo quita", async () => {
    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);
    await waitFor(() => expect(within(selectorLote()).getAllByRole("option")).toHaveLength(3));

    await userEvent.selectOptions(selectorLote(), "1");

    await waitFor(() => expect(relacionadasService.getElaboracionesDeLote).toHaveBeenCalledWith(INSUMO_ID, 1));
    expect(url()).toBe(`/elaboraciones/rastrear?insumo=${INSUMO_ID}&lote=1`);
    expect(await screen.findByText(`Insumo ${NOMBRE_INSUMO} · lote L-42`)).toBeInTheDocument();

    await userEvent.selectOptions(selectorLote(), "");

    await waitFor(() => expect(url()).toBe(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`));
  });

  it("cambiar de insumo quita el lote, y el botón Atrás vuelve a la selección anterior", async () => {
    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}&lote=1`);
    await waitFor(() => expect(within(selectorInsumo()).getAllByRole("option").length).toBeGreaterThan(1));

    await userEvent.selectOptions(selectorInsumo(), "4");
    await waitFor(() => expect(url()).toBe("/elaboraciones/rastrear?insumo=4"));
    expect(relacionadasService.getElaboracionesDeInsumo).toHaveBeenCalledWith(4);

    await userEvent.click(screen.getByRole("button", { name: "sonda-atras" }));
    await waitFor(() => expect(url()).toBe(`/elaboraciones/rastrear?insumo=${INSUMO_ID}&lote=1`));
  });

  it("un insumo que no es un número positivo en la URL se ignora", async () => {
    await abrir("/elaboraciones/rastrear?insumo=abc&lote=2");

    expect(screen.getByRole("heading", { name: "Elige un insumo para empezar" })).toBeInTheDocument();
    expect(relacionadasService.getElaboracionesDeInsumo).not.toHaveBeenCalled();

  });
});

describe("Rastrear insumo: el resultado de un insumo", () => {
  beforeEach(() => {
    vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockResolvedValue(RESULTADO_INSUMO);
  });

  it("PT08-01: muestra las cuatro con producto, código y fecha, y el total", async () => {
    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);

    expect(within(lista()).getAllByRole("listitem")).toHaveLength(4);
    expect(within(fila("E1")).getByText("Queque de vainilla")).toBeInTheDocument();
    expect(within(fila("E1")).getByText("01-10-2026")).toBeInTheDocument();
    expect(within(fila("E3")).getByText("Galletas")).toBeInTheDocument();
    expect(screen.getByText("4 resultados")).toBeInTheDocument();
    expect(screen.getByText(`Todas las apariciones de ${NOMBRE_INSUMO}`)).toBeInTheDocument();
  });

  it("PT08-03: distingue «Finalizada» y «Borrador» con texto", async () => {
    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);

    expect(within(fila("E4")).getByText("Borrador")).toBeInTheDocument();
    expect(within(fila("E4")).queryByText("Finalizada")).not.toBeInTheDocument();
    for (const codigo of ["E1", "E2", "E3"]) {
      expect(within(fila(codigo)).getByText("Finalizada")).toBeInTheDocument();
      expect(within(fila(codigo)).queryByText("Borrador")).not.toBeInTheDocument();
    }
  });

  it("PT08-05: la elaboración sin lote lleva «Sin lote registrado» y las demás su lote", async () => {
    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);

    expect(within(fila("E2")).getByText("Sin lote registrado")).toBeInTheDocument();
    for (const codigo of ["E1", "E3", "E4"]) {
      expect(within(fila(codigo)).queryByText("Sin lote registrado")).not.toBeInTheDocument();
    }
    expect(within(fila("E1")).getByText(/Lote L-42 · vence 01-12-2026/)).toBeInTheDocument();
    expect(within(fila("E3")).getByText("Lote L-43")).toBeInTheDocument();
  });

  it("un borrador con el lote sin definir lleva «Lote pendiente»", async () => {
    const pendiente = elaboracion(7, "E7", "2026-10-06", { estado: "borrador", finalizada_at: null, origen_datos: "vigente", usos: [usoPendiente()] });
    vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockResolvedValue({
      ...RESULTADO_INSUMO,
      elaboraciones: [pendiente],
      resumen: { ...RESULTADO_INSUMO.resumen, total_elaboraciones: 1, finalizadas: 0, borradores: 1, elaboraciones_sin_lote: 0 },
    });

    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);

    expect(within(fila("E7")).getByText("Lote pendiente")).toBeInTheDocument();
    expect(within(fila("E7")).queryByText("Sin lote registrado")).not.toBeInTheDocument();
  });

  it("PT08-06: «Publicado» / «No publicado» y «Oculta al público» solo donde corresponde", async () => {
    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);

    expect(within(fila("E3")).getByText("Publicado")).toBeInTheDocument();
    expect(within(fila("E3")).getByText("Oculta al público")).toBeInTheDocument();
    expect(within(fila("E4")).getByText("Publicado")).toBeInTheDocument();
    expect(within(fila("E4")).queryByText("Oculta al público")).not.toBeInTheDocument();
    for (const codigo of ["E1", "E2"]) {
      expect(within(fila(codigo)).getByText("No publicado")).toBeInTheDocument();
      expect(within(fila(codigo)).queryByText("Oculta al público")).not.toBeInTheDocument();
    }
    expect(screen.getAllByText("Oculta al público")).toHaveLength(1);
  });

  it("el nombre conservado distinto del actual se avisa; si es el mismo no se repite", async () => {
    const renombrada = elaboracion(5, "E5", "2026-10-02", {
      usos: [{ ...E1.usos[0], insumo_nombre: "Harina vieja 1 kg" }],
    });
    vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockResolvedValue({
      ...RESULTADO_INSUMO,
      elaboraciones: [E1, renombrada],
    });

    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);

    expect(within(fila("E5")).getByText("Registrado como «Harina vieja 1 kg»")).toBeInTheDocument();
    expect(within(fila("E1")).queryByText(/Registrado como/)).not.toBeInTheDocument();
  });

  it("el panel tiene las cinco cifras: tres del resumen y dos contadas sobre la lista", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockResolvedValue({
      ...RESULTADO_INSUMO,
      // The API says only 1 is visible to the public: it is NOT the number of published products (E3 and E4).
      resumen: { ...RESULTADO_INSUMO.resumen, visibles_publicamente: 1 },
    });

    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);

    const panel = screen.getByRole("group", { name: "Resumen del resultado" });
    const valor = (etiqueta: string) => within(panel).getByText(etiqueta).previousElementSibling?.textContent;
    expect(valor("Finalizadas")).toBe("3");
    expect(valor("Borradores")).toBe("1");
    expect(valor("De productos publicados")).toBe("2");
    expect(valor("Ocultas")).toBe("1");
    expect(valor("Visibles al público")).toBe("1");
  });

  it("PT08-05: avisa cuántas elaboraciones registran el insumo sin lote", async () => {
    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);

    expect(screen.getByText("1 elaboración registra este insumo sin lote.")).toBeInTheDocument();
  });

  it("sin elaboraciones sin lote no hay aviso", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockResolvedValue({
      ...RESULTADO_INSUMO,
      resumen: { ...RESULTADO_INSUMO.resumen, elaboraciones_sin_lote: 0 },
    });

    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);

    expect(document.querySelector("[data-aviso-ambar]")).toBeNull();
  });

  it("enlaces: la finalizada a su detalle, el borrador a su registro y «Gestionar publicación» solo con producto publicado", async () => {
    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);

    expect(within(fila("E1")).getByRole("link", { name: "Ver la elaboración E1" })).toHaveAttribute("href", "/elaboraciones/1");
    expect(within(fila("E4")).getByRole("link", { name: "Ver la elaboración E4" })).toHaveAttribute("href", "/elaboraciones/4/registro");
    expect(within(fila("E3")).getByRole("link", { name: "Gestionar la publicación de Galletas" })).toHaveAttribute("href", "/publicaciones/8");
    expect(within(fila("E1")).queryByRole("link", { name: /Gestionar la publicación/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Gestionar la publicación/ })).toHaveLength(2);
  });

  it("un insumo sin usos dice «Este insumo no se ha usado en ninguna elaboración»", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockResolvedValue({
      ...RESULTADO_INSUMO,
      elaboraciones: [],
      resumen: { total_elaboraciones: 0, total_productos: 0, finalizadas: 0, borradores: 0, visibles_publicamente: 0, elaboraciones_sin_lote: 0 },
    });

    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);

    expect(screen.getByText("Este insumo no se ha usado en ninguna elaboración")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Resumen del resultado" })).not.toBeInTheDocument();
  });

  it("el insumo inactivo se nombra como tal en el encabezado del resultado", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockResolvedValue({
      ...RESULTADO_INSUMO,
      insumo: { ...RESULTADO_INSUMO.insumo, activo: false },
    });

    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);

    expect(screen.getByText(`Todas las apariciones de ${NOMBRE_INSUMO} (inactivo)`)).toBeInTheDocument();
  });
});

describe("Rastrear insumo: el resultado de un lote", () => {
  const ruta = `/elaboraciones/rastrear?insumo=${INSUMO_ID}&lote=1`;

  it("PT08-02: lista solo lo que devuelve la consulta del lote, con borradores y finalizadas", async () => {
    await abrir(ruta);

    expect(vi.mocked(relacionadasService.getElaboracionesDeLote)).toHaveBeenCalledWith(INSUMO_ID, 1);
    expect(relacionadasService.getElaboracionesDeInsumo).not.toHaveBeenCalled();
    expect(within(lista()).getAllByRole("listitem")).toHaveLength(2);
    expect(within(fila("E4")).getByText("Borrador")).toBeInTheDocument();
    expect(within(fila("E1")).getByText("Finalizada")).toBeInTheDocument();
    expect(screen.getByText(`Insumo ${NOMBRE_INSUMO} · lote L-42`)).toBeInTheDocument();
  });

  it("el aviso de «no se puede descartar» con sus números y el enlace a la consulta por insumo", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeLote).mockResolvedValue(
      resultadoDeLote([E4, E1], { sin_lote: 2, lote_pendiente: 1 }),
    );

    await abrir(ruta);

    expect(
      screen.getByText(
        "Hay 2 elaboraciones con este insumo sin lote registrado y 1 borrador con el lote pendiente. No se puede descartar que usaran este lote.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver las elaboraciones de este insumo" })).toHaveAttribute(
      "href",
      `/elaboraciones/rastrear?insumo=${INSUMO_ID}`,
    );
  });

  it("el aviso cambia de redacción si solo hay sin lote o solo hay pendientes, y no sale con ceros", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeLote).mockResolvedValue(resultadoDeLote([E1], { sin_lote: 1, lote_pendiente: 0 }));
    const primera = await abrir(ruta);
    expect(
      screen.getByText("Hay 1 elaboración con este insumo sin lote registrado. No se puede descartar que usaran este lote."),
    ).toBeInTheDocument();
    primera.unmount();

    vi.mocked(relacionadasService.getElaboracionesDeLote).mockResolvedValue(resultadoDeLote([E1], { sin_lote: 0, lote_pendiente: 3 }));
    const segunda = await abrir(ruta);
    expect(
      screen.getByText("Hay 3 borradores con el lote de este insumo pendiente de definir. No se puede descartar que usaran este lote."),
    ).toBeInTheDocument();
    segunda.unmount();

    vi.mocked(relacionadasService.getElaboracionesDeLote).mockResolvedValue(resultadoDeLote([E1], { sin_lote: 0, lote_pendiente: 0 }));
    await abrir(ruta);
    expect(document.querySelector("[data-aviso-ambar]")).toBeNull();
  });

  it("un lote sin usos dice «Este lote no se ha usado en ninguna elaboración» y el aviso sigue", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeLote).mockResolvedValue(resultadoDeLote([], { sin_lote: 2, lote_pendiente: 0 }));

    await abrir(ruta);

    expect(screen.getByText("Este lote no se ha usado en ninguna elaboración")).toBeInTheDocument();
    expect(screen.getByText(/Hay 2 elaboraciones con este insumo sin lote registrado/)).toBeInTheDocument();
  });

  it("la consulta del lote no muestra el aviso de «sin lote» del insumo", async () => {
    await abrir(ruta);

    expect(screen.queryByText(/registra este insumo sin lote\./)).not.toBeInTheDocument();
  });
});

describe("Rastrear insumo: los estados", () => {
  it("mientras carga dice «Cargando elaboraciones...»", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockReturnValue(new Promise(() => undefined));

    renderWithProviders(<App />, { initialEntries: [`/elaboraciones/rastrear?insumo=${INSUMO_ID}`] });

    expect(await screen.findByText("Cargando elaboraciones...")).toBeInTheDocument();
  });

  it("un 404 del insumo dice que no lo encontramos y deja elegir otro", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockRejectedValue(new ApiError("No se pudo completar la operación.", 404));

    await abrir("/elaboraciones/rastrear?insumo=999");

    expect(screen.getByRole("heading", { name: "No encontramos ese insumo" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Elegir otro insumo" }));
    await waitFor(() => expect(url()).toBe("/elaboraciones/rastrear"));
    expect(screen.getByRole("heading", { name: "Elige un insumo para empezar" })).toBeInTheDocument();
  });

  it("un 404 del lote dice que no está en este insumo y lleva a todos sus lotes", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeLote).mockRejectedValue(new ApiError("No se pudo completar la operación.", 404));

    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}&lote=999`);

    expect(screen.getByRole("heading", { name: "No encontramos ese lote en este insumo" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ver todos los lotes del insumo" }));
    await waitFor(() => expect(url()).toBe(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`));
    expect(relacionadasService.getElaboracionesDeInsumo).toHaveBeenCalledWith(INSUMO_ID);
  });

  it("un error de red muestra el mensaje y «Reintentar» vuelve a pedir", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeInsumo)
      .mockRejectedValueOnce(new ApiError("No se pudo conectar con el servidor.", 0))
      .mockResolvedValue(RESULTADO_INSUMO);

    await abrir(`/elaboraciones/rastrear?insumo=${INSUMO_ID}`);

    expect(screen.getByText("No pudimos cargar las elaboraciones. Revisa tu conexión e inténtalo de nuevo.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("list", { name: "Elaboraciones relacionadas" });
    expect(relacionadasService.getElaboracionesDeInsumo).toHaveBeenCalledTimes(2);
  });

  it("si no se pueden cargar los insumos lo dice y deja reintentar", async () => {
    vi.mocked(insumoService.listInsumos).mockRejectedValueOnce(new ApiError("No se pudo conectar.", 0));

    await abrir();

    expect(await screen.findByText("No pudimos cargar tus insumos. Revisa tu conexión e inténtalo de nuevo.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(within(selectorInsumo()).getAllByRole("option").length).toBeGreaterThan(1));
  });
});

describe("Rastrear insumo: pestañas", () => {
  it("«Rastrear insumo» está activa aquí y «Historial» lleva al historial", async () => {
    await abrir();

    const nav = screen.getByRole("navigation", { name: "Vistas de elaboraciones" });
    expect(within(nav).getByRole("link", { name: "Rastrear insumo" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Historial" })).not.toHaveAttribute("aria-current");

    await userEvent.click(within(nav).getByRole("link", { name: "Historial" }));
    await waitFor(() => expect(url()).toBe("/elaboraciones"));
    const navHistorial = await screen.findByRole("navigation", { name: "Vistas de elaboraciones" });
    expect(within(navHistorial).getByRole("link", { name: "Historial" })).toHaveAttribute("aria-current", "page");
    expect(within(navHistorial).getByRole("link", { name: "Rastrear insumo" })).toHaveAttribute("href", "/elaboraciones/rastrear");
  });

  it("el detalle de una elaboración sigue funcionando: /elaboraciones/rastrear no se confunde con un id", async () => {
    await abrir();

    expect(screen.queryByText("Elaboración no encontrada")).not.toBeInTheDocument();
    expect(elaboracionService.getElaboracion).not.toHaveBeenCalled();
  });
});
