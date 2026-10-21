/// <reference types="node" />
/**
 * `npm run dev:https` (T13-07 / HU13): the dev server over HTTPS with the API forwarded, so the
 * scanner can be tried on a phone. What matters as much as the mode itself is that `npm run dev` and
 * the build stay exactly as they were. The backend is a fake local server; nothing leaves the PC.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { build, createServer, resolveConfig, type InlineConfig, type ViteDevServer } from "vite";
import { apiRequest, getApiBaseUrl } from "@/lib/apiClient";
import { BACKEND_LOCAL, proxyDeLaApi, quitarPrefijoApi, usaHttpsDeDesarrollo } from "../../vite.dev-https.ts";

const CONFIG = resolve("vite.config.ts");
const VARIABLES = ["VITE_DEV_HTTPS", "VITE_DEV_API_TARGET"] as const;

let anteriores: Record<string, string | undefined>;
beforeEach(() => {
  anteriores = Object.fromEntries(VARIABLES.map((nombre) => [nombre, process.env[nombre]]));
  for (const nombre of VARIABLES) delete process.env[nombre];
});
afterEach(() => {
  for (const nombre of VARIABLES) {
    if (anteriores[nombre] === undefined) delete process.env[nombre];
    else process.env[nombre] = anteriores[nombre];
  }
});

const nombresDePlugins = (plugins: readonly { name: string }[]) => plugins.map((plugin) => plugin.name);

async function configuracion(comando: "serve" | "build", cacheDir?: string) {
  return resolveConfig({ configFile: CONFIG, logLevel: "silent", ...(cacheDir ? { cacheDir } : {}) }, comando);
}

// =============================================================================================

describe("Cuándo se activa el modo HTTPS", () => {
  it.each([
    ["1", "serve", true],
    ["1", "build", false],
    [undefined, "serve", false],
    ["", "serve", false],
    ["0", "serve", false],
    ["true", "serve", false],
    ["si", "serve", false],
  ])("VITE_DEV_HTTPS=%j con «%s» es %s", (valor, comando, esperado) => {
    expect(usaHttpsDeDesarrollo({ VITE_DEV_HTTPS: valor }, comando)).toBe(esperado);
  });

  it("el proxy reenvía /api al backend local, o al que indique VITE_DEV_API_TARGET", () => {
    const [[clave, regla]] = Object.entries(proxyDeLaApi({}));
    expect(clave).toBe("^/api(/|$)");
    expect(regla.target).toBe(BACKEND_LOCAL);
    expect(BACKEND_LOCAL).toBe("http://localhost:8000");
    expect(Object.values(proxyDeLaApi({ VITE_DEV_API_TARGET: "http://127.0.0.1:9000" }))[0].target).toBe(
      "http://127.0.0.1:9000",
    );
  });

  it.each([
    ["/api/gestion/insumos", "/gestion/insumos"],
    ["/api/gestion/insumos?activo=false&x=1", "/gestion/insumos?activo=false&x=1"],
    ["/api/uploads/products/1.png", "/uploads/products/1.png"],
    ["/api", ""],
    ["/api/", "/"],
    ["/apiary/x", "/apiary/x"],
    ["/api-docs", "/api-docs"],
  ])("quita el prefijo: %s -> %s", (entrada, esperado) => {
    expect(quitarPrefijoApi(entrada)).toBe(esperado);
  });

  it("la clave del proxy no atrapa rutas que solo empiezan parecido a /api", () => {
    const [[clave]] = Object.entries(proxyDeLaApi({}));
    const expresion = new RegExp(clave);
    expect(expresion.test("/api/gestion/insumos")).toBe(true);
    expect(expresion.test("/api")).toBe(true);
    expect(expresion.test("/api-docs")).toBe(false);
    expect(expresion.test("/apiary")).toBe(false);
    expect(expresion.test("/src/lib/apiClient.ts")).toBe(false);
  });
});

// =============================================================================================

describe("La configuración de Vite en cada modo", () => {
  it("npm run dev, sin la variable: igual que antes (sin certificado ni proxy)", async () => {
    const config = await configuracion("serve");

    expect(nombresDePlugins(config.plugins)).not.toContain("vite:basic-ssl");
    expect(config.server.https).toBeFalsy();
    expect(Object.keys(config.server.proxy ?? {})).toEqual([]);
    expect(config.server.host).toBe("0.0.0.0");
    expect(config.server.port).toBe(5175);
    expect(config.server.watch).toEqual({ usePolling: true });
  });

  it("dev:https (VITE_DEV_HTTPS=1): certificado propio y proxy hacia el backend local", async () => {
    process.env.VITE_DEV_HTTPS = "1";
    const cacheDir = mkdtempSync(join(tmpdir(), "trazapp-ssl-"));
    try {
      const config = await configuracion("serve", cacheDir);

      expect(nombresDePlugins(config.plugins)).toContain("vite:basic-ssl");
      expect(config.server.https).toBeTruthy();
      expect(Object.keys(config.server.proxy ?? {})).toEqual(["^/api(/|$)"]);
      // The rest of the server is the same as in `npm run dev`.
      expect(config.server.host).toBe("0.0.0.0");
      expect(config.server.port).toBe(5175);
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it("el build ignora la variable: sin certificado ni proxy", async () => {
    process.env.VITE_DEV_HTTPS = "1";

    const config = await configuracion("build");

    expect(nombresDePlugins(config.plugins)).not.toContain("vite:basic-ssl");
    expect(config.server.https).toBeFalsy();
    expect(Object.keys(config.server.proxy ?? {})).toEqual([]);
  });

  it.each(["0", "true", ""])("VITE_DEV_HTTPS=%j no enciende nada", async (valor) => {
    process.env.VITE_DEV_HTTPS = valor;

    const config = await configuracion("serve");

    expect(nombresDePlugins(config.plugins)).not.toContain("vite:basic-ssl");
    expect(config.server.https).toBeFalsy();
  });
});

// =============================================================================================

describe("El build no cambia", () => {
  function huellas(dir: string): Record<string, string> {
    const lista = (carpeta: string): string[] =>
      readdirSync(carpeta).flatMap((nombre) => {
        const ruta = join(carpeta, nombre);
        return statSync(ruta).isDirectory() ? lista(ruta) : [ruta];
      });
    return Object.fromEntries(
      lista(dir).map((ruta) => [
        relative(dir, ruta).replaceAll("\\", "/"),
        createHash("sha256").update(readFileSync(ruta)).digest("hex"),
      ]),
    );
  }

  async function construir(): Promise<Record<string, string>> {
    const salida = mkdtempSync(join(tmpdir(), "trazapp-dev-https-build-"));
    try {
      await build({
        root: resolve("."),
        configFile: CONFIG,
        logLevel: "silent",
        build: { outDir: salida, emptyOutDir: true },
      });
      return huellas(salida);
    } finally {
      rmSync(salida, { recursive: true, force: true });
    }
  }

  it("con VITE_DEV_HTTPS=1 el build produce exactamente los mismos archivos que sin la variable", async () => {
    const sin = await construir();
    process.env.VITE_DEV_HTTPS = "1";
    const con = await construir();

    expect(Object.keys(sin).length).toBeGreaterThan(5);
    expect(con).toEqual(sin);
  }, 120_000);
});

// =============================================================================================

describe("El servidor de dev:https de verdad", () => {
  let backend: http.Server;
  let servidor: ViteDevServer;
  let cacheDir: string;
  let apiUrlAnterior: string | undefined;
  const pedidos: { metodo?: string; url?: string; host?: string; auth?: string }[] = [];

  beforeEach(async () => {
    pedidos.length = 0;
    backend = http.createServer((req, res) => {
      pedidos.push({ metodo: req.method, url: req.url, host: req.headers.host, auth: req.headers.authorization });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ desde: "backend-falso", ruta: req.url }));
    });
    await new Promise<void>((listo) => backend.listen(0, "127.0.0.1", listo));
    const puertoBackend = (backend.address() as AddressInfo).port;

    process.env.VITE_DEV_HTTPS = "1";
    process.env.VITE_DEV_API_TARGET = `http://127.0.0.1:${puertoBackend}`;
    apiUrlAnterior = process.env.VITE_API_URL;
    process.env.VITE_API_URL = "/api";
    cacheDir = mkdtempSync(join(tmpdir(), "trazapp-dev-https-"));
    const opciones: InlineConfig = {
      configFile: CONFIG,
      logLevel: "silent",
      cacheDir,
      server: { host: "127.0.0.1", port: 0, strictPort: false, watch: null },
    };
    servidor = await createServer(opciones);
    await servidor.listen();
  }, 60_000);

  afterEach(async () => {
    await servidor?.close();
    await new Promise<void>((listo) => backend.close(() => listo()));
    rmSync(cacheDir, { recursive: true, force: true });
    if (apiUrlAnterior === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = apiUrlAnterior;
  }, 60_000);

  function pedir(ruta: string, cabeceras: Record<string, string> = {}) {
    const puerto = (servidor.httpServer?.address() as AddressInfo).port;
    return new Promise<{ estado: number; cuerpo: string; tipo: string }>((listo, falla) => {
      const peticion = https.request(
        { host: "127.0.0.1", port: puerto, path: ruta, headers: cabeceras, rejectUnauthorized: false },
        (respuesta) => {
          let cuerpo = "";
          respuesta.on("data", (trozo) => (cuerpo += trozo));
          respuesta.on("end", () =>
            listo({ estado: respuesta.statusCode ?? 0, cuerpo, tipo: String(respuesta.headers["content-type"] ?? "") }),
          );
        },
      );
      peticion.on("error", falla);
      peticion.end();
    });
  }

  it("sirve la aplicación por HTTPS", async () => {
    const respuesta = await pedir("/");

    expect(respuesta.estado).toBe(200);
    expect(respuesta.tipo).toContain("text/html");
    expect(respuesta.cuerpo).toContain('<div id="root">');
  });

  it("reenvía /api/... al backend quitando el prefijo, con el método y el token", async () => {
    const respuesta = await pedir("/api/gestion/insumos?activo=false", { Authorization: "Bearer prueba" });

    expect(respuesta.estado).toBe(200);
    expect(JSON.parse(respuesta.cuerpo)).toEqual({ desde: "backend-falso", ruta: "/gestion/insumos?activo=false" });
    expect(pedidos).toEqual([
      { metodo: "GET", url: "/gestion/insumos?activo=false", host: expect.stringContaining("127.0.0.1"), auth: "Bearer prueba" },
    ]);
  });

  it("lo que no es /api lo sigue sirviendo Vite, no el backend (ni siquiera /api-docs)", async () => {
    const cliente = await pedir("/@vite/client");
    const parecida = await pedir("/api-docs");

    expect(cliente.estado).toBe(200);
    expect(cliente.cuerpo).not.toContain("backend-falso");
    // Looks like /api but is not: it is the app (index.html), and the backend never hears of it.
    expect(parecida.tipo).toContain("text/html");
    expect(parecida.cuerpo).toContain('<div id="root">');
    expect(pedidos).toEqual([]);
  });

  it("la aplicación recibe la API como ruta relativa cuando el script pone VITE_API_URL=/api", async () => {
    // What scripts/dev-https.mjs does before starting: the proxy catches exactly this prefix.
    const respuesta = await pedir("/src/lib/apiClient.ts");

    expect(respuesta.estado).toBe(200);
    expect(respuesta.cuerpo).toContain('"VITE_API_URL": "/api"');
    expect(respuesta.cuerpo).not.toContain("localhost:8000");
  });
});

// =============================================================================================

describe("La aplicación con la API como ruta relativa (VITE_API_URL=/api)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("arma las direcciones relativas, sin barra final doble", () => {
    vi.stubEnv("VITE_API_URL", "/api");
    expect(getApiBaseUrl()).toBe("/api");
    vi.stubEnv("VITE_API_URL", "/api/");
    expect(getApiBaseUrl()).toBe("/api");
  });

  it("las llamadas a la API van a /api/..., que es lo que atrapa el proxy", async () => {
    vi.stubEnv("VITE_API_URL", "/api");
    const fetchFalso = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);

    await apiRequest("/gestion/insumos?activo=false", { method: "GET" }, false);

    expect(fetchFalso.mock.calls[0][0]).toBe("/api/gestion/insumos?activo=false");
  });

  it("con la dirección completa de siempre (npm run dev) nada cambia", async () => {
    vi.stubEnv("VITE_API_URL", "http://localhost:8000");
    const fetchFalso = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);

    await apiRequest("/gestion/insumos", { method: "GET" }, false);

    expect(fetchFalso.mock.calls[0][0]).toBe("http://localhost:8000/gestion/insumos");
  });
});

// =============================================================================================

describe("Los scripts de package.json", () => {
  const paquete = JSON.parse(readFileSync("package.json", "utf8"));

  it("dev:https existe y npm run dev y el build no cambiaron", () => {
    expect(paquete.scripts["dev:https"]).toBe("node ./scripts/dev-https.mjs");
    expect(paquete.scripts.dev).toBe("vite");
    expect(paquete.scripts.build).toBe("node ./scripts/check-netlify-env.mjs && tsc -b && vite build");
  });

  it("el plugin del certificado es una dependencia de desarrollo con versión exacta", () => {
    expect(paquete.devDependencies["@vitejs/plugin-basic-ssl"]).toMatch(/^\d+\.\d+\.\d+$/);
    expect(paquete.dependencies?.["@vitejs/plugin-basic-ssl"]).toBeUndefined();
  });

  it("el script pone las dos variables antes de arrancar Vite y expone el servidor en la red", () => {
    const script = readFileSync("scripts/dev-https.mjs", "utf8");

    expect(script.indexOf('process.env.VITE_DEV_HTTPS = "1"')).toBeGreaterThan(-1);
    expect(script.indexOf('process.env.VITE_API_URL = "/api"')).toBeGreaterThan(-1);
    expect(script.indexOf("VITE_DEV_HTTPS")).toBeLessThan(script.indexOf("createServer("));
    expect(script).toContain('host: "0.0.0.0"');
  });
});
