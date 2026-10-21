/**
 * A code read by the CAMERA goes through the whole lookup (T13-05 / HU13): the scanner closes, the
 * camera is released, and the code is looked up once. The detector, getUserMedia, the clock and the
 * API are fakes (hu13.busqueda.test.tsx covers the page with codes typed by hand).
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import BuscarPorCodigo from "@/components/insumos/BuscarPorCodigo";
import { useBusquedaCodigoBarras, type ResultadoBusqueda } from "@/hooks/useBusquedaCodigoBarras";
import { INTERVALO_DETECCION_MS } from "@/hooks/useEscanerCodigoBarras";
import { crearDetector } from "@/lib/lectorCodigoBarras";
import * as insumoService from "@/services/insumoService";
import type { ConsultaCodigo } from "@/types/consultaCodigo";
import {
  avanzar,
  crearPista,
  crearStream,
  definirContextoSeguro,
  lectura,
  quitarContextoSeguro,
  type Lectura,
} from "./camaraFalsa";

vi.mock("@/lib/lectorCodigoBarras", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/lectorCodigoBarras")>()),
  crearDetector: vi.fn(),
}));

vi.mock("@/services/insumoService", () => ({
  consultarCodigoBarras: vi.fn(),
}));

const CODIGO = "7802910000971";

const ENCONTRADO: ConsultaCodigo = {
  codigo_barras: CODIGO,
  encontrado: true,
  fuente: "open_food_facts",
  fecha_recuperacion: "2026-10-19T15:00:00Z",
  producto: { nombre: "Leche", marca_origen: "Colun", presentacion: null, ingredientes_declarados: null },
  alergenos: { contiene: [], trazas: [], sin_reconocer: [] },
  ficha: null,
};

let pista: ReturnType<typeof crearPista>;
let detect: Mock<(fuente: HTMLVideoElement) => Promise<Lectura[]>>;
let getUserMedia: Mock<() => Promise<MediaStream>>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  pista = crearPista({ torch: false });
  detect = vi.fn(async (_fuente: HTMLVideoElement) => [] as Lectura[]);
  getUserMedia = vi.fn(async () => crearStream(pista));
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  definirContextoSeguro(true);
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.mocked(crearDetector).mockResolvedValue({ detector: { detect }, origen: "nativo" });
  vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(ENCONTRADO);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(crearDetector).mockReset();
  quitarContextoSeguro();
  Reflect.deleteProperty(navigator, "mediaDevices");
});

function Arnes({ onResultado }: { onResultado: (r: ResultadoBusqueda) => void }) {
  const busqueda = useBusquedaCodigoBarras({ onResultado });
  return (
    <MemoryRouter>
      <BuscarPorCodigo
        busqueda={busqueda}
        existente={{ onReactivar: vi.fn(), ocupado: false, aviso: "" }}
      />
    </MemoryRouter>
  );
}

const panel = () => screen.queryByRole("dialog", { name: "Escanear código de barras" });
const botonEscanear = () => screen.getByRole("button", { name: "Escanear código de barras" });

async function abrirEscaner() {
  fireEvent.click(botonEscanear());
  await avanzar(0);
}

function montar() {
  const onResultado = vi.fn();
  render(<Arnes onResultado={onResultado} />);
  return { onResultado };
}

describe("Código leído por la cámara", () => {
  it("cierra el panel, libera la cámara y busca el código una sola vez", async () => {
    detect.mockResolvedValue([lectura(CODIGO)]);
    const { onResultado } = montar();
    await abrirEscaner();
    expect(panel()).not.toBeNull();
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    await avanzar(INTERVALO_DETECCION_MS);
    await avanzar(0);

    expect(panel()).toBeNull();
    expect(pista.stop).toHaveBeenCalledTimes(1);
    expect(insumoService.consultarCodigoBarras).toHaveBeenCalledTimes(1);
    expect(insumoService.consultarCodigoBarras).toHaveBeenCalledWith(CODIGO);
    expect(onResultado).toHaveBeenCalledWith({ tipo: "encontrado", consulta: ENCONTRADO });
  });

  it("aunque el detector siga viendo el código, no se vuelve a buscar", async () => {
    detect.mockResolvedValue([lectura(CODIGO), lectura(CODIGO)]);
    montar();
    await abrirEscaner();

    await avanzar(INTERVALO_DETECCION_MS * 20);

    expect(insumoService.consultarCodigoBarras).toHaveBeenCalledTimes(1);
    expect(detect.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("mientras busca no se puede abrir el escáner otra vez", async () => {
    let responder: (consulta: ConsultaCodigo) => void = () => {};
    vi.mocked(insumoService.consultarCodigoBarras).mockImplementation(
      () => new Promise<ConsultaCodigo>((resolver) => (responder = resolver)),
    );
    detect.mockResolvedValue([lectura(CODIGO)]);
    montar();
    await abrirEscaner();
    await avanzar(INTERVALO_DETECCION_MS);
    await avanzar(0);
    expect(screen.getByText("Buscando el producto…")).toBeInTheDocument();
    expect(botonEscanear()).toBeDisabled();

    fireEvent.click(botonEscanear());
    await avanzar(0);
    expect(panel()).toBeNull();
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    await act(async () => responder(ENCONTRADO));
    expect(botonEscanear()).toBeEnabled();
  });

  it("al reabrir el escáner se puede buscar de nuevo, incluso el mismo código (es otra búsqueda)", async () => {
    detect.mockResolvedValue([lectura(CODIGO)]);
    montar();
    await abrirEscaner();
    await avanzar(INTERVALO_DETECCION_MS);
    await avanzar(0);
    expect(insumoService.consultarCodigoBarras).toHaveBeenCalledTimes(1);
    expect(botonEscanear()).toBeEnabled();

    // Closing the panel ends its session: a new one starts from scratch, with a new camera.
    await abrirEscaner();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    await avanzar(INTERVALO_DETECCION_MS);
    await avanzar(0);

    expect(insumoService.consultarCodigoBarras).toHaveBeenCalledTimes(2);
    expect(panel()).toBeNull();
    expect(pista.stop).toHaveBeenCalledTimes(2);
  });

  it("cerrar el panel sin código libera la cámara y no busca nada", async () => {
    montar();
    await abrirEscaner();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await avanzar(0);

    expect(panel()).toBeNull();
    expect(pista.stop).toHaveBeenCalledTimes(1);
    expect(insumoService.consultarCodigoBarras).not.toHaveBeenCalled();
    expect(botonEscanear()).toBeEnabled();
  });
});
