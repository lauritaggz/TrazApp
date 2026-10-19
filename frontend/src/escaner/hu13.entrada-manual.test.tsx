/**
 * Manual entry of the code and handling of camera failures in the scanner panel (T13-02 / HU13).
 *
 * The camera, the detector and time are fakes (see camaraFalsa.ts). What matters here:
 * - the field to type the number is always there and usable (CA04);
 * - each way the camera can fail gets its own message, with or without "Intentar de nuevo", and the
 *   focus goes to the field (CA05);
 * - an insecure context never calls getUserMedia.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import EscanerCodigoBarras from "@/components/insumos/EscanerCodigoBarras";
import { INTERVALO_DETECCION_MS } from "@/hooks/useEscanerCodigoBarras";
import { crearDetector } from "@/lib/lectorCodigoBarras";
import {
  avanzar,
  crearPista,
  crearStream,
  definirContextoSeguro,
  errorDeCamara,
  lectura,
  quitarContextoSeguro,
  type Lectura,
} from "./camaraFalsa";

vi.mock("@/lib/lectorCodigoBarras", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/lectorCodigoBarras")>()),
  crearDetector: vi.fn(),
}));

const EAN_13 = "7802910000971";
const UPC_A = "036000291452";
const EAN_8 = "96385074";

const MSG_FORMATO = "El código de barras debe tener 8, 12 o 13 dígitos numéricos.";
const MSG_DIGITO = "El dígito verificador del código de barras no es válido.";
const MSG_VACIO = "Ingresa el número del código de barras.";

let pista: ReturnType<typeof crearPista>;
let getUserMedia: Mock<(restricciones: MediaStreamConstraints) => Promise<MediaStream>>;
let detect: Mock<(fuente: HTMLVideoElement) => Promise<Lectura[]>>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  pista = crearPista({ torch: false });
  detect = vi.fn(async (_fuente: HTMLVideoElement) => [] as Lectura[]);
  vi.mocked(crearDetector).mockResolvedValue({ detector: { detect }, origen: "nativo" });
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  definirContextoSeguro(true);
  getUserMedia = vi.fn(async (_restricciones: MediaStreamConstraints) => crearStream(pista));
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(crearDetector).mockReset();
  Reflect.deleteProperty(navigator, "mediaDevices");
  quitarContextoSeguro();
});

function montar() {
  const onDetectado = vi.fn();
  const onCerrar = vi.fn();
  const vista = render(<EscanerCodigoBarras onDetectado={onDetectado} onCerrar={onCerrar} />);
  return { onDetectado, onCerrar, ...vista };
}

const campo = () => screen.getByRole("textbox", { name: "Número del código de barras" }) as HTMLInputElement;
const botonBuscar = () => screen.getByRole("button", { name: "Buscar" });
const reintentar = () => screen.queryByRole("button", { name: "Intentar de nuevo" });
const estadoAnunciado = () => screen.getByRole("status");

function escribir(valor: string) {
  fireEvent.change(campo(), { target: { value: valor } });
}

function buscar(valor: string) {
  escribir(valor);
  fireEvent.click(botonBuscar());
}

// =============================================================================================

describe("Campo del número del código", () => {
  it("tiene su etiqueta, inputmode numérico y sin autocompletar", async () => {
    montar();
    await avanzar(0);

    expect(campo()).toHaveAttribute("inputmode", "numeric");
    expect(campo()).toHaveAttribute("autocomplete", "off");
    expect(campo()).toHaveAccessibleName("Número del código de barras");
    expect(botonBuscar()).toBeInTheDocument();
  });

  it.each([
    ["EAN-13", EAN_13],
    ["EAN-8", EAN_8],
    ["UPC-A", UPC_A],
  ])("entrega un %s válido por el mismo onDetectado", async (_formato, codigo) => {
    const { onDetectado } = montar();
    await avanzar(0);

    buscar(codigo);

    expect(onDetectado).toHaveBeenCalledTimes(1);
    expect(onDetectado).toHaveBeenCalledWith(codigo);
  });

  it.each([
    ["espacios", "780 291 0000971"],
    ["guiones", "780-291-0000971"],
    ["espacios y guiones", " 780 - 291 - 0000971 "],
  ])("quita %s antes de validar y entrega el código limpio", async (_caso, escrito) => {
    const { onDetectado } = montar();
    await avanzar(0);

    buscar(escrito);

    expect(onDetectado).toHaveBeenCalledWith(EAN_13);
  });

  it("se envía con Enter", async () => {
    // user-event waits on timers, which the fake clock would never fire: this test uses the real one.
    vi.useRealTimers();
    const usuario = userEvent.setup();
    const { onDetectado } = montar();
    await screen.findByText(/Apunta al código de barras/);

    await usuario.type(campo(), `${EAN_13}{Enter}`);

    expect(onDetectado).toHaveBeenCalledTimes(1);
    expect(onDetectado).toHaveBeenCalledWith(EAN_13);
  });

  it("el dígito verificador incorrecto se explica y no se entrega", async () => {
    const { onDetectado } = montar();
    await avanzar(0);

    buscar("7802910000972");

    expect(screen.getByText(MSG_DIGITO)).toBeInTheDocument();
    expect(onDetectado).not.toHaveBeenCalled();
  });

  it.each([
    ["pocos dígitos", "12345", MSG_FORMATO],
    ["demasiados dígitos", "78029100009710", MSG_FORMATO],
    ["letras", "78029100009AB", MSG_FORMATO],
    ["vacío", "", MSG_VACIO],
    ["solo espacios y guiones", " - - ", MSG_VACIO],
  ])("rechaza un código con %s", async (_caso, escrito, mensaje) => {
    const { onDetectado } = montar();
    await avanzar(0);

    buscar(escrito);

    expect(screen.getByText(mensaje)).toBeInTheDocument();
    expect(onDetectado).not.toHaveBeenCalled();
  });

  it("liga el error al campo con aria-describedby y aria-invalid", async () => {
    montar();
    await avanzar(0);

    buscar("7802910000972");

    const error = screen.getByText(MSG_DIGITO);
    expect(campo()).toHaveAttribute("aria-invalid", "true");
    const ids = (campo().getAttribute("aria-describedby") ?? "").split(" ");
    expect(ids).toContain(error.id);
    expect(campo()).toHaveAccessibleDescription(MSG_DIGITO);
  });

  it("sin error, el campo no está marcado como inválido y se describe con su ayuda", async () => {
    montar();
    await avanzar(0);

    expect(campo()).not.toHaveAttribute("aria-invalid");
    expect(campo()).toHaveAccessibleDescription(/8, 12 o 13 dígitos/);
  });

  it("deja el foco en el campo cuando el código no es válido", async () => {
    montar();
    await avanzar(0);

    buscar("123");

    expect(campo()).toHaveFocus();
  });

  it("el error desaparece al seguir escribiendo", async () => {
    montar();
    await avanzar(0);
    buscar("123");
    expect(screen.getByText(MSG_FORMATO)).toBeInTheDocument();

    escribir("1234");

    expect(screen.queryByText(MSG_FORMATO)).not.toBeInTheDocument();
    expect(campo()).not.toHaveAttribute("aria-invalid");
  });

  it("después de un error se puede corregir y enviar", async () => {
    const { onDetectado } = montar();
    await avanzar(0);
    buscar("7802910000972");

    buscar(EAN_13);

    expect(onDetectado).toHaveBeenCalledTimes(1);
    expect(onDetectado).toHaveBeenCalledWith(EAN_13);
  });
});

describe("La cámara y el ingreso manual", () => {
  it("al usar el campo se detiene la cámara", async () => {
    const { onDetectado } = montar();
    await avanzar(0);
    expect(estadoAnunciado()).toHaveTextContent(/Apunta al código de barras/);
    expect(pista.stop).not.toHaveBeenCalled();

    buscar(EAN_13);

    expect(onDetectado).toHaveBeenCalledWith(EAN_13);
    expect(pista.stop).toHaveBeenCalledTimes(1);
    expect(estadoAnunciado()).toHaveTextContent(`Código ingresado: ${EAN_13}.`);
    const lecturas = detect.mock.calls.length;
    await avanzar(INTERVALO_DETECCION_MS * 6);
    expect(detect).toHaveBeenCalledTimes(lecturas);
  });

  it("un código inválido no detiene la cámara", async () => {
    montar();
    await avanzar(0);

    buscar("7802910000972");

    expect(pista.stop).not.toHaveBeenCalled();
    await avanzar(INTERVALO_DETECCION_MS);
    expect(detect).toHaveBeenCalled();
  });

  it("el campo se puede usar mientras la cámara escanea, sin interrumpirla", async () => {
    const { onDetectado } = montar();
    await avanzar(0);

    expect(campo()).toBeVisible();
    expect(campo()).toBeEnabled();
    escribir("780 291");
    expect(campo()).toHaveValue("780 291");

    await avanzar(INTERVALO_DETECCION_MS * 3);
    expect(detect).toHaveBeenCalled();
    expect(pista.stop).not.toHaveBeenCalled();
    expect(onDetectado).not.toHaveBeenCalled();
    expect(estadoAnunciado()).toHaveTextContent(/Apunta al código de barras/);
  });

  it("lo que ya se escribió no se pierde cuando la cámara reconoce otro código", async () => {
    detect.mockResolvedValue([lectura("4006381333931")]);
    const { onDetectado } = montar();
    await avanzar(0);
    escribir("780 291");

    await avanzar(INTERVALO_DETECCION_MS);

    expect(onDetectado).toHaveBeenCalledWith("4006381333931");
    expect(campo()).toHaveValue("780 291");
  });

  it.each([
    ["mientras inicia", async () => {}],
    ["con la cámara escaneando", async () => avanzar(0)],
  ])("el campo está visible y habilitado %s", async (_momento, preparar) => {
    montar();
    await preparar();

    expect(campo()).toBeVisible();
    expect(campo()).toBeEnabled();
    expect(botonBuscar()).toBeEnabled();
  });

  it("el campo sigue disponible después de reconocer un código con la cámara", async () => {
    detect.mockResolvedValue([lectura(EAN_13)]);
    montar();
    await avanzar(0);
    await avanzar(INTERVALO_DETECCION_MS);

    expect(estadoAnunciado()).toHaveTextContent(`Código reconocido: ${EAN_13}.`);
    expect(campo()).toBeVisible();
    expect(campo()).toBeEnabled();
  });
});

// =============================================================================================

describe("Errores de la cámara (CA05)", () => {
  it.each([
    ["NotAllowedError", /no tiene permiso para usar la cámara/, false],
    ["SecurityError", /no tiene permiso para usar la cámara/, false],
    ["NotFoundError", /No encontramos una cámara disponible/, false],
    ["OverconstrainedError", /No encontramos una cámara disponible/, false],
    ["NotReadableError", /en uso por otra aplicación/, true],
    ["AbortError", /en uso por otra aplicación/, true],
    ["TypeError", /No pudimos usar la cámara/, true],
    ["UnknownError", /No pudimos usar la cámara/, true],
  ])("%s muestra su mensaje (reintentar: %s)", async (nombre, mensaje, conReintento) => {
    getUserMedia.mockRejectedValue(errorDeCamara(nombre));
    montar();
    await avanzar(0);

    expect(estadoAnunciado()).toHaveTextContent(mensaje);
    expect(reintentar() !== null).toBe(conReintento);
  });

  it.each([
    "NotAllowedError",
    "SecurityError",
    "NotFoundError",
    "OverconstrainedError",
    "NotReadableError",
    "AbortError",
    "TypeError",
  ])("con %s el foco pasa al campo del número", async (nombre) => {
    getUserMedia.mockRejectedValue(errorDeCamara(nombre));
    montar();
    await avanzar(0);

    expect(campo()).toHaveFocus();
  });

  it("el mensaje se anuncia con aria-live en la misma región de estado", async () => {
    getUserMedia.mockRejectedValue(errorDeCamara("NotAllowedError"));
    montar();
    const region = estadoAnunciado();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Iniciando la cámara…");

    await avanzar(0);

    expect(estadoAnunciado()).toBe(region);
    expect(region).toHaveTextContent(/no tiene permiso para usar la cámara/);
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("el diálogo se describe con el mensaje del error", async () => {
    getUserMedia.mockRejectedValue(errorDeCamara("NotReadableError"));
    montar();
    await avanzar(0);

    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(/en uso por otra aplicación/);
  });

  it("el permiso denegado explica cómo habilitar la cámara y no ofrece reintentar", async () => {
    getUserMedia.mockRejectedValue(errorDeCamara("NotAllowedError"));
    montar();
    await avanzar(0);

    expect(estadoAnunciado()).toHaveTextContent(/permisos|permite la cámara/);
    expect(reintentar()).not.toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("«Intentar de nuevo» vuelve a abrir la cámara cuando estaba ocupada", async () => {
    getUserMedia
      .mockRejectedValueOnce(errorDeCamara("NotReadableError"))
      .mockRejectedValueOnce(errorDeCamara("NotReadableError"));
    montar();
    await avanzar(0);
    expect(estadoAnunciado()).toHaveTextContent(/en uso por otra aplicación/);
    const llamadas = getUserMedia.mock.calls.length;

    fireEvent.click(reintentar()!);
    await avanzar(0);

    expect(getUserMedia.mock.calls.length).toBeGreaterThan(llamadas);
    expect(estadoAnunciado()).toHaveTextContent(/Apunta al código de barras/);
    expect(reintentar()).not.toBeInTheDocument();
  });

  it("un fallo del lector (por ejemplo no carga el polyfill) ofrece reintentar", async () => {
    vi.mocked(crearDetector).mockRejectedValueOnce(new TypeError("Failed to fetch module"));
    montar();
    await avanzar(0);

    expect(estadoAnunciado()).toHaveTextContent(/No pudimos usar la cámara/);
    expect(reintentar()).toBeInTheDocument();
    expect(campo()).toHaveFocus();

    fireEvent.click(reintentar()!);
    await avanzar(0);
    expect(estadoAnunciado()).toHaveTextContent(/Apunta al código de barras/);
  });

  it.each(["NotAllowedError", "NotFoundError", "NotReadableError", "TypeError"])(
    "con %s el campo sigue usable y entrega el código",
    async (nombre) => {
      getUserMedia.mockRejectedValue(errorDeCamara(nombre));
      const { onDetectado } = montar();
      await avanzar(0);
      expect(campo()).toBeVisible();
      expect(campo()).toBeEnabled();

      buscar(EAN_13);

      expect(onDetectado).toHaveBeenCalledWith(EAN_13);
    },
  );

  it("un código inválido tras un error de cámara muestra el error del campo", async () => {
    getUserMedia.mockRejectedValue(errorDeCamara("NotAllowedError"));
    montar();
    await avanzar(0);

    buscar("7802910000972");

    expect(screen.getByText(MSG_DIGITO)).toBeInTheDocument();
    expect(estadoAnunciado()).toHaveTextContent(/no tiene permiso para usar la cámara/);
  });
});

describe("Contexto no seguro", () => {
  it("sin contexto seguro explica que hace falta HTTPS y no intenta abrir la cámara", async () => {
    definirContextoSeguro(false);
    montar();
    await avanzar(0);

    expect(estadoAnunciado()).toHaveTextContent(/conexión segura \(HTTPS\)/);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(crearDetector).not.toHaveBeenCalled();
    expect(reintentar()).not.toBeInTheDocument();
    expect(campo()).toHaveFocus();
  });

  it("sin navigator.mediaDevices pasa lo mismo, aunque el contexto sea seguro", async () => {
    Reflect.deleteProperty(navigator, "mediaDevices");
    montar();
    await avanzar(0);

    expect(estadoAnunciado()).toHaveTextContent(/conexión segura \(HTTPS\)/);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(crearDetector).not.toHaveBeenCalled();
    expect(reintentar()).not.toBeInTheDocument();
  });

  it("en un contexto no seguro el ingreso manual funciona", async () => {
    definirContextoSeguro(false);
    const { onDetectado } = montar();
    await avanzar(0);

    buscar(EAN_13);

    expect(onDetectado).toHaveBeenCalledWith(EAN_13);
  });

  it("el escáner no deja pistas ni temporizadores en un contexto no seguro", async () => {
    definirContextoSeguro(false);
    const { unmount } = montar();
    await avanzar(0);

    unmount();
    await avanzar(INTERVALO_DETECCION_MS * 5);

    expect(detect).not.toHaveBeenCalled();
    expect(pista.stop).not.toHaveBeenCalled();
  });
});
