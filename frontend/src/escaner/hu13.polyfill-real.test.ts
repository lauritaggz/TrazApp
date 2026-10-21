/**
 * The REAL polyfill (not a fake) loads and builds a detector under Vitest (T13-01 / HU13).
 *
 * Its entry point imports @undecaf/zbar-wasm from a hard-coded CDN URL. Without the alias of
 * vite.alias-zbar.ts that import cannot be resolved here, so this test also guards the alias.
 */
import { describe, expect, it, vi } from "vitest";
import { crearDetector, FORMATOS_CODIGO_BARRAS } from "@/lib/lectorCodigoBarras";

describe("Polyfill real bajo Vitest", () => {
  it("se importa sin pedir nada a la red y expone el detector", async () => {
    const fetchEspia = vi.spyOn(globalThis, "fetch");
    vi.stubGlobal("BarcodeDetector", undefined);

    const { detector, origen } = await crearDetector();

    expect(origen).toBe("polyfill");
    expect(typeof detector.detect).toBe("function");
    expect(fetchEspia).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    fetchEspia.mockRestore();
  });

  it("el polyfill declara los tres formatos que usamos", async () => {
    const { BarcodeDetectorPolyfill } = await import("@undecaf/barcode-detector-polyfill");

    const soportados = await BarcodeDetectorPolyfill.getSupportedFormats();

    for (const formato of FORMATOS_CODIGO_BARRAS) expect(soportados).toContain(formato);
  });
});
