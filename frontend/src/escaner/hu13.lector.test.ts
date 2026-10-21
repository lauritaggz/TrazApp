/**
 * The barcode reader picks the native BarcodeDetector or the deferred polyfill (T13-01 / HU13).
 * The polyfill is replaced by a fake here; hu13.polyfill-real.test.ts loads the real one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registro = vi.hoisted(() => ({
  cargasDelPolyfill: 0,
  polyfills: [] as { opciones: unknown }[],
  nativos: [] as { opciones: unknown }[],
}));

vi.mock("@undecaf/barcode-detector-polyfill", () => {
  registro.cargasDelPolyfill += 1;
  class BarcodeDetectorPolyfill {
    opciones: unknown;
    constructor(opciones: unknown) {
      this.opciones = opciones;
      registro.polyfills.push(this);
    }
    async detect() {
      return [];
    }
  }
  return { BarcodeDetectorPolyfill };
});

function instalarNativo(soportados: string[] | Error) {
  class BarcodeDetector {
    static getSupportedFormats = vi.fn(async () => {
      if (soportados instanceof Error) throw soportados;
      return soportados;
    });
    opciones: unknown;
    constructor(opciones: unknown) {
      this.opciones = opciones;
      registro.nativos.push(this);
    }
    async detect() {
      return [];
    }
  }
  vi.stubGlobal("BarcodeDetector", BarcodeDetector);
}

async function cargarLector() {
  return import("@/lib/lectorCodigoBarras");
}

const TRES = { formats: ["ean_13", "ean_8", "upc_a"] };

beforeEach(() => {
  vi.resetModules();
  registro.cargasDelPolyfill = 0;
  registro.polyfills.length = 0;
  registro.nativos.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Lector de códigos de barras (T13-01)", () => {
  it("lee solo EAN-13, EAN-8 y UPC-A", async () => {
    const { FORMATOS_CODIGO_BARRAS } = await cargarLector();

    expect([...FORMATOS_CODIGO_BARRAS]).toEqual(["ean_13", "ean_8", "upc_a"]);
  });

  it("usa el detector nativo cuando soporta los tres formatos", async () => {
    instalarNativo(["qr_code", "ean_13", "ean_8", "upc_a", "code_128"]);
    const { crearDetector } = await cargarLector();

    const { origen } = await crearDetector();

    expect(origen).toBe("nativo");
    expect(registro.nativos).toHaveLength(1);
    expect(registro.nativos[0].opciones).toEqual(TRES);
  });

  it("no carga el polyfill mientras el detector nativo alcanza", async () => {
    instalarNativo(["ean_13", "ean_8", "upc_a"]);
    const { crearDetector } = await cargarLector();

    await crearDetector();

    expect(registro.cargasDelPolyfill).toBe(0);
    expect(registro.polyfills).toHaveLength(0);
  });

  it("usa el polyfill cuando el navegador no tiene BarcodeDetector", async () => {
    vi.stubGlobal("BarcodeDetector", undefined);
    const { crearDetector } = await cargarLector();

    const { origen } = await crearDetector();

    expect(origen).toBe("polyfill");
    expect(registro.cargasDelPolyfill).toBe(1);
    expect(registro.polyfills).toHaveLength(1);
    expect(registro.polyfills[0].opciones).toEqual(TRES);
  });

  it.each([
    ["no lee UPC-A", ["ean_13", "ean_8", "qr_code"]],
    ["no lee EAN-8", ["ean_13", "upc_a"]],
    ["no lee EAN-13", ["ean_8", "upc_a"]],
    ["no lee ninguno de los tres", ["qr_code"]],
    ["no declara formatos", []],
  ])("usa el polyfill cuando el detector nativo %s", async (_caso, soportados) => {
    instalarNativo(soportados);
    const { crearDetector } = await cargarLector();

    const { origen } = await crearDetector();

    expect(origen).toBe("polyfill");
    expect(registro.nativos).toHaveLength(0);
  });

  it("usa el polyfill cuando el detector nativo falla al declarar sus formatos", async () => {
    instalarNativo(new Error("no disponible"));
    const { crearDetector } = await cargarLector();

    const { origen } = await crearDetector();

    expect(origen).toBe("polyfill");
  });

  it("el detector entregado tiene el método detect", async () => {
    vi.stubGlobal("BarcodeDetector", undefined);
    const { crearDetector } = await cargarLector();

    const { detector } = await crearDetector();

    expect(typeof detector.detect).toBe("function");
  });
});
