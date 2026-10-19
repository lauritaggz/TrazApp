/// <reference types="node" />
/**
 * The REAL production build of the app, now that the scanner is on a page (T13-05 / HU13).
 *
 * It runs the same build as `npm run build` (the app's own Vite config and its index.html as entry)
 * into a temporary folder and inspects what would be published: the scanner's .wasm is in the app,
 * nothing names a CDN, nothing imports code from a URL, and the decoder is NOT in the code that loads
 * first, so people who never scan do not download it.
 *
 * hu13.build.test.ts does the same with an entry that imports the lector module directly; this one
 * guards the real thing, including that the page really reaches the lector.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "vite";

const CDN = "jsde" + "livr";

let salida: string;
let archivos: string[];

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? listar(ruta) : [ruta];
  });
}

const texto = (ruta: string) => readFileSync(ruta, "utf8");
const nombre = (ruta: string) => relative(salida, ruta).replaceAll("\\", "/");

beforeAll(async () => {
  salida = mkdtempSync(join(tmpdir(), "trazapp-hu13-dist-"));
  await build({
    root: resolve("."),
    configFile: resolve("vite.config.ts"),
    logLevel: "silent",
    build: { outDir: salida, emptyOutDir: true, write: true },
  });
  archivos = listar(salida);
}, 120_000);

afterAll(() => {
  if (salida) rmSync(salida, { recursive: true, force: true });
});

describe("dist/ de la aplicación con el escáner", () => {
  it("contiene el zbar-*.wasm, que es el decodificador de verdad", () => {
    const wasm = archivos.filter((ruta) => /[\\/]zbar-[^\\/]+\.wasm$/.test(ruta));

    expect(wasm.map(nombre)).toHaveLength(1);
    expect(statSync(wasm[0]).size).toBeGreaterThan(100_000);
    expect(nombre(wasm[0])).toMatch(/^assets\/zbar-/);
  });

  it("ningún archivo publicado nombra una CDN", () => {
    const infractores = archivos
      .filter((ruta) => !ruta.endsWith(".wasm") && !/\.(png|jpe?g|webp|ico|woff2?)$/.test(ruta))
      .filter((ruta) => texto(ruta).toLowerCase().includes(CDN))
      .map(nombre);

    expect(infractores).toEqual([]);
  });

  it("ningún archivo de código importa desde una URL externa", () => {
    const infractores = archivos
      .filter((ruta) => /\.(js|html)$/.test(ruta))
      .filter((ruta) => /(?:import|from)\s*\(?\s*["']https?:\/\//.test(texto(ruta)))
      .map(nombre);

    expect(infractores).toEqual([]);
  });

  it("lo único externo que pide la hoja de estilos es la tipografía de Google Fonts, que ya existía", () => {
    // Not part of the scanner: the app has always loaded its font that way. Anything else would be new.
    const externos = archivos
      .filter((ruta) => ruta.endsWith(".css"))
      .flatMap((ruta) => [...texto(ruta).matchAll(/https?:\/\/[^\s"')]+/g)].map((m) => new URL(m[0]).host));

    expect([...new Set(externos)]).toEqual(["fonts.googleapis.com"]);
  });

  it("el decodificador va en un archivo aparte, que el código inicial no incluye ni precarga", () => {
    const js = archivos.filter((ruta) => ruta.endsWith(".js"));
    const conDecodificador = js.filter((ruta) => texto(ruta).includes("zbar.wasm"));
    const html = texto(join(salida, "index.html"));
    const inicial = js.filter((ruta) => html.includes(nombre(ruta)) && /<script[^>]+src=/.test(html));

    expect(conDecodificador.length).toBeGreaterThan(0);
    expect(inicial.length).toBeGreaterThan(0);
    for (const ruta of conDecodificador) {
      expect(inicial.map(nombre)).not.toContain(nombre(ruta));
      expect(html).not.toContain(nombre(ruta));
    }
    for (const ruta of inicial) {
      expect(texto(ruta)).not.toContain("zbar.wasm");
    }
  });

  it("la página de nuevo insumo llega al lector (el escáner está de verdad en la aplicación)", () => {
    const js = archivos.filter((ruta) => ruta.endsWith(".js"));
    const conEscaner = js.filter((ruta) => texto(ruta).includes("Escanear código de barras"));

    expect(conEscaner.length).toBeGreaterThan(0);
  });
});
