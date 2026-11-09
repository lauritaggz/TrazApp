import { describe, expect, it } from "vitest";
import { formatearContenidoNeto, formatearFecha, lineaDeProducto } from "@/lib/fichaPublicaFormato";

describe("formato de la ficha pública (HU10)", () => {
  it("formatea la fecha sin desfase de zona horaria", () => {
    expect(formatearFecha("2026-03-18")).toBe("18 mar 2026");
    expect(formatearFecha("2026-01-01")).toBe("1 ene 2026");
    expect(formatearFecha("2026-12-31")).toBe("31 dic 2026");
  });

  it("devuelve el texto tal cual si la fecha no tiene el formato esperado", () => {
    expect(formatearFecha("18/03/2026")).toBe("18/03/2026");
  });

  it("formatea el contenido neto sin ceros sobrantes", () => {
    expect(formatearContenidoNeto("350.000", "g")).toBe("350 g");
    expect(formatearContenidoNeto("1.500", "kg")).toBe("1,5 kg");
    expect(formatearContenidoNeto("500.000", "ml")).toBe("500 ml");
  });

  it("concuerda la unidad «unidad» con la cantidad", () => {
    expect(formatearContenidoNeto("1.000", "unidad")).toBe("1 unidad");
    expect(formatearContenidoNeto("2.000", "unidad")).toBe("2 unidades");
  });

  it("no inventa un contenido neto cuando falta o no es numérico", () => {
    expect(formatearContenidoNeto(null, "g")).toBeNull();
    expect(formatearContenidoNeto("", "g")).toBeNull();
    expect(formatearContenidoNeto("abc", "g")).toBeNull();
  });

  it("arma la línea de producto con lo que haya", () => {
    expect(lineaDeProducto(["Conservas"], "350 g")).toBe("Conservas · 350 g");
    expect(lineaDeProducto([], "350 g")).toBe("350 g");
    expect(lineaDeProducto(["Conservas"], null)).toBe("Conservas");
    expect(lineaDeProducto([], null)).toBe("");
  });
});
