import { describe, expect, it } from "vitest";
import {
  FILTROS_VACIOS,
  aParams,
  hayFiltros,
  leerFiltros,
  parametrosDeLaPagina,
  rangoDePagina,
  rangoInvalido,
  ultimaPagina,
} from "@/lib/historialElaboraciones";

describe("Filtros del historial de elaboraciones", () => {
  it("lee los seis parámetros de la URL", () => {
    const filtros = leerFiltros(new URLSearchParams("producto=5&estado=borrador&desde=2026-10-01&hasta=2026-10-31&codigo=%20e-01%20&pagina=3"));

    expect(filtros).toEqual({ producto: 5, estado: "borrador", desde: "2026-10-01", hasta: "2026-10-31", codigo: "e-01", pagina: 3 });
  });

  it.each([
    ["producto=0", { producto: null }],
    ["producto=abc", { producto: null }],
    ["estado=otra", { estado: null }],
    ["desde=2026-02-30", { desde: null }],
    ["hasta=10-10-2026", { hasta: null }],
    ["pagina=0", { pagina: 1 }],
    ["pagina=1.5", { pagina: 1 }],
    ["pagina=x", { pagina: 1 }],
  ])("ignora %s", (consulta, esperado) => {
    expect(leerFiltros(new URLSearchParams(consulta))).toMatchObject(esperado);
  });

  it("escribe solo lo que está puesto, y la página solo desde la segunda", () => {
    expect(aParams(FILTROS_VACIOS).toString()).toBe("");
    expect(aParams({ ...FILTROS_VACIOS, estado: "finalizada", codigo: " e-1 ", pagina: 1 }).toString()).toBe("estado=finalizada&codigo=e-1");
    expect(aParams({ ...FILTROS_VACIOS, pagina: 2 }).toString()).toBe("pagina=2");
  });

  it("ida y vuelta: lo que se escribe se lee igual", () => {
    const filtros = { producto: 7, estado: "borrador" as const, desde: "2026-10-01", hasta: "2026-10-09", codigo: "e-0", pagina: 4 };

    expect(leerFiltros(aParams(filtros))).toEqual(filtros);
  });

  it("hayFiltros ignora la página", () => {
    expect(hayFiltros({ ...FILTROS_VACIOS, pagina: 5 })).toBe(false);
    expect(hayFiltros({ ...FILTROS_VACIOS, codigo: "  " })).toBe(false);
    expect(hayFiltros({ ...FILTROS_VACIOS, estado: "borrador" })).toBe(true);
  });

  it("detecta un rango de fechas al revés, y no el igual", () => {
    expect(rangoInvalido({ ...FILTROS_VACIOS, desde: "2026-10-05", hasta: "2026-10-01" })).toBe(true);
    expect(rangoInvalido({ ...FILTROS_VACIOS, desde: "2026-10-05", hasta: "2026-10-05" })).toBe(false);
    expect(rangoInvalido({ ...FILTROS_VACIOS, desde: "2026-10-05" })).toBe(false);
  });

  it("la página 1 empieza en el offset 0 y cada página suma 20", () => {
    expect(parametrosDeLaPagina({ ...FILTROS_VACIOS })).toEqual({ limit: 20, offset: 0 });
    expect(parametrosDeLaPagina({ ...FILTROS_VACIOS, pagina: 2 })).toEqual({ limit: 20, offset: 20 });
    expect(parametrosDeLaPagina({ ...FILTROS_VACIOS, pagina: 4, producto: 5, codigo: "e" })).toEqual({
      limit: 20,
      offset: 60,
      productoId: 5,
      codigo: "e",
    });
  });

  it("calcula la última página y el rango «x–y de z»", () => {
    expect(ultimaPagina(0)).toBe(1);
    expect(ultimaPagina(20)).toBe(1);
    expect(ultimaPagina(21)).toBe(2);
    expect(rangoDePagina(1, 20, 45)).toBe("1–20 de 45");
    expect(rangoDePagina(3, 5, 45)).toBe("41–45 de 45");
    expect(rangoDePagina(1, 0, 0)).toBe("0 de 0");
  });
});
