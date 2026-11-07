/** Origin of a retrieved supply (HU07 / T07-06): what is detected as edited and what is sent. */
import { describe, expect, it } from "vitest";
import { camposEditados, origenDeConsulta, origenParaEnviar, type OrigenPropuesta } from "@/lib/origenInsumo";
import { precargaDeProducto } from "@/lib/precargaInsumo";
import type { ConsultaCodigo } from "@/types/consultaCodigo";
import { EMPTY_INSUMO_FORM_VALUES, type InsumoFormValues } from "@/types/insumo";

const INICIAL: InsumoFormValues = {
  ...EMPTY_INSUMO_FORM_VALUES,
  nombre: "Queso Quilque",
  marca_origen: "Quilque",
  presentacion: "500 g",
  ingredientes_declarados: "Leche, sal",
};

const CONSULTA: ConsultaCodigo = {
  codigo_barras: "7802900001193",
  encontrado: true,
  fuente: "combinada",
  fecha_recuperacion: "2026-11-06T15:00:00Z",
  producto: {
    nombre: "Queso Quilque",
    marca_origen: "Quilque",
    presentacion: "500 g",
    ingredientes_declarados: "Leche, sal",
  },
  alergenos: {
    contiene: [{ alergeno_id: 1, codigo: "lacteos", nombre: "Leche", origen: "etiqueta", fuentes: ["open_food_facts", "ingredientes"] }],
    trazas: [{ alergeno_id: 2, codigo: "soja", nombre: "Soya", origen: "etiqueta", fuentes: ["jumbo"] }],
    sin_reconocer: [],
  },
  ficha: { url: "https://off.test/1" },
  fuentes_campos: { nombre: "open_food_facts", ingredientes_declarados: "jumbo", precio: "jumbo", marca_origen: "otra" },
};

describe("camposEditados", () => {
  it("lista solo los campos de la propuesta cuyo valor cambió", () => {
    expect(camposEditados(INICIAL, { ...INICIAL, presentacion: "1 kg" }, false)).toEqual(["presentacion"]);
  });

  it("espacios al borde no cuentan como cambio; vacío contra null tampoco", () => {
    expect(camposEditados(INICIAL, { ...INICIAL, nombre: "  Queso Quilque " }, false)).toEqual([]);
    expect(camposEditados({ ...INICIAL, presentacion: "" }, { ...INICIAL, presentacion: "  " }, false)).toEqual([]);
  });

  it("agrega «alergenos» cuando la selección cambió", () => {
    expect(camposEditados(INICIAL, INICIAL, true)).toEqual(["alergenos"]);
  });

  it("no mira el código de barras ni el ingrediente: no son campos que aporte una fuente", () => {
    expect(camposEditados(INICIAL, { ...INICIAL, codigo_barras: "123", ingrediente_id: "9" }, false)).toEqual([]);
  });
});

describe("origenDeConsulta", () => {
  it("toma solo los campos y fuentes que el backend acepta", () => {
    expect(origenDeConsulta(CONSULTA)?.fuentesCampos).toEqual({ nombre: "open_food_facts", ingredientes_declarados: "jumbo" });
  });

  it("una consulta de una sola fuente (sin fuentes_campos) o de una fuente desconocida no tiene origen", () => {
    expect(origenDeConsulta({ ...CONSULTA, fuentes_campos: undefined })).toBeUndefined();
    expect(origenDeConsulta({ ...CONSULTA, fuente: "otra_fuente" })).toBeUndefined();
  });
});

describe("origenParaEnviar", () => {
  const origen = origenDeConsulta(CONSULTA) as OrigenPropuesta;
  const igual = [
    { alergeno_id: 1, tipo: "contiene" as const },
    { alergeno_id: 2, tipo: "trazas" as const },
  ];

  it("sin cambios: cada alérgeno con su tipo y sus fuentes, la unión en fuentes_alergenos", () => {
    const datos = origenParaEnviar(origen, INICIAL, INICIAL, igual, false);
    expect(datos.campos_editados).toEqual([]);
    expect(datos.fuentes_por_alergeno).toEqual({
      lacteos: { tipo: "contiene", fuentes: ["open_food_facts", "ingredientes"] },
      soja: { tipo: "traza", fuentes: ["jumbo"] },
    });
    expect([...(datos.fuentes_alergenos ?? [])].sort()).toEqual(["ingredientes", "jumbo", "open_food_facts"]);
  });

  it("un alérgeno que el productor agregó es «manual»; el código sale del catálogo", () => {
    const con = [...igual, { alergeno_id: 4, tipo: "contiene" as const }];
    const datos = origenParaEnviar(origen, INICIAL, INICIAL, con, true, { 4: "sesamo" });
    expect(datos.fuentes_por_alergeno?.sesamo).toEqual({ tipo: "contiene", fuentes: ["manual"] });
    expect(datos.campos_editados).toEqual(["alergenos"]);
  });

  it("un alérgeno al que cambió el tipo pasa a «manual» con ese tipo", () => {
    const datos = origenParaEnviar(
      origen,
      INICIAL,
      INICIAL,
      [{ alergeno_id: 1, tipo: "trazas" }, igual[1]],
      true,
    );
    expect(datos.fuentes_por_alergeno?.lacteos).toEqual({ tipo: "traza", fuentes: ["manual"] });
    // The source of the unchanged one is still counted; the changed one no longer is.
    expect(datos.fuentes_alergenos).toEqual(["jumbo"]);
  });

  it("si no se conoce el código de un alérgeno agregado, deja fuera el detalle por alérgeno y envía lo demás", () => {
    const datos = origenParaEnviar(origen, INICIAL, INICIAL, [...igual, { alergeno_id: 4, tipo: "contiene" }], true);
    expect(datos).not.toHaveProperty("fuentes_por_alergeno");
    expect(datos.fuentes_campos).toEqual(origen.fuentesCampos);
    expect(datos.campos_editados).toEqual(["alergenos"]);
  });
});

describe("precargaDeProducto: la fuente del insumo", () => {
  it.each([
    ["open_food_facts", "open_food_facts"],
    ["jumbo", "jumbo"],
    ["combinada", "combinada"],
    ["otra_fuente", "manual"],
  ])("la fuente %s se registra como %s", (fuente, esperada) => {
    expect(precargaDeProducto({ ...CONSULTA, fuente }, "").extra?.fuente).toBe(esperada);
  });

  it("un producto sin código (a granel) no precarga código de barras", () => {
    expect(precargaDeProducto({ ...CONSULTA, codigo_barras: "" }, "").valores.codigo_barras).toBe("");
  });
});
