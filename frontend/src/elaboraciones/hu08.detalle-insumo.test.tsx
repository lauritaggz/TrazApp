/**
 * «Uso reciente en elaboraciones» del detalle del insumo (T08-04 / HU08): los totales y el aviso siempre
 * arriba, las 5 más recientes, el enlace con el total, los enlaces por lote y el error aislado. También
 * el servicio (solo lecturas) y el detalle completo, que ya no dice «Próximamente».
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import SeccionUsoInsumo from "@/components/elaboraciones/relacionadas/SeccionUsoInsumo";
import { apiRequest } from "@/lib/apiClient";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as ingredientService from "@/services/ingredientService";
import * as insumoService from "@/services/insumoService";
import * as relacionadasService from "@/services/relacionadasService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { Insumo } from "@/types/insumo";
import { INSUMO_ID, LOTES, NOMBRE_INSUMO, RESULTADO_INSUMO, elaboracion } from "@/elaboraciones/hu08.datos";

vi.mock("@/lib/apiClient", () => ({ apiRequest: vi.fn() }));

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("@/services/insumoService", () => ({
  listInsumos: vi.fn(),
  getInsumo: vi.fn(),
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
  listAlergenosCatalog: vi.fn(),
}));

vi.mock("@/services/elaboracionService", () => ({
  listElaboraciones: vi.fn(),
  listLotesInsumo: vi.fn(),
}));

vi.mock("@/services/relacionadasService", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/relacionadasService")>();
  return { ...real, getElaboracionesDeInsumo: vi.fn(), getElaboracionesDeLote: vi.fn() };
});

function seccion() {
  return render(
    <MemoryRouter>
      <SeccionUsoInsumo insumoId={INSUMO_ID} />
    </MemoryRouter>,
  );
}

const region = () => screen.getByRole("region", { name: "Uso reciente en elaboraciones" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockResolvedValue(RESULTADO_INSUMO);
  vi.mocked(elaboracionService.listLotesInsumo).mockResolvedValue(LOTES);
});

describe("Detalle del insumo: la sección de uso", () => {
  it("arriba van el total y el aviso de sin lote; después las elaboraciones más recientes", async () => {
    seccion();

    const resumen = await screen.findByText("4 elaboraciones: 3 finalizadas y 1 borrador");
    const aviso = screen.getByText("1 elaboración registra este insumo sin lote.");
    const lista = screen.getByRole("list", { name: "Elaboraciones más recientes" });
    expect(resumen.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(aviso.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(lista).getAllByRole("listitem")).toHaveLength(4);
    expect(within(lista).getByText("Sin lote registrado")).toBeInTheDocument();
  });

  it("con más de 5 muestra solo las 5 más recientes y el enlace dice el total", async () => {
    const siete = [7, 6, 5, 4, 3, 2, 1].map((n) => elaboracion(n, `E${n}`, `2026-10-0${n}`));
    vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockResolvedValue({
      ...RESULTADO_INSUMO,
      elaboraciones: siete,
      resumen: { ...RESULTADO_INSUMO.resumen, total_elaboraciones: 7, finalizadas: 7, borradores: 0, elaboraciones_sin_lote: 0 },
    });

    seccion();

    const lista = await screen.findByRole("list", { name: "Elaboraciones más recientes" });
    expect(within(lista).getAllByRole("listitem")).toHaveLength(5);
    expect(within(lista).getByText("E7")).toBeInTheDocument();
    expect(within(lista).queryByText("E2")).not.toBeInTheDocument();
    expect(screen.getByText("7 elaboraciones: 7 finalizadas y 0 borradores")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver las 7 elaboraciones y buscar por lote" })).toHaveAttribute(
      "href",
      `/elaboraciones/rastrear?insumo=${INSUMO_ID}`,
    );
    // Without elaboraciones without lot there is no notice.
    expect(document.querySelector("[data-aviso-ambar]")).toBeNull();
  });

  it("ofrece un enlace por lote hacia la consulta de ese lote", async () => {
    seccion();

    const lotes = await screen.findByRole("list", { name: "Lotes del insumo" });
    expect(within(lotes).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["L-43", `/elaboraciones/rastrear?insumo=${INSUMO_ID}&lote=2`],
      ["L-42", `/elaboraciones/rastrear?insumo=${INSUMO_ID}&lote=1`],
    ]);
  });

  it("las etiquetas y los enlaces de las filas son los de la pantalla de rastreo", async () => {
    seccion();

    const lista = await screen.findByRole("list", { name: "Elaboraciones más recientes" });
    expect(within(lista).getByText("Oculta al público")).toBeInTheDocument();
    expect(within(lista).getByRole("link", { name: "Ver la elaboración E4" })).toHaveAttribute("href", "/elaboraciones/4/registro");
    expect(within(lista).getByRole("link", { name: "Ver la elaboración E1" })).toHaveAttribute("href", "/elaboraciones/1");
    expect(within(lista).getAllByRole("link", { name: /Gestionar la publicación de Galletas/ })).toHaveLength(2);
  });

  it("sin usos dice «Este insumo no se ha usado en ninguna elaboración» y no ofrece enlaces", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockResolvedValue({
      ...RESULTADO_INSUMO,
      elaboraciones: [],
      resumen: { total_elaboraciones: 0, total_productos: 0, finalizadas: 0, borradores: 0, visibles_publicamente: 0, elaboraciones_sin_lote: 0 },
    });

    seccion();

    expect(await screen.findByText("Este insumo no se ha usado en ninguna elaboración")).toBeInTheDocument();
    expect(within(region()).queryByRole("link")).not.toBeInTheDocument();
  });

  it("mientras carga dice «Cargando elaboraciones...»", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockReturnValue(new Promise(() => undefined));

    seccion();

    expect(await screen.findByText("Cargando elaboraciones...")).toBeInTheDocument();
  });

  it("si falla muestra su error con «Reintentar», que vuelve a pedir", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeInsumo)
      .mockRejectedValueOnce(new ApiError("No se pudo conectar.", 0))
      .mockResolvedValue(RESULTADO_INSUMO);

    seccion();

    expect(await screen.findByText("No pudimos cargar las elaboraciones. Revisa tu conexión e inténtalo de nuevo.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("4 elaboraciones: 3 finalizadas y 1 borrador")).toBeInTheDocument();
    expect(relacionadasService.getElaboracionesDeInsumo).toHaveBeenCalledTimes(2);
  });

  it("si fallan los lotes la sección sigue: solo faltan sus enlaces", async () => {
    vi.mocked(elaboracionService.listLotesInsumo).mockRejectedValue(new ApiError("No se pudo conectar.", 0));

    seccion();

    expect(await screen.findByText("4 elaboraciones: 3 finalizadas y 1 borrador")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Lotes del insumo" })).not.toBeInTheDocument();
    expect(screen.queryByText("Reintentar")).not.toBeInTheDocument();
  });
});

describe("El detalle del insumo completo", () => {
  const INSUMO = {
    id: INSUMO_ID,
    productor_id: 1,
    ingrediente_id: 1,
    ingrediente: { id: 1, nombre: "Harina" },
    nombre: NOMBRE_INSUMO,
    marca_origen: "Selecta",
    presentacion: null,
    codigo_barras: null,
    ingredientes_declarados: null,
    advertencias: null,
    ficha: null,
    fuente: "manual",
    fecha_recuperacion: null,
    habitual: false,
    activo: true,
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    alergenos_revisados: true,
    alergenos_revisados_at: "2026-10-01T12:00:00Z",
    alergenos_declarados: [],
  } as unknown as Insumo;

  beforeEach(() => {
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
    vi.mocked(insumoService.getInsumo).mockResolvedValue(INSUMO);
    vi.mocked(insumoService.listInsumoAlergenos).mockResolvedValue([]);
    vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue([]);
  });

  it("reemplaza el «Próximamente» por la sección de uso", async () => {
    renderWithProviders(<App />, { initialEntries: [`/insumos/${INSUMO_ID}`] });

    expect(await screen.findByRole("region", { name: "Uso reciente en elaboraciones" })).toBeInTheDocument();
    await screen.findByText("4 elaboraciones: 3 finalizadas y 1 borrador");
    expect(screen.queryByText("Próximamente")).not.toBeInTheDocument();
    expect(relacionadasService.getElaboracionesDeInsumo).toHaveBeenCalledWith(INSUMO_ID);
  });

  it("un error de la sección no tapa el resto del detalle", async () => {
    vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockRejectedValue(new ApiError("No se pudo conectar.", 0));

    renderWithProviders(<App />, { initialEntries: [`/insumos/${INSUMO_ID}`] });

    expect(await screen.findByText("No pudimos cargar las elaboraciones. Revisa tu conexión e inténtalo de nuevo.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Información general" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar insumo" })).toBeInTheDocument();
  });
});

describe("El servicio de las consultas relacionadas", () => {
  beforeEach(async () => {
    const real = await vi.importActual<typeof import("@/services/relacionadasService")>("@/services/relacionadasService");
    vi.mocked(relacionadasService.getElaboracionesDeInsumo).mockImplementation(real.getElaboracionesDeInsumo);
    vi.mocked(relacionadasService.getElaboracionesDeLote).mockImplementation(real.getElaboracionesDeLote);
    vi.mocked(apiRequest).mockReset();
    vi.mocked(apiRequest).mockResolvedValue({});
  });

  it("solo lee: dos GET autenticados con las rutas del backend", async () => {
    await relacionadasService.getElaboracionesDeInsumo(3);
    await relacionadasService.getElaboracionesDeLote(3, 5);

    expect(vi.mocked(apiRequest).mock.calls).toEqual([
      ["/gestion/insumos/3/elaboraciones", { method: "GET" }, true],
      ["/gestion/insumos/3/lotes/5/elaboraciones", { method: "GET" }, true],
    ]);
  });
});
