import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fichaDePrueba } from "@/publico/fichaPublicaDatos";
import { renderFicha } from "@/publico/renderFicha";
import * as consultaPublica from "@/services/consultaPublicaService";
import type { ElaboracionPublica, FichaPublica } from "@/types/consultaPublica";

vi.mock("@/services/consultaPublicaService", () => ({ obtenerFichaPublica: vi.fn() }));

const obtener = vi.mocked(consultaPublica.obtenerFichaPublica);

function conElaboracion(cambios: Partial<ElaboracionPublica>): FichaPublica {
  const base = fichaDePrueba();
  return { ...base, elaboracion: { ...base.elaboracion!, ...cambios } };
}

async function mostrar(ficha: FichaPublica) {
  obtener.mockResolvedValue(ficha);
  const resultado = renderFicha();
  await screen.findByRole("heading", { level: 1, name: ficha.producto.nombre });
  return resultado;
}

const grupo = (nombre: "Contiene" | "Puede contener") => screen.getByRole("group", { name: nombre });

describe("ficha pública: alérgenos, insumos y versión (HU10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PT10-06: muestra «Contiene» y «Puede contener» con sus alérgenos", async () => {
    await mostrar(
      conElaboracion({
        alergenos: {
          contiene: [{ codigo: "leche", nombre: "Leche" }],
          puede_contener: [{ codigo: "soya", nombre: "Soya" }],
        },
      }),
    );

    expect(within(grupo("Contiene")).getByText("Leche")).toBeInTheDocument();
    expect(within(grupo("Contiene")).queryByText("Soya")).not.toBeInTheDocument();
    expect(within(grupo("Puede contener")).getByText("Soya")).toBeInTheDocument();
    expect(within(grupo("Puede contener")).queryByText("Leche")).not.toBeInTheDocument();
  });

  it("los alérgenos van antes del detalle de los insumos", async () => {
    await mostrar(fichaDePrueba());

    const alergenos = screen.getByRole("heading", { name: "Información de alérgenos" });
    const insumos = screen.getByRole("heading", { name: "Insumos utilizados" });
    expect(alergenos.compareDocumentPosition(insumos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("una lista vacía dice qué no se declaró, nunca «No contiene alérgenos» ni «Libre de»", async () => {
    await mostrar(conElaboracion({ alergenos: { contiene: [], puede_contener: [] }, insumos: [] }));

    expect(within(grupo("Contiene")).getByText("No se declararon alérgenos")).toBeInTheDocument();
    expect(within(grupo("Puede contener")).getByText("No se declararon trazas")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/No contiene alérgenos|Libre de/i);
  });

  it("con solo trazas, «Contiene» dice que no se declararon alérgenos y las trazas se listan", async () => {
    await mostrar(
      conElaboracion({
        alergenos: { contiene: [], puede_contener: [{ codigo: "soya", nombre: "Soya" }] },
      }),
    );

    expect(within(grupo("Contiene")).getByText("No se declararon alérgenos")).toBeInTheDocument();
    expect(within(grupo("Puede contener")).getByText("Soya")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/No contiene alérgenos|Libre de/i);
  });

  it("CA4: cada insumo muestra ingrediente, nombre, «Marca u origen», ingredientes declarados y advertencias", async () => {
    await mostrar(fichaDePrueba());

    const insumos = screen.getByRole("region", { name: "Insumos utilizados" });
    expect(within(insumos).getByText("Pectina")).toBeInTheDocument();
    expect(within(insumos).getByText("Pectina cítrica")).toBeInTheDocument();
    expect(within(insumos).getByText(/Marca u origen:/).closest("p")).toHaveTextContent("Marca u origen: Sosa Ingredients");
    expect(within(insumos).getByText(/Ingredientes declarados:/).closest("p")).toHaveTextContent(
      "Ingredientes declarados: Pectina cítrica y dextrosa",
    );
    expect(within(insumos).getByText("Puede contener leche")).toBeInTheDocument();
  });

  it("«Marca u origen» es una sola etiqueta: no hay «Marca:» ni «Origen:» sueltas", async () => {
    await mostrar(fichaDePrueba());

    expect(screen.getAllByText(/Marca u origen:/)).toHaveLength(1);
    expect(document.body).not.toHaveTextContent(/(^|\s)Marca:|(^|\s)Origen:/);
  });

  it("omite ingredientes declarados y advertencias cuando el insumo no los trae", async () => {
    const base = fichaDePrueba().elaboracion!;
    await mostrar(
      conElaboracion({
        insumos: [{ ...base.insumos[0], ingredientes_declarados: null, advertencias: null, alergenos: [] }],
      }),
    );

    expect(screen.queryByText(/Ingredientes declarados:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Advertencias/)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /Alérgenos de/ })).not.toBeInTheDocument();
  });

  it("los alérgenos de cada insumo van como etiquetas con texto «Contiene» o «Puede contener»", async () => {
    const base = fichaDePrueba().elaboracion!;
    await mostrar(
      conElaboracion({
        insumos: [
          {
            ...base.insumos[0],
            alergenos: [
              { codigo: "leche", nombre: "Leche", tipo: "contiene" },
              { codigo: "soya", nombre: "Soya", tipo: "puede_contener" },
            ],
          },
        ],
      }),
    );

    const etiquetas = within(screen.getByRole("list", { name: "Alérgenos de Pectina cítrica" })).getAllByRole("listitem");
    expect(etiquetas.map((e) => e.textContent)).toEqual(["Contiene: Leche", "Puede contener: Soya"]);
  });

  it("CA6: la nota de versión anterior aparece sin número de versión", async () => {
    await mostrar(conElaboracion({ version_anterior: true }));

    const nota = screen.getByRole("complementary", { name: "Receta anterior" });
    expect(nota).toHaveTextContent("Esta elaboración se hizo con una receta anterior a la actual");
    expect(nota.textContent).not.toMatch(/\d|versión/i);
  });

  it("sin versión anterior no hay nota", async () => {
    await mostrar(conElaboracion({ version_anterior: false }));

    expect(screen.queryByRole("complementary", { name: "Receta anterior" })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/receta anterior/i);
  });

  it("CA8: no muestra lotes, vencimientos ni «Consumir preferentemente»", async () => {
    await mostrar(fichaDePrueba());

    expect(document.body).not.toHaveTextContent(/lote|vencimiento|vence|preferentemente/i);
  });

  it("con una respuesta que contradice su estado (no_disponible con datos), no muestra la elaboración", async () => {
    const ficha = fichaDePrueba();
    await mostrar({ ...ficha, estado_elaboracion: "no_disponible" });

    expect(screen.getByRole("heading", { name: "No encontramos información disponible para esa elaboración" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Elaboración consultada" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Información de alérgenos" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pectina cítrica")).not.toBeInTheDocument();
  });

  it("CA9: el aviso está al final de la ficha, visible y fuera de cualquier bloque plegable", async () => {
    await mostrar(fichaDePrueba());

    const aviso = screen.getByRole("complementary", { name: "Aviso al consumidor" });
    expect(aviso).toBeVisible();
    expect(aviso.closest("details")).toBeNull();
    expect(aviso).toHaveTextContent("no reemplaza el rotulado obligatorio");
    expect(aviso).toHaveTextContent("seguro para una persona determinada");
    const insumos = screen.getByRole("heading", { name: "Insumos utilizados" });
    expect(insumos.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("HT07: ningún texto baja de 12 px y los controles de la búsqueda miden al menos 44 px", async () => {
    const { container } = await mostrar(fichaDePrueba());

    expect(container.innerHTML).not.toMatch(/text-\[(\d|1[01])(\.\d+)?px\]/);
    for (const control of [
      ...screen.getAllByRole("button", { name: /^Buscar/ }),
      ...screen.getAllByRole("combobox"),
      ...screen.getAllByRole("textbox"),
      screen.getByLabelText("Fecha de elaboración"),
    ]) {
      expect(control.className).toMatch(/min-h-11/);
    }
  });
});
