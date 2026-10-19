/// <reference types="node" />
/**
 * The scanner never reaches a third party: no CDN for the decoder, no direct call to the product
 * database (T13-01 / HU13). The backend does the lookup; the frontend only reads the camera.
 *
 * The forbidden words are built from pieces so that this file does not trip over itself.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { URL_ZBAR_WASM_EN_CDN } from "../../vite.alias-zbar.ts";

const CDN = "jsde" + "livr";
const BASE_DE_PRODUCTOS = "openfood" + "facts";

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

describe("Sin CDN ni consultas directas desde el navegador", () => {
  const codigo = archivos("src");

  it("encuentra los archivos de src/ que debe revisar", () => {
    expect(codigo.length).toBeGreaterThan(100);
  });

  it.each([
    ["una CDN", CDN],
    ["Open Food Facts", BASE_DE_PRODUCTOS],
  ])("ningún archivo de src/ nombra %s", (_nombre, palabra) => {
    const infractores = codigo.filter((ruta) =>
      readFileSync(ruta, "utf8").toLowerCase().includes(palabra),
    );

    expect(infractores).toEqual([]);
  });
});

describe("El alias del decodificador sigue la versión instalada del polyfill", () => {
  const polyfill = readFileSync(
    "node_modules/@undecaf/barcode-detector-polyfill/dist/main.js",
    "utf8",
  );

  it("la versión del polyfill está fijada, sin ^ ni ~", () => {
    const paquete = JSON.parse(readFileSync("package.json", "utf8"));

    expect(paquete.dependencies["@undecaf/barcode-detector-polyfill"]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("el polyfill instalado importa zbar-wasm exactamente desde la URL que el alias reemplaza", () => {
    // If a new polyfill version moves that URL, the alias stops matching and the .wasm would be
    // fetched from the CDN again: this fails first and says why.
    expect(polyfill.split(URL_ZBAR_WASM_EN_CDN)).toHaveLength(2);
    expect(polyfill).toContain(`from"${URL_ZBAR_WASM_EN_CDN}"`);
  });

  it("no hay otra URL externa de la que el polyfill importe código", () => {
    const imports = [...polyfill.matchAll(/(?:import|from)\s*"(https?:\/\/[^"]+)"/g)].map((m) => m[1]);

    expect(imports).toEqual([URL_ZBAR_WASM_EN_CDN]);
  });

  it("vite.config.ts y vitest.config.ts aplican el alias", () => {
    for (const config of ["vite.config.ts", "vitest.config.ts"]) {
      expect(readFileSync(config, "utf8"), config).toContain("...aliasZbarWasm");
    }
  });
});
