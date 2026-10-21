/// <reference types="node" />
/**
 * The production build serves the scanner's .wasm from the app itself (T13-01 / HU13).
 *
 * It builds the lector module with the app's real Vite configuration into a temporary folder and
 * inspects the output: the zbar-*.wasm is there, and nothing in it names a CDN or imports from a URL.
 * If the alias of vite.alias-zbar.ts stops matching the polyfill (for example after an upgrade), the
 * build keeps the CDN import and this test fails.
 *
 * The scanner is not on any page yet (T13-05), so a plain `npm run build` does not include it; this
 * build uses an entry that imports it. T13-05 adds the check on the real dist/.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "vite";

const CDN = "jsde" + "livr";
const ENTRADA_VIRTUAL = "virtual:hu13-entrada";

let salida: string;
let archivos: string[];

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? listar(ruta) : [ruta];
  });
}

beforeAll(async () => {
  salida = mkdtempSync(join(tmpdir(), "trazapp-hu13-build-"));
  await build({
    root: resolve("."),
    configFile: resolve("vite.config.ts"),
    logLevel: "silent",
    plugins: [
      {
        name: "hu13-entrada-virtual",
        resolveId: (id) => (id === ENTRADA_VIRTUAL ? `\0${ENTRADA_VIRTUAL}` : null),
        load: (id) =>
          id === `\0${ENTRADA_VIRTUAL}`
            ? 'import { crearDetector } from "@/lib/lectorCodigoBarras"; globalThis.__crearDetector = crearDetector;'
            : null,
      },
    ],
    build: {
      outDir: salida,
      emptyOutDir: true,
      minify: false,
      write: true,
      rollupOptions: { input: ENTRADA_VIRTUAL },
    },
  });
  archivos = listar(salida);
}, 120_000);

afterAll(() => {
  if (salida) rmSync(salida, { recursive: true, force: true });
});

describe("Build del lector de códigos de barras", () => {
  it("incluye el zbar-*.wasm entre los archivos de la app", () => {
    const wasm = archivos.filter((ruta) => /[\\/]zbar-[^\\/]+\.wasm$/.test(ruta));

    expect(wasm).toHaveLength(1);
    // The binary is the real decoder, not an empty placeholder.
    expect(statSync(wasm[0]).size).toBeGreaterThan(100_000);
  });

  it("no nombra ninguna CDN en ningún archivo generado", () => {
    const infractores = archivos
      .filter((ruta) => !ruta.endsWith(".wasm"))
      .filter((ruta) => readFileSync(ruta, "utf8").toLowerCase().includes(CDN))
      .map((ruta) => ruta.slice(salida.length + 1));

    expect(infractores).toEqual([]);
  });

  it("no importa código desde una URL externa", () => {
    const infractores = archivos
      .filter((ruta) => /\.(js|css|html)$/.test(ruta))
      .filter((ruta) => /(?:import|from)\s*\(?\s*["']https?:\/\//.test(readFileSync(ruta, "utf8")))
      .map((ruta) => ruta.slice(salida.length + 1));

    expect(infractores).toEqual([]);
  });

  it("carga el polyfill por separado, solo cuando se necesita", () => {
    const js = archivos.filter((ruta) => ruta.endsWith(".js"));
    const entrada = js.find((ruta) => readFileSync(ruta, "utf8").includes("__crearDetector"));
    const conDecodificador = js.filter((ruta) => readFileSync(ruta, "utf8").includes("zbar.wasm"));

    expect(entrada).toBeDefined();
    // The decoder lives in a chunk fetched by a dynamic import(), not in the file that starts first.
    expect(readFileSync(entrada!, "utf8")).toMatch(/import\(/);
    expect(conDecodificador.length).toBeGreaterThan(0);
    expect(conDecodificador).not.toContain(entrada);
  });
});
