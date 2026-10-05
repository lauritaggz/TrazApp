/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = "src";

function archivos(dir: string, filtro: (nombre: string) => boolean): string[] {
  return readdirSync(join(SRC, dir))
    .filter((nombre) => filtro(nombre) && statSync(join(SRC, dir, nombre)).isFile())
    .map((nombre) => join(SRC, dir, nombre));
}

function importaciones(ruta: string): string[] {
  const codigo = readFileSync(ruta, "utf8");
  return [...codigo.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
}

describe("Dependencias entre módulos", () => {
  const delDominioIngredientes = [
    ...archivos("components/ingredients", () => true),
    ...archivos("pages", (n) => n.startsWith("Ingredient")),
    ...archivos("hooks", (n) => n.startsWith("useIngredient")),
    ...archivos("lib", (n) => n.startsWith("ingredient") && !n.endsWith(".test.ts")),
    ...archivos("services", (n) => n.startsWith("ingredient")),
    ...archivos("types", (n) => n.startsWith("ingredient")),
  ];

  it("encuentra los archivos de ingredientes que debe revisar", () => {
    expect(delDominioIngredientes.length).toBeGreaterThan(10);
  });

  it("los ingredientes no dependen de ningún módulo de insumos", () => {
    const infractores = delDominioIngredientes.flatMap((ruta) =>
      importaciones(ruta)
        .filter((destino) => /insumo/i.test(destino))
        .map((destino) => `${ruta} -> ${destino}`),
    );

    expect(infractores).toEqual([]);
  });

  it("los textos de alérgenos compartidos viven en un archivo neutro", () => {
    const ingredientes = importaciones(
      join(SRC, "components/ingredients/IngredientAllergensSection.tsx"),
    );
    const insumos = importaciones(join(SRC, "components/insumos/InsumoAllergensSection.tsx"));

    expect(ingredientes).toContain("@/lib/alergenos");
    expect(insumos).toContain("@/lib/alergenos");
  });
});
