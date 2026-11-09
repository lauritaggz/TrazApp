import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerFichaPublica } from "@/services/consultaPublicaService";
import { setAccessToken } from "@/lib/tokenStorage";
import { ApiError } from "@/types/auth";
import { fichaDePrueba } from "@/publico/fichaPublicaDatos";

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
}

describe("servicio de la consulta pública (HU10)", () => {
  const fetchFalso = vi.fn();

  beforeEach(() => {
    fetchFalso.mockReset();
    vi.stubGlobal("fetch", fetchFalso);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("nunca envía Authorization, aunque haya una sesión abierta en el navegador", async () => {
    setAccessToken("token-del-productor");
    fetchFalso.mockImplementation(async () => respuesta(fichaDePrueba()));

    await obtenerFichaPublica("tok123");

    const [, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    const cabeceras = new Headers(init.headers);
    expect(cabeceras.has("Authorization")).toBe(false);
    expect(JSON.stringify(fetchFalso.mock.calls)).not.toContain("token-del-productor");
  });

  it("pide la ficha por id público sin parámetros y sin caché", async () => {
    fetchFalso.mockImplementation(async () => respuesta(fichaDePrueba()));

    const ficha = await obtenerFichaPublica("tok123");

    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/publico/productos/tok123");
    expect(init.cache).toBe("no-store");
    expect(ficha.producto.nombre).toBe("Mermelada de frutilla");
  });

  it("agrega el código o la fecha como parámetros y codifica el id público", async () => {
    fetchFalso.mockImplementation(async () => respuesta(fichaDePrueba()));

    await obtenerFichaPublica("a/b c", { codigo: "E 1/2" });
    await obtenerFichaPublica("tok123", { fecha: "2026-03-18" });

    expect(fetchFalso.mock.calls[0][0]).toBe("http://localhost:8000/publico/productos/a%2Fb%20c?codigo=E+1%2F2");
    expect(fetchFalso.mock.calls[1][0]).toBe("http://localhost:8000/publico/productos/tok123?fecha=2026-03-18");
  });

  it("traduce el 404 uniforme, el 422, el 500 y la falta de red a ApiError con su estado", async () => {
    fetchFalso.mockResolvedValueOnce(respuesta({ detail: { mensaje: "Información no disponible" } }, 404));
    await expect(obtenerFichaPublica("x")).rejects.toMatchObject({ status: 404 });

    fetchFalso.mockResolvedValueOnce(respuesta({ detail: { mensaje: "La fecha debe tener el formato AAAA-MM-DD." } }, 422));
    await expect(obtenerFichaPublica("x", { fecha: "hoy" })).rejects.toMatchObject({
      status: 422,
      message: "La fecha debe tener el formato AAAA-MM-DD.",
    });

    fetchFalso.mockResolvedValueOnce(respuesta({ detail: { mensaje: "No se pudo mostrar la información." } }, 500));
    await expect(obtenerFichaPublica("x")).rejects.toMatchObject({ status: 500 });

    fetchFalso.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const error = await obtenerFichaPublica("x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });
});
