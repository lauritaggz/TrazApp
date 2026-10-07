/**
 * Consolidation of the allergens declared by several supplies (HU05; reusable by the public
 * sheet of HU10). Pure: it only reads what it receives.
 *
 * Rules:
 * - an allergen appears once, however many supplies declare it;
 * - if any supply declares it as "contiene", it goes only in `contiene`, even when another
 *   supply declares it as "trazas";
 * - each group is ordered like the supply detail: mandatory-labelling allergens first, then
 *   by name.
 */

export interface AlergenoDeclaradoFuente {
  alergeno_id: number;
  codigo: string;
  nombre: string;
  obligatorio_chile: boolean;
  tipo: "contiene" | "trazas";
}

export interface AlergenoConsolidado {
  alergeno_id: number;
  codigo: string;
  nombre: string;
  obligatorio_chile: boolean;
}

export interface AlergenosConsolidados {
  /** Declared as "Contiene" by at least one supply. */
  contiene: AlergenoConsolidado[];
  /** Only ever declared as "Puede contener" (traces). */
  puedeContener: AlergenoConsolidado[];
}

function ordenar(items: AlergenoConsolidado[]): AlergenoConsolidado[] {
  return [...items].sort(
    (a, b) =>
      Number(b.obligatorio_chile) - Number(a.obligatorio_chile) ||
      a.nombre.localeCompare(b.nombre, "es"),
  );
}

export function consolidarAlergenos(
  declarados: Iterable<AlergenoDeclaradoFuente>,
): AlergenosConsolidados {
  const porId = new Map<number, { alergeno: AlergenoConsolidado; contiene: boolean }>();
  for (const declarado of declarados) {
    const actual = porId.get(declarado.alergeno_id);
    const contiene = declarado.tipo === "contiene";
    if (actual) {
      actual.contiene ||= contiene;
      continue;
    }
    porId.set(declarado.alergeno_id, {
      alergeno: {
        alergeno_id: declarado.alergeno_id,
        codigo: declarado.codigo,
        nombre: declarado.nombre,
        obligatorio_chile: declarado.obligatorio_chile,
      },
      contiene,
    });
  }
  const todos = [...porId.values()];
  return {
    contiene: ordenar(todos.filter((item) => item.contiene).map((item) => item.alergeno)),
    puedeContener: ordenar(todos.filter((item) => !item.contiene).map((item) => item.alergeno)),
  };
}
