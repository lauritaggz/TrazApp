import { describe, expect, it } from "vitest";
import { consolidarAlergenos, type AlergenoDeclaradoFuente } from "@/lib/alergenosResumen";
import { textoInformacionConservada } from "@/lib/elaboracionUtils";

function a(
  id: number,
  nombre: string,
  tipo: "contiene" | "trazas",
  obligatorio = true,
): AlergenoDeclaradoFuente {
  return { alergeno_id: id, codigo: nombre.toLowerCase(), nombre, obligatorio_chile: obligatorio, tipo };
}

const nombres = (items: { nombre: string }[]) => items.map((item) => item.nombre);

describe("consolidarAlergenos", () => {
  it("sin alérgenos devuelve dos grupos vacíos", () => {
    expect(consolidarAlergenos([])).toEqual({ contiene: [], puedeContener: [] });
  });

  it("separa lo que contiene de lo que puede contener", () => {
    const resultado = consolidarAlergenos([a(1, "Leche", "contiene"), a(2, "Soya", "trazas")]);

    expect(nombres(resultado.contiene)).toEqual(["Leche"]);
    expect(nombres(resultado.puedeContener)).toEqual(["Soya"]);
  });

  it("no duplica un alérgeno que declaran varios insumos con el mismo tipo", () => {
    const resultado = consolidarAlergenos([
      a(1, "Leche", "contiene"),
      a(1, "Leche", "contiene"),
      a(2, "Soya", "trazas"),
      a(2, "Soya", "trazas"),
    ]);

    expect(nombres(resultado.contiene)).toEqual(["Leche"]);
    expect(nombres(resultado.puedeContener)).toEqual(["Soya"]);
  });

  it("«contiene» en un insumo y «trazas» en otro va solo en «Contiene», en cualquier orden", () => {
    const contieneAntes = consolidarAlergenos([a(3, "Soya", "contiene"), a(3, "Soya", "trazas")]);
    const trazasAntes = consolidarAlergenos([a(3, "Soya", "trazas"), a(3, "Soya", "contiene")]);

    for (const resultado of [contieneAntes, trazasAntes]) {
      expect(nombres(resultado.contiene)).toEqual(["Soya"]);
      expect(resultado.puedeContener).toEqual([]);
    }
  });

  it("conserva los datos del alérgeno y no arrastra el tipo", () => {
    const [soya] = consolidarAlergenos([a(3, "Soya", "trazas")]).puedeContener;

    expect(soya).toEqual({ alergeno_id: 3, codigo: "soya", nombre: "Soya", obligatorio_chile: true });
  });

  it("ordena cada grupo con los de rotulación obligatoria primero y luego por nombre", () => {
    const resultado = consolidarAlergenos([
      a(10, "Sésamo", "contiene", false),
      a(11, "Apio", "contiene", false),
      a(12, "Soya", "contiene", true),
      a(13, "Gluten", "contiene", true),
    ]);

    expect(nombres(resultado.contiene)).toEqual(["Gluten", "Soya", "Apio", "Sésamo"]);
  });

  it("ordena los nombres con tildes según el español", () => {
    const resultado = consolidarAlergenos([a(1, "Zanahoria", "trazas"), a(2, "Ñame", "trazas"), a(3, "Álamo", "trazas")]);

    expect(nombres(resultado.puedeContener)).toEqual(["Álamo", "Ñame", "Zanahoria"]);
  });

  it("acepta cualquier iterable y no modifica lo que recibe", () => {
    const entrada = [a(1, "Leche", "contiene"), a(1, "Leche", "trazas")];
    const copia = JSON.parse(JSON.stringify(entrada));

    const desdeConjunto = consolidarAlergenos(new Set(entrada));
    consolidarAlergenos(entrada);

    expect(nombres(desdeConjunto.contiene)).toEqual(["Leche"]);
    expect(entrada).toEqual(copia);
  });

  it("reúne los alérgenos de varios insumos ya aplanados", () => {
    const insumoA = [a(1, "Gluten", "contiene"), a(3, "Soya", "trazas")];
    const insumoB = [a(2, "Leche", "contiene"), a(3, "Soya", "contiene")];

    const resultado = consolidarAlergenos([...insumoA, ...insumoB]);

    expect(nombres(resultado.contiene)).toEqual(["Gluten", "Leche", "Soya"]);
    expect(resultado.puedeContener).toEqual([]);
  });
});

describe("textoInformacionConservada", () => {
  it("usa el formato chileno y la zona de Santiago (invierno, UTC-4)", () => {
    expect(textoInformacionConservada("2026-07-15T14:05:00Z")).toBe(
      "Información conservada al finalizar el 15-07-2026 a las 10:05",
    );
  });

  it("usa la hora de verano de Chile (UTC-3) y cambia de día cuando corresponde", () => {
    expect(textoInformacionConservada("2026-10-06T18:30:00Z")).toBe(
      "Información conservada al finalizar el 06-10-2026 a las 15:30",
    );
    // 02:30 UTC del 7 sigue siendo la noche del 6 en Santiago.
    expect(textoInformacionConservada("2026-10-07T02:30:00Z")).toBe(
      "Información conservada al finalizar el 06-10-2026 a las 23:30",
    );
  });

  it("muestra la medianoche como 00:00 y no como 24:00", () => {
    expect(textoInformacionConservada("2026-10-06T03:00:00Z")).toBe(
      "Información conservada al finalizar el 06-10-2026 a las 00:00",
    );
  });

  it("sin fecha o con una fecha inválida no devuelve texto", () => {
    expect(textoInformacionConservada(null)).toBeNull();
    expect(textoInformacionConservada(undefined)).toBeNull();
    expect(textoInformacionConservada("no es una fecha")).toBeNull();
  });
});
