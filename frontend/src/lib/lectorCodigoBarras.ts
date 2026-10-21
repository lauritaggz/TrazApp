/**
 * Barcode reader for the camera (HU13 / T13-01).
 *
 * It uses the browser's native `BarcodeDetector` when it reads the three formats we accept (Chrome
 * for Android) and, when it does not (Safari on iOS), a ZBar WebAssembly polyfill that is loaded on
 * demand with a deferred `import()`: the decoder and its .wasm never weigh on pages that do not scan.
 * The .wasm is served by the app itself (see vite.alias-zbar.ts), never from a CDN.
 */

/** The only formats the app reads: EAN-13, EAN-8 and UPC-A. */
export const FORMATOS_CODIGO_BARRAS = ["ean_13", "ean_8", "upc_a"] as const;

export type FormatoCodigoBarras = (typeof FORMATOS_CODIGO_BARRAS)[number];

export interface CodigoLeido {
  rawValue: string;
  format: string;
}

export interface DetectorCodigoBarras {
  detect(fuente: HTMLVideoElement): Promise<CodigoLeido[]>;
}

export type OrigenDetector = "nativo" | "polyfill";

export interface DetectorCreado {
  detector: DetectorCodigoBarras;
  origen: OrigenDetector;
}

interface BarcodeDetectorNativo {
  new (opciones: { formats: string[] }): DetectorCodigoBarras;
  getSupportedFormats(): Promise<string[]>;
}

function detectorNativo(): BarcodeDetectorNativo | undefined {
  return (globalThis as { BarcodeDetector?: BarcodeDetectorNativo }).BarcodeDetector;
}

async function leeLosTresFormatos(Nativo: BarcodeDetectorNativo): Promise<boolean> {
  try {
    const soportados = await Nativo.getSupportedFormats();
    return FORMATOS_CODIGO_BARRAS.every((formato) => soportados.includes(formato));
  } catch {
    return false;
  }
}

/** The native detector when it reads EAN-13, EAN-8 and UPC-A; otherwise the deferred polyfill. */
export async function crearDetector(): Promise<DetectorCreado> {
  const formats = [...FORMATOS_CODIGO_BARRAS];

  const Nativo = detectorNativo();
  if (Nativo && (await leeLosTresFormatos(Nativo))) {
    return { detector: new Nativo({ formats }), origen: "nativo" };
  }

  const { BarcodeDetectorPolyfill } = await import("@undecaf/barcode-detector-polyfill");
  return { detector: new BarcodeDetectorPolyfill({ formats }), origen: "polyfill" };
}
