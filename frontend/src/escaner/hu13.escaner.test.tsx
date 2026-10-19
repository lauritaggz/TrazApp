/**
 * The camera and the reading loop of the barcode scanner (T13-01 / HU13).
 *
 * The detector and getUserMedia are fakes; time is fake too, so the 250 ms loop and the 4 s window
 * for repeated codes are exact. What matters most is that the camera is always released (CA13):
 * every path that ends the scanner is checked against the `stop` spy of the track.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import EscanerCodigoBarras from "@/components/insumos/EscanerCodigoBarras";
import {
  INTERVALO_DETECCION_MS,
  useEscanerCodigoBarras,
  VENTANA_REPETIDOS_MS,
} from "@/hooks/useEscanerCodigoBarras";
import { crearDetector, type DetectorCreado } from "@/lib/lectorCodigoBarras";

vi.mock("@/lib/lectorCodigoBarras", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/lectorCodigoBarras")>()),
  crearDetector: vi.fn(),
}));

const EAN_13 = "7802910000971";
const OTRO_EAN_13 = "4006381333931";
const EAN_13_INVALIDO = "7802910000972";

type Lectura = { rawValue: string; format: string };
const lectura = (rawValue: string, format = "ean_13"): Lectura => ({ rawValue, format });

function crearPista(capacidades?: Record<string, unknown>) {
  return {
    kind: "video",
    stop: vi.fn(),
    getCapabilities: capacidades === undefined ? undefined : vi.fn(() => capacidades),
    applyConstraints: vi.fn(async () => undefined),
  };
}

function crearStream(pista: ReturnType<typeof crearPista>) {
  return {
    getTracks: () => [pista],
    getVideoTracks: () => [pista],
  } as unknown as MediaStream;
}

function errorDeCamara(name: string) {
  const error = new Error(`falla simulada: ${name}`);
  error.name = name;
  return error;
}

let pista: ReturnType<typeof crearPista>;
let getUserMedia: ReturnType<typeof vi.fn>;
let detect: Mock<(fuente: HTMLVideoElement) => Promise<Lectura[]>>;

function instalarMediaDevices() {
  getUserMedia = vi.fn(async () => crearStream(pista));
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia },
    configurable: true,
  });
}

async function avanzar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  pista = crearPista({ torch: false });
  detect = vi.fn(async (_fuente: HTMLVideoElement) => [] as Lectura[]);
  vi.mocked(crearDetector).mockResolvedValue({ detector: { detect }, origen: "nativo" });
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  instalarMediaDevices();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(crearDetector).mockReset();
  Reflect.deleteProperty(navigator, "mediaDevices");
});

// --- a small screen that exposes the hook ---

function Arnes({
  onDetectado,
  espiar,
}: {
  onDetectado: (codigo: string) => void;
  espiar?: (escaner: ReturnType<typeof useEscanerCodigoBarras>) => void;
}) {
  const escaner = useEscanerCodigoBarras({ onDetectado });
  const { videoRef, estado, reiniciar, cerrar } = escaner;
  useEffect(() => {
    espiar?.(escaner);
  });
  return (
    <div>
      <video ref={videoRef} data-testid="video" />
      <output data-testid="estado">{estado}</output>
      <button type="button" onClick={reiniciar}>
        reiniciar
      </button>
      <button type="button" onClick={cerrar}>
        cerrar
      </button>
    </div>
  );
}

async function montarArnes(onDetectado = vi.fn(), espiar?: (e: ReturnType<typeof useEscanerCodigoBarras>) => void) {
  const vista = render(<Arnes onDetectado={onDetectado} espiar={espiar} />);
  await avanzar(0);
  return { onDetectado, ...vista };
}

const estado = () => screen.getByTestId("estado").textContent;
const video = () => screen.getByTestId("video") as HTMLVideoElement;

// =============================================================================================

describe("Arranque de la cámara", () => {
  it("pide la cámara trasera con 1280×720 ideal en el primer intento", async () => {
    await montarArnes();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    expect(estado()).toBe("escaneando");
    expect(video().srcObject).not.toBeNull();
  });

  it("hace el segundo intento con solo facingMode si el primero falla por restricciones", async () => {
    getUserMedia
      .mockRejectedValueOnce(errorDeCamara("OverconstrainedError"))
      .mockImplementationOnce(async () => crearStream(pista));

    await montarArnes();

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[1][0]).toEqual({ video: { facingMode: "environment" } });
    expect(estado()).toBe("escaneando");
  });

  it("si los dos intentos fallan, el estado es error y expone el error crudo del segundo", async () => {
    const segundo = errorDeCamara("NotReadableError");
    getUserMedia
      .mockRejectedValueOnce(errorDeCamara("OverconstrainedError"))
      .mockRejectedValueOnce(segundo);
    const espiar = vi.fn();

    await montarArnes(vi.fn(), espiar);

    expect(estado()).toBe("error");
    expect(espiar.mock.lastCall?.[0].error).toBe(segundo);
  });

  it("no repite el pedido si el usuario negó el permiso, y expone el error crudo", async () => {
    const denegado = errorDeCamara("NotAllowedError");
    getUserMedia.mockRejectedValue(denegado);
    const espiar = vi.fn();

    await montarArnes(vi.fn(), espiar);

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(estado()).toBe("error");
    expect(espiar.mock.lastCall?.[0].error).toBe(denegado);
  });

  it("sin API de cámara, el estado es error con un error de no soportado", async () => {
    Reflect.deleteProperty(navigator, "mediaDevices");
    const espiar = vi.fn();

    await montarArnes(vi.fn(), espiar);

    expect(estado()).toBe("error");
    expect(espiar.mock.lastCall?.[0].error).toMatchObject({ name: "NotSupportedError" });
  });

  it("si el detector no se puede crear, el estado es error y no pide la cámara", async () => {
    const falla = new Error("no se pudo cargar el polyfill");
    vi.mocked(crearDetector).mockRejectedValue(falla);
    const espiar = vi.fn();

    await montarArnes(vi.fn(), espiar);

    expect(estado()).toBe("error");
    expect(espiar.mock.lastCall?.[0].error).toBe(falla);
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});

describe("Ciclo de detección", () => {
  it("revisa cada 250 ms, no en cada cuadro", async () => {
    await montarArnes();
    expect(detect).not.toHaveBeenCalled();

    await avanzar(INTERVALO_DETECCION_MS - 1);
    expect(detect).toHaveBeenCalledTimes(0);
    await avanzar(1);
    expect(detect).toHaveBeenCalledTimes(1);
    await avanzar(INTERVALO_DETECCION_MS);
    expect(detect).toHaveBeenCalledTimes(2);
    await avanzar(INTERVALO_DETECCION_MS * 4);
    expect(detect).toHaveBeenCalledTimes(6);
  });

  it("si el video aún no tiene un cuadro, la lectura falla y el ciclo sigue", async () => {
    detect
      .mockRejectedValueOnce(new DOMException("sin cuadro", "InvalidStateError"))
      .mockResolvedValue([lectura(EAN_13)]);
    const { onDetectado } = await montarArnes();

    await avanzar(INTERVALO_DETECCION_MS);
    expect(onDetectado).not.toHaveBeenCalled();
    expect(estado()).toBe("escaneando");

    await avanzar(INTERVALO_DETECCION_MS);
    expect(onDetectado).toHaveBeenCalledWith(EAN_13);
  });

  it("entrega el código reconocido una sola vez y deja la cámara detenida", async () => {
    detect.mockResolvedValue([lectura(EAN_13), lectura(EAN_13)]);
    const { onDetectado } = await montarArnes();

    await avanzar(INTERVALO_DETECCION_MS);

    expect(onDetectado).toHaveBeenCalledTimes(1);
    expect(onDetectado).toHaveBeenCalledWith(EAN_13);
    expect(estado()).toBe("reconocido");
    expect(pista.stop).toHaveBeenCalledTimes(1);
    expect(video().srcObject).toBeNull();

    // The loop ended: it does not keep reading, nor report again.
    const lecturas = detect.mock.calls.length;
    await avanzar(INTERVALO_DETECCION_MS * 10);
    expect(detect).toHaveBeenCalledTimes(lecturas);
    expect(onDetectado).toHaveBeenCalledTimes(1);
  });

  it("una lectura que llega después de cerrar no se entrega", async () => {
    let terminar: (lecturas: Lectura[]) => void = () => {};
    detect.mockImplementation(() => new Promise<Lectura[]>((resolver) => (terminar = resolver)));
    const { onDetectado } = await montarArnes();
    await avanzar(INTERVALO_DETECCION_MS);

    fireEvent.click(screen.getByText("cerrar"));
    await act(async () => terminar([lectura(EAN_13)]));

    expect(onDetectado).not.toHaveBeenCalled();
    expect(pista.stop).toHaveBeenCalled();
  });
});

describe("Validación de lo leído", () => {
  it("descarta una lectura con dígito verificador inválido y sigue buscando", async () => {
    detect
      .mockResolvedValueOnce([lectura(EAN_13_INVALIDO)])
      .mockResolvedValue([lectura(EAN_13)]);
    const { onDetectado } = await montarArnes();

    await avanzar(INTERVALO_DETECCION_MS);
    expect(onDetectado).not.toHaveBeenCalled();
    expect(estado()).toBe("escaneando");
    expect(pista.stop).not.toHaveBeenCalled();

    await avanzar(INTERVALO_DETECCION_MS);
    expect(onDetectado).toHaveBeenCalledTimes(1);
    expect(onDetectado).toHaveBeenCalledWith(EAN_13);
  });

  it("descarta lecturas de otros formatos y de largo no permitido", async () => {
    detect
      .mockResolvedValueOnce([lectura("https://ejemplo.cl/x", "qr_code"), lectura("12345", "ean_13")])
      .mockResolvedValue([lectura(EAN_13)]);
    const { onDetectado } = await montarArnes();

    await avanzar(INTERVALO_DETECCION_MS);
    expect(onDetectado).not.toHaveBeenCalled();

    await avanzar(INTERVALO_DETECCION_MS);
    expect(onDetectado).toHaveBeenCalledWith(EAN_13);
  });

  it("entrega el código sin espacios", async () => {
    detect.mockResolvedValue([lectura(" 780 291 0000971 ")]);
    const { onDetectado } = await montarArnes();

    await avanzar(INTERVALO_DETECCION_MS);

    expect(onDetectado).toHaveBeenCalledWith(EAN_13);
  });

  it("acepta un UPC-A de 12 dígitos y un EAN-8", async () => {
    detect.mockResolvedValueOnce([lectura("036000291452", "upc_a")]);
    const primero = await montarArnes();
    await avanzar(INTERVALO_DETECCION_MS);
    expect(primero.onDetectado).toHaveBeenCalledWith("036000291452");
    cleanup();

    detect.mockResolvedValueOnce([lectura("96385074", "ean_8")]);
    const segundo = await montarArnes();
    await avanzar(INTERVALO_DETECCION_MS);
    expect(segundo.onDetectado).toHaveBeenCalledWith("96385074");
  });
});

describe("El mismo código repetido", () => {
  it("se ignora durante 4 s al reabrir el escáner con el mismo envase delante", async () => {
    detect.mockResolvedValue([lectura(EAN_13)]);
    const { onDetectado } = await montarArnes();
    await avanzar(INTERVALO_DETECCION_MS);
    expect(onDetectado).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("reiniciar"));
    await avanzar(0);
    expect(estado()).toBe("escaneando");

    // Same package, still in front of the camera, well inside the 4 s window.
    await avanzar(INTERVALO_DETECCION_MS * 4);
    expect(onDetectado).toHaveBeenCalledTimes(1);
    expect(estado()).toBe("escaneando");

    // Once the window is over the same code is accepted again.
    await avanzar(VENTANA_REPETIDOS_MS);
    expect(onDetectado).toHaveBeenCalledTimes(2);
    expect(estado()).toBe("reconocido");
  });

  it("un código distinto se acepta de inmediato al reabrir", async () => {
    detect.mockResolvedValueOnce([lectura(EAN_13)]).mockResolvedValue([lectura(OTRO_EAN_13)]);
    const { onDetectado } = await montarArnes();
    await avanzar(INTERVALO_DETECCION_MS);

    fireEvent.click(screen.getByText("reiniciar"));
    await avanzar(0);
    await avanzar(INTERVALO_DETECCION_MS);

    expect(onDetectado).toHaveBeenCalledTimes(2);
    expect(onDetectado).toHaveBeenLastCalledWith(OTRO_EAN_13);
  });
});

describe("La cámara siempre se libera (CA13)", () => {
  it("al reconocer un código", async () => {
    detect.mockResolvedValue([lectura(EAN_13)]);
    await montarArnes();

    await avanzar(INTERVALO_DETECCION_MS);

    expect(pista.stop).toHaveBeenCalledTimes(1);
    expect(video().srcObject).toBeNull();
  });

  it("al cerrar", async () => {
    await montarArnes();
    expect(pista.stop).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("cerrar"));

    expect(pista.stop).toHaveBeenCalledTimes(1);
    expect(video().srcObject).toBeNull();
    expect(estado()).toBe("detenido");

    // And it does not keep reading afterwards.
    await avanzar(INTERVALO_DETECCION_MS * 5);
    expect(detect).not.toHaveBeenCalled();
  });

  it("al desmontar", async () => {
    const { unmount } = await montarArnes();
    expect(pista.stop).not.toHaveBeenCalled();

    unmount();

    expect(pista.stop).toHaveBeenCalledTimes(1);
    await avanzar(INTERVALO_DETECCION_MS * 5);
    expect(detect).not.toHaveBeenCalled();
  });

  it("al desmontar mientras el navegador todavía pide el permiso", async () => {
    let conceder: (stream: MediaStream) => void = () => {};
    getUserMedia.mockImplementation(() => new Promise<MediaStream>((resolver) => (conceder = resolver)));
    const { unmount } = await montarArnes();
    expect(estado()).toBe("iniciando");

    unmount();
    await act(async () => conceder(crearStream(pista)));

    expect(pista.stop).toHaveBeenCalledTimes(1);
    expect(detect).not.toHaveBeenCalled();
  });

  it("al cerrar mientras se carga el detector, no llega a pedir la cámara", async () => {
    let listo: (valor: DetectorCreado) => void = () => {};
    vi.mocked(crearDetector).mockImplementation(
      () => new Promise<DetectorCreado>((resolver) => (listo = resolver)),
    );
    const { unmount } = await montarArnes();

    unmount();
    await act(async () => listo({ detector: { detect }, origen: "nativo" }));

    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("al reiniciar no deja una cámara abierta de la sesión anterior", async () => {
    const pistas = [crearPista({ torch: false }), crearPista({ torch: false })];
    getUserMedia
      .mockImplementationOnce(async () => crearStream(pistas[0]))
      .mockImplementationOnce(async () => crearStream(pistas[1]));
    await montarArnes();

    fireEvent.click(screen.getByText("reiniciar"));
    await avanzar(0);

    expect(pistas[0].stop).toHaveBeenCalledTimes(1);
    expect(pistas[1].stop).not.toHaveBeenCalled();
  });
});

describe("Estado del escáner", () => {
  it("pasa de iniciando a escaneando y a reconocido", async () => {
    detect.mockResolvedValue([lectura(EAN_13)]);
    const estados: string[] = [];
    const espiar = vi.fn((e: ReturnType<typeof useEscanerCodigoBarras>) => {
      if (estados.at(-1) !== e.estado) estados.push(e.estado);
    });

    await montarArnes(vi.fn(), espiar);
    await avanzar(INTERVALO_DETECCION_MS);

    expect(estados).toEqual(["iniciando", "escaneando", "reconocido"]);
  });

  it("expone el código reconocido", async () => {
    detect.mockResolvedValue([lectura(EAN_13)]);
    const espiar = vi.fn();
    await montarArnes(vi.fn(), espiar);

    await avanzar(INTERVALO_DETECCION_MS);

    expect(espiar.mock.lastCall?.[0].codigo).toBe(EAN_13);
  });
});

// =============================================================================================

function montarEscaner(props: Partial<React.ComponentProps<typeof EscanerCodigoBarras>> = {}) {
  const onDetectado = vi.fn();
  const onCerrar = vi.fn();
  const vista = render(<EscanerCodigoBarras onDetectado={onDetectado} onCerrar={onCerrar} {...props} />);
  return { onDetectado, onCerrar, ...vista };
}

describe("Componente EscanerCodigoBarras", () => {
  it("muestra el panel con título, video, texto de estado y botón Cerrar", async () => {
    montarEscaner();
    await avanzar(0);

    expect(screen.getByRole("dialog", { name: "Escanear código de barras" })).toBeInTheDocument();
    expect(screen.getByLabelText("Vista de la cámara")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Apunta al código de barras/);
  });

  it("anuncia el estado con aria-live y lo actualiza", async () => {
    detect.mockResolvedValue([lectura(EAN_13)]);
    montarEscaner();
    const estadoAnunciado = screen.getByRole("status");
    expect(estadoAnunciado).toHaveAttribute("aria-live", "polite");
    expect(estadoAnunciado).toHaveTextContent("Iniciando la cámara…");

    await avanzar(0);
    expect(estadoAnunciado).toHaveTextContent(/Apunta al código de barras/);

    await avanzar(INTERVALO_DETECCION_MS);
    expect(estadoAnunciado).toHaveTextContent(`Código reconocido: ${EAN_13}.`);
  });

  it("describe el diálogo con el texto de estado", async () => {
    montarEscaner();
    await avanzar(0);

    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveAccessibleDescription(/Apunta al código de barras/);
  });

  it("entrega el código con onDetectado y detiene la cámara", async () => {
    detect.mockResolvedValue([lectura(EAN_13)]);
    const { onDetectado } = montarEscaner();
    await avanzar(0);

    await avanzar(INTERVALO_DETECCION_MS);

    expect(onDetectado).toHaveBeenCalledWith(EAN_13);
    expect(pista.stop).toHaveBeenCalledTimes(1);
  });

  it("el recuadro guía solo está mientras escanea", async () => {
    detect.mockResolvedValue([lectura(EAN_13)]);
    const { container } = montarEscaner();
    expect(container.querySelector(".border-white\\/90")).toBeNull();

    await avanzar(0);
    expect(container.querySelector(".border-white\\/90")).not.toBeNull();

    await avanzar(INTERVALO_DETECCION_MS);
    expect(container.querySelector(".border-white\\/90")).toBeNull();
  });

  it("«Cerrar» detiene la cámara y avisa con onCerrar", async () => {
    const { onCerrar } = montarEscaner();
    await avanzar(0);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(pista.stop).toHaveBeenCalledTimes(1);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it("Escape cierra el escáner y detiene la cámara", async () => {
    const { onCerrar } = montarEscaner();
    await avanzar(0);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(pista.stop).toHaveBeenCalledTimes(1);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it("el foco entra al panel en «Cerrar»", async () => {
    montarEscaner();
    await avanzar(0);

    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
  });

  it("si la cámara falla, lo dice y deja «Cerrar» disponible", async () => {
    getUserMedia.mockRejectedValue(errorDeCamara("NotAllowedError"));
    montarEscaner();
    await avanzar(0);

    expect(screen.getByRole("status")).toHaveTextContent("No pudimos usar la cámara.");
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeEnabled();
  });
});

describe("Linterna", () => {
  it("aparece solo si la pista declara torch", async () => {
    pista = crearPista({ torch: true });
    montarEscaner();
    await avanzar(0);

    expect(screen.getByRole("button", { name: "Linterna" })).toBeInTheDocument();
  });

  it.each([
    ["la pista no declara torch", { torch: false }],
    ["la pista declara otras capacidades", { zoom: { min: 1, max: 4 } }],
    ["la pista no tiene getCapabilities", undefined],
  ])("no aparece si %s", async (_caso, capacidades) => {
    pista = crearPista(capacidades);
    montarEscaner();
    await avanzar(0);

    expect(screen.queryByRole("button", { name: "Linterna" })).not.toBeInTheDocument();
  });

  it("enciende y apaga la linterna y lo indica con aria-pressed", async () => {
    pista = crearPista({ torch: true });
    montarEscaner();
    await avanzar(0);
    const boton = screen.getByRole("button", { name: "Linterna" });
    expect(boton).toHaveAttribute("aria-pressed", "false");

    await act(async () => fireEvent.click(boton));
    expect(pista.applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ torch: true }] });
    expect(boton).toHaveAttribute("aria-pressed", "true");

    await act(async () => fireEvent.click(boton));
    expect(pista.applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ torch: false }] });
    expect(boton).toHaveAttribute("aria-pressed", "false");
  });

  it("si el dispositivo rechaza la linterna, el botón queda como estaba", async () => {
    pista = crearPista({ torch: true });
    pista.applyConstraints.mockRejectedValue(new Error("no soportado"));
    montarEscaner();
    await avanzar(0);
    const boton = screen.getByRole("button", { name: "Linterna" });

    await act(async () => fireEvent.click(boton));

    expect(boton).toHaveAttribute("aria-pressed", "false");
  });
});
