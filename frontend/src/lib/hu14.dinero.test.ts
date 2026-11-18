import { describe, expect, it } from "vitest";
import {
  canonico,
  destinoDeRetorno,
  enlaceDeEdicionDesdeCalculadora,
  etiquetaDeOrigen,
  slugDeJumbo,
  validarContenido,
  validarPrecio,
} from "@/lib/costosInsumo";
import {
  formatearCantidad,
  formatearFechaCorta,
  formatearPesos,
  formatearPrecio,
  redondearPesos,
} from "@/lib/dinero";

describe("HU14 — redondeo a pesos sobre el texto (ROUND_HALF_UP)", () => {
  it.each([
    ["0.0000", "0"],
    ["0.4999", "0"],
    ["0.5000", "1"],
    ["0.5", "1"],
    ["1.4999", "1"],
    ["1.5000", "2"],
    ["62.5625", "63"],
    ["250.0000", "250"],
    ["999.4999", "999"],
    ["999.5000", "1000"],
    ["9999.9999", "10000"],
    ["99.5", "100"],
    ["1249.5000", "1250"],
    ["1249.4999", "1249"],
    ["123456789.5000", "123456790"],
    ["2.5000", "3"],
    ["3.5000", "4"],
    ["007.2", "7"],
    ["1000", "1000"],
  ])("redondearPesos(%s) = %s", (entrada, esperado) => {
    expect(redondearPesos(entrada)).toBe(esperado);
  });

  it("el empate se aleja del cero también con negativos, como Decimal ROUND_HALF_UP", () => {
    expect(redondearPesos("-0.5000")).toBe("-1");
    expect(redondearPesos("-2.4999")).toBe("-2");
    expect(redondearPesos("-0.4999")).toBe("0");
  });

  it.each(["", "abc", "1,5", "1.2.3", ".5", "5.", " ", "NaN", "1e3"])("%j no es un decimal", (entrada) => {
    expect(redondearPesos(entrada)).toBeNull();
  });

  it("sin float: los casos donde Number() redondea distinto", () => {
    // 2^53 + 1 no es representable como number: Number("9007199254740993.4") da ...992.
    expect(redondearPesos("9007199254740993.4000")).toBe("9007199254740993");
    // Con muchos decimales Number() sube a 1.5 y Math.round da 2; el texto dice 1.4999… → 1.
    expect(redondearPesos("1.4999999999999999999")).toBe("1");
    expect(formatearPesos("9007199254740993.4000")).toBe("$9.007.199.254.740.993");
  });

  it("sin float: un número de 17 dígitos no pierde precisión", () => {
    // Con Number() 12345678901234567.5 no es representable; sobre el texto sí.
    expect(redondearPesos("12345678901234567.5000")).toBe("12345678901234568");
    expect(redondearPesos("99999999999999999999.9999")).toBe("100000000000000000000");
  });
});

describe("HU14 — formato de pesos, precios y cantidades", () => {
  it.each([
    ["250.0000", "$250"],
    ["1250.0000", "$1.250"],
    ["1249.5000", "$1.250"],
    ["1234567.4999", "$1.234.567"],
    ["0.0000", "$0"],
    ["62.5625", "$63"],
    [null, "—"],
    [undefined, "—"],
    ["", "—"],
  ])("formatearPesos(%j) = %s", (entrada, esperado) => {
    expect(formatearPesos(entrada)).toBe(esperado);
  });

  it("formatearPesos de un negativo antepone el signo", () => {
    expect(formatearPesos("-1250.5000")).toBe("-$1.251");
  });

  it.each([
    ["1000.00", "$1.000"],
    ["1000.50", "$1.000,50"],
    ["1250.05", "$1.250,05"],
    ["990.10", "$990,10"],
    ["0.00", "$0"],
    [null, "—"],
  ])("formatearPrecio(%j) = %s: sin centavos salvo que existan", (entrada, esperado) => {
    expect(formatearPrecio(entrada)).toBe(esperado);
  });

  it.each([
    ["250.000", "250"],
    ["1.500", "1,5"],
    ["0.125", "0,125"],
    ["1000.000", "1.000"],
    ["12.050", "12,05"],
    [null, "—"],
  ])("formatearCantidad(%j) = %s", (entrada, esperado) => {
    expect(formatearCantidad(entrada)).toBe(esperado);
  });

  it("las marcas de tiempo se muestran en America/Santiago, no en UTC", () => {
    // Verano (UTC-3, desde septiembre): 01:30Z son las 22:30 del día anterior en Chile.
    expect(formatearFechaCorta("2026-11-13T01:30:00Z")).toBe("12-11-2026");
    expect(formatearFechaCorta("2026-11-13T02:59:59Z")).toBe("12-11-2026");
    expect(formatearFechaCorta("2026-11-13T03:00:00Z")).toBe("13-11-2026");
    expect(formatearFechaCorta("2026-11-12T23:59:59Z")).toBe("12-11-2026");
    expect(formatearFechaCorta("2026-01-01T00:00:00+00:00")).toBe("31-12-2025");
    // Invierno (UTC-4): el corte pasa a las 04:00Z.
    expect(formatearFechaCorta("2026-07-13T03:59:59Z")).toBe("12-07-2026");
    expect(formatearFechaCorta("2026-07-13T04:00:00Z")).toBe("13-07-2026");
  });

  it("respeta el desfase explícito y trata una marca sin zona como UTC", () => {
    expect(formatearFechaCorta("2026-11-12T22:30:00-03:00")).toBe("12-11-2026");
    expect(formatearFechaCorta("2026-11-13T01:30:00+00:00")).toBe("12-11-2026");
    expect(formatearFechaCorta("2026-11-13T01:30:00")).toBe("12-11-2026");
    expect(formatearFechaCorta("2026-11-13T01:30:00.123456")).toBe("12-11-2026");
  });

  it("el cambio de horario no corre el día: último día de invierno y primero de verano", () => {
    // 2026: en Chile el verano empieza el domingo 6 de septiembre (a las 04:00Z el reloj salta una hora).
    expect(formatearFechaCorta("2026-09-06T03:30:00Z")).toBe("05-09-2026");
    expect(formatearFechaCorta("2026-09-06T04:30:00Z")).toBe("06-09-2026");
  });

  it("un texto que es solo una fecha no tiene hora y no se mueve", () => {
    expect(formatearFechaCorta("2026-11-12")).toBe("12-11-2026");
  });

  it("basura o ausencia no es una fecha", () => {
    expect(formatearFechaCorta("basura")).toBeNull();
    expect(formatearFechaCorta("2026-13-45T10:00:00Z")).toBeNull();
    expect(formatearFechaCorta(null)).toBeNull();
    expect(formatearFechaCorta(undefined)).toBeNull();
  });
});

describe("HU14 — precio y contenido del insumo: límites y origen", () => {
  it("el precio acepta coma o punto, de 0 en adelante y hasta 2 decimales", () => {
    for (const ok of ["0", "1250", "1250,5", "1250.55", "0,01", "9999999999.99"]) {
      expect(validarPrecio(ok)).toBeUndefined();
    }
    for (const mal of ["-1", "abc", "1,555", "1.2.3", "12345678901", "1 000"]) {
      expect(validarPrecio(mal)).toBeDefined();
    }
    expect(validarPrecio("")).toBeUndefined();
  });

  it("la cantidad del contenido es mayor que 0 con hasta 3 decimales, y va con su unidad", () => {
    expect(validarContenido("500", "g")).toEqual({});
    expect(validarContenido("1,5", "L")).toEqual({});
    expect(validarContenido("", "")).toEqual({});
    expect(validarContenido("0", "g").contenido_cantidad).toBeDefined();
    expect(validarContenido("0,000", "g").contenido_cantidad).toBeDefined();
    expect(validarContenido("1,2345", "g").contenido_cantidad).toBeDefined();
    expect(validarContenido("-1", "g").contenido_cantidad).toBeDefined();
    expect(validarContenido("500", "").contenido_unidad).toBeDefined();
    expect(validarContenido("", "kg").contenido_cantidad).toBeDefined();
    expect(validarContenido("500", "docena").contenido_unidad).toBeDefined();
  });

  it("canonico normaliza la coma y los ceros para comparar sin convertir a number", () => {
    expect(canonico("1000,50")).toBe("1000.5");
    expect(canonico("1000.00")).toBe("1000");
    expect(canonico("007")).toBe("7");
    expect(canonico("  ")).toBe("");
  });

  it("etiqueta el origen: «Jumbo · 12-11-2026», «Open Food Facts», «Manual · …»", () => {
    expect(etiquetaDeOrigen("jumbo", "2026-11-12T15:00:00Z")).toBe("Jumbo · 12-11-2026");
    expect(etiquetaDeOrigen("open_food_facts")).toBe("Open Food Facts");
    expect(etiquetaDeOrigen("manual", "2026-11-14T10:00:00Z")).toBe("Manual · 14-11-2026");
    expect(etiquetaDeOrigen(null)).toBeNull();
  });

  it("el slug de Jumbo se lee como en el backend: dentro de `jumbo` o en la raíz de la ficha", () => {
    expect(slugDeJumbo({ jumbo: { slug: "leche-1l" } })).toBe("leche-1l");
    expect(slugDeJumbo({ slug: "azucar" })).toBe("azucar");
    expect(slugDeJumbo({ jumbo: { slug: "" } })).toBeNull();
    expect(slugDeJumbo({ off: {} })).toBeNull();
    expect(slugDeJumbo(null)).toBeNull();
  });

  it("?volver= solo acepta la calculadora", () => {
    expect(destinoDeRetorno("/calculadora")).toBe("/calculadora");
    expect(destinoDeRetorno("/calculadora?producto=7")).toBe("/calculadora?producto=7");
    for (const mal of [
      "/productos",
      "//calculadora",
      "https://malo.test/calculadora",
      "/calculadora?producto=7&x=1",
      "/calculadora/otra",
      "/calculadora?producto=abc",
      "javascript:alert(1)",
      "",
      null,
    ]) {
      expect(destinoDeRetorno(mal)).toBeNull();
    }
  });

  it("el enlace de edición desde la calculadora codifica el destino", () => {
    expect(enlaceDeEdicionDesdeCalculadora(12, 3)).toBe(
      "/insumos/12/editar?volver=%2Fcalculadora%3Fproducto%3D3",
    );
  });
});
