import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nombreArchivoQr, nombreDeContentDisposition } from "@/lib/qrArchivo";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/tokenStorage";
import { obtenerQr } from "@/services/qrService";
import { ApiError } from "@/types/auth";

function respuesta(status: number, cuerpo: BodyInit | null, headers: Record<string, string> = {}) {
  return new Response(cuerpo, { status, headers });
}

describe("obtenerQr (la descarga necesita el token)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("VITE_API_URL", "http://api.ejemplo.test/");
    setAccessToken("token-de-prueba");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("pide el formato al endpoint con el token y devuelve el blob y el nombre sugerido", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      respuesta(200, "PNGDATA", { "Content-Disposition": 'attachment; filename="qr-GAL-001.png"' }),
    );
    vi.stubGlobal("fetch", fetchFalso);

    const archivo = await obtenerQr(7, "png");

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("http://api.ejemplo.test/gestion/productos/7/qr?formato=png");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-de-prueba");
    expect(await archivo.blob.text()).toBe("PNGDATA");
    expect(archivo.nombre).toBe("qr-GAL-001.png");
  });

  it("sin Content-Disposition legible el nombre queda en null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(200, "<svg/>")));

    expect((await obtenerQr(7, "svg")).nombre).toBeNull();
  });

  it("un 409 (no publicado) llega como ApiError 409 con su mensaje", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respuesta(409, JSON.stringify({ detail: { mensaje: "El producto no está publicado" } }), { "Content-Type": "application/json" })),
    );

    await expect(obtenerQr(7, "png")).rejects.toMatchObject({ status: 409, message: "El producto no está publicado" });
  });

  it("un 401 cierra la sesión local", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(401, null)));

    await expect(obtenerQr(7, "png")).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
  });

  it("un error de red llega como ApiError de estado 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(obtenerQr(7, "png")).rejects.toBeInstanceOf(ApiError);
    await expect(obtenerQr(7, "png")).rejects.toMatchObject({ status: 0 });
  });

  it("sin token no hace la petición", async () => {
    clearAccessToken();
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);

    await expect(obtenerQr(7, "png")).rejects.toMatchObject({ status: 401 });
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

describe("nombres de archivo del QR", () => {
  it("lee el nombre de Content-Disposition", () => {
    expect(nombreDeContentDisposition('attachment; filename="qr-A-B.svg"')).toBe("qr-A-B.svg");
    expect(nombreDeContentDisposition("attachment; filename=qr-x.png")).toBe("qr-x.png");
    expect(nombreDeContentDisposition(null)).toBeNull();
    expect(nombreDeContentDisposition("attachment")).toBeNull();
  });

  it.each([
    ["GAL-001", "qr-GAL-001.png"],
    ['Q/ñ 1"x', "qr-Q-1-x.png"],
    ["../../etc/passwd", "qr-etc-passwd.png"],
    ["///", "qr-7.png"],
    [null, "qr-7.png"],
  ])("el respaldo sanea el código %s", (codigo, esperado) => {
    expect(nombreArchivoQr(codigo, 7, "png")).toBe(esperado);
  });
});
