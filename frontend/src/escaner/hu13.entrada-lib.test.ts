/**
 * Pure rules behind the manual entry and the camera messages (T13-02 / HU13).
 */
import { describe, expect, it } from "vitest";
import { MENSAJE_CODIGO_DIGITO_VERIFICADOR, MENSAJE_CODIGO_FORMATO } from "@/lib/codigoBarras";
import {
  limpiarEntradaManual,
  MENSAJE_CODIGO_VACIO,
  validarEntradaManual,
} from "@/lib/entradaCodigoBarras";
import {
  clasificarErrorCamara,
  ContextoInseguroError,
  ERRORES_CAMARA,
  type TipoErrorCamara,
} from "@/lib/errorCamara";

const EAN_13 = "7802910000971";
const UPC_A = "036000291452";
const EAN_8 = "96385074";

describe("Entrada manual del código", () => {
  it.each([
    ["780 291 0000971", EAN_13],
    ["780-291-0000971", EAN_13],
    ["  7802910000971\n", EAN_13],
    ["7802910 - 000971", EAN_13],
    ["7802910–000971", EAN_13], // en dash, as copied from a PDF
    ["7802910‑000971", EAN_13], // non-breaking hyphen
    ["0360 0029-1452", "036000291452"],
    ["", ""],
    ["abc", "abc"],
  ])("limpia %j", (entrada, esperado) => {
    expect(limpiarEntradaManual(entrada)).toBe(esperado);
  });

  it.each([
    ["EAN-13", EAN_13],
    ["UPC-A", UPC_A],
    ["EAN-8", EAN_8],
    ["EAN-13 con espacios", "780 291 0000971"],
    ["EAN-13 con guiones", "780-291-0000971"],
    ["UPC-A con espacios y guiones", "0 36000-29145 2"],
    ["EAN-13 que empieza con cero", "0036000291452"],
  ])("acepta un %s válido", (_nombre, entrada) => {
    const resultado = validarEntradaManual(entrada);

    expect(resultado.error).toBeNull();
    expect(resultado.codigo).toBe(limpiarEntradaManual(entrada));
  });

  it("conserva los ceros del comienzo", () => {
    expect(validarEntradaManual("0036000291452").codigo).toBe("0036000291452");
  });

  it.each([
    ["dígito verificador inválido en un EAN-13", "7802910000972", MENSAJE_CODIGO_DIGITO_VERIFICADOR],
    ["dígito verificador inválido en un UPC-A", "036000291453", MENSAJE_CODIGO_DIGITO_VERIFICADOR],
    ["dígito verificador inválido en un EAN-8", "96385075", MENSAJE_CODIGO_DIGITO_VERIFICADOR],
    ["pocos dígitos", "12345", MENSAJE_CODIGO_FORMATO],
    ["11 dígitos", "78029100009", MENSAJE_CODIGO_FORMATO],
    ["14 dígitos", "78029100009710", MENSAJE_CODIGO_FORMATO],
    ["letras", "78029100009AB", MENSAJE_CODIGO_FORMATO],
    ["solo letras", "abcdefgh", MENSAJE_CODIGO_FORMATO],
    ["símbolos", "7802910.00971", MENSAJE_CODIGO_FORMATO],
    ["dígitos fuera de ASCII", "７８０２９１００００９７１", MENSAJE_CODIGO_FORMATO],
  ])("rechaza %s", (_nombre, entrada, mensaje) => {
    expect(validarEntradaManual(entrada)).toEqual({ codigo: null, error: mensaje });
  });

  it.each(["", "   ", " - - ", "\n"])("pide el número si el campo está vacío (%j)", (entrada) => {
    expect(validarEntradaManual(entrada)).toEqual({ codigo: null, error: MENSAJE_CODIGO_VACIO });
  });

  it("los mensajes están en español", () => {
    expect(MENSAJE_CODIGO_FORMATO).toMatch(/dígitos/);
    expect(MENSAJE_CODIGO_DIGITO_VERIFICADOR).toMatch(/dígito verificador/);
    expect(MENSAJE_CODIGO_VACIO).toMatch(/Ingresa/);
  });
});

function conNombre(name: string) {
  return Object.assign(new Error("falla"), { name });
}

describe("Clasificación de los errores de la cámara", () => {
  it.each<[string, unknown, TipoErrorCamara]>([
    ["NotAllowedError", conNombre("NotAllowedError"), "permiso_denegado"],
    ["SecurityError", conNombre("SecurityError"), "permiso_denegado"],
    ["PermissionDeniedError (nombre antiguo)", conNombre("PermissionDeniedError"), "permiso_denegado"],
    ["NotFoundError", conNombre("NotFoundError"), "sin_camara"],
    ["OverconstrainedError", conNombre("OverconstrainedError"), "sin_camara"],
    ["DevicesNotFoundError (nombre antiguo)", conNombre("DevicesNotFoundError"), "sin_camara"],
    ["NotReadableError", conNombre("NotReadableError"), "camara_ocupada"],
    ["AbortError", conNombre("AbortError"), "camara_ocupada"],
    ["TrackStartError (nombre antiguo)", conNombre("TrackStartError"), "camara_ocupada"],
    ["ContextoInseguroError", new ContextoInseguroError(), "contexto_inseguro"],
    ["un error de otro tipo", conNombre("TypeError"), "otro"],
    ["un Error común", new Error("boom"), "otro"],
    ["un DOMException de otro nombre", new DOMException("x", "InvalidStateError"), "otro"],
    ["un DOMException NotAllowedError real", new DOMException("x", "NotAllowedError"), "permiso_denegado"],
    ["un texto", "NotAllowedError", "otro"],
    ["null", null, "otro"],
    ["undefined", undefined, "otro"],
    ["un objeto sin nombre", {}, "otro"],
    ["un objeto con nombre que no es texto", { name: 42 }, "otro"],
  ])("%s", (_nombre, error, tipo) => {
    expect(clasificarErrorCamara(error)).toBe(tipo);
  });

  it("cada caso tiene su mensaje y los mensajes son distintos", () => {
    const mensajes = Object.values(ERRORES_CAMARA).map((caso) => caso.mensaje);

    expect(mensajes).toHaveLength(5);
    expect(new Set(mensajes).size).toBe(5);
    for (const mensaje of mensajes) expect(mensaje.length).toBeGreaterThan(30);
  });

  it("solo la cámara ocupada y el error genérico ofrecen reintentar", () => {
    const reintentables = Object.entries(ERRORES_CAMARA)
      .filter(([, caso]) => caso.reintentable)
      .map(([tipo]) => tipo)
      .sort();

    expect(reintentables).toEqual(["camara_ocupada", "otro"]);
  });

  it("el permiso denegado explica cómo habilitar la cámara", () => {
    expect(ERRORES_CAMARA.permiso_denegado.mensaje).toMatch(/permiso/i);
    expect(ERRORES_CAMARA.permiso_denegado.mensaje).toMatch(/candado|configuración|permite/i);
  });

  it("el contexto inseguro menciona HTTPS", () => {
    expect(ERRORES_CAMARA.contexto_inseguro.mensaje).toMatch(/HTTPS/);
  });

  it("todos los mensajes ofrecen el ingreso manual", () => {
    for (const [tipo, caso] of Object.entries(ERRORES_CAMARA)) {
      expect(caso.mensaje, tipo).toMatch(/ingresa el número del código de barras/i);
    }
  });
});
