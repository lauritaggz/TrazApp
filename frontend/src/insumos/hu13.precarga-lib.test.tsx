/**
 * The pure pieces of the prefill (T13-05 / HU13): what the lookup's answer turns into, and the
 * presentation-only prop of the allergen selector.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AlergenosSelector from "@/components/insumos/AlergenosSelector";
import {
  alergenosDeConsulta,
  precargaDeProducto,
  precargaSoloCodigo,
  sugerenciasDeConsulta,
} from "@/lib/precargaInsumo";
import * as ingredientService from "@/services/ingredientService";
import type { ConsultaCodigo } from "@/types/consultaCodigo";
import type { AlergenoCatalogo } from "@/types/ingredient";
import { EMPTY_INSUMO_FORM_VALUES, type AlergenosValue } from "@/types/insumo";

vi.mock("@/services/ingredientService", () => ({
  listAlergenosCatalog: vi.fn(),
}));

const CATALOGO: AlergenoCatalogo[] = [
  { id: 1, codigo: "lacteos", nombre: "Leche", obligatorio_chile: true },
  { id: 2, codigo: "cacahuetes", nombre: "Maní", obligatorio_chile: true },
];

const CONSULTA: ConsultaCodigo = {
  codigo_barras: "7802910000971",
  encontrado: true,
  fuente: "open_food_facts",
  fecha_recuperacion: "2026-10-19T15:00:00Z",
  producto: { nombre: "Leche", marca_origen: "Colun", presentacion: null, ingredientes_declarados: null },
  alergenos: {
    contiene: [{ alergeno_id: 1, codigo: "lacteos", nombre: "Leche", origen: "texto" }],
    trazas: [{ alergeno_id: 2, codigo: "cacahuetes", nombre: "Maní", origen: "etiqueta" }],
    sin_reconocer: ["harina"],
  },
  ficha: { product_name: "Leche" },
};

describe("Precarga a partir de la respuesta de la consulta", () => {
  it("los alérgenos sugeridos son el valor del selector: primero lo que contiene, después las trazas", () => {
    expect(alergenosDeConsulta(CONSULTA)).toEqual({
      items: [
        { alergeno_id: 1, tipo: "contiene" },
        { alergeno_id: 2, tipo: "trazas" },
      ],
      sinAlergenos: false,
    });
  });

  it("sin sugerencias el valor queda vacío y sin confirmar «no contiene» (el productor decide)", () => {
    const vacia = { ...CONSULTA, alergenos: { contiene: [], trazas: [], sin_reconocer: [] } };

    expect(alergenosDeConsulta(vacia)).toEqual({ items: [], sinAlergenos: false });
    expect(sugerenciasDeConsulta(vacia)).toBeUndefined();
  });

  it("las sugerencias de presentación llevan el origen por alérgeno y lo que quedó sin reconocer", () => {
    expect(sugerenciasDeConsulta(CONSULTA)).toEqual({
      origenes: { 1: "texto", 2: "etiqueta" },
      sinReconocer: ["harina"],
    });
  });

  it("un producto encontrado carga sus datos, conserva el ingrediente y guarda de dónde vino", () => {
    const precarga = precargaDeProducto(CONSULTA, "7");

    expect(precarga.valores).toEqual({
      ingrediente_id: "7",
      nombre: "Leche",
      marca_origen: "Colun",
      presentacion: "",
      ingredientes_declarados: "",
      codigo_barras: "7802910000971",
    });
    expect(precarga.extra).toEqual({
      fuente: "open_food_facts",
      fecha_recuperacion: "2026-10-19T15:00:00Z",
      ficha: { product_name: "Leche" },
    });
  });

  it("una fuente desconocida se registra como manual", () => {
    expect(precargaDeProducto({ ...CONSULTA, fuente: "otra_fuente" }, "").extra?.fuente).toBe("manual");
  });

  it("no encontrado o sin fuente: conserva lo escrito, agrega el código y no lleva fuente, fecha ni ficha", () => {
    const alergenos: AlergenosValue = { items: [{ alergeno_id: 2, tipo: "trazas" }], sinAlergenos: false };
    const precarga = precargaSoloCodigo("7802910000971", {
      values: { ...EMPTY_INSUMO_FORM_VALUES, nombre: "Escrito", ingrediente_id: "3" },
      alergenos,
    });

    expect(precarga.valores).toMatchObject({ nombre: "Escrito", ingrediente_id: "3", codigo_barras: "7802910000971" });
    expect(precarga.alergenos).toBe(alergenos);
    expect(precarga.extra).toBeUndefined();
    expect(precarga.sugerencias).toBeUndefined();
  });
});

describe("AlergenosSelector: el origen es solo presentación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue(CATALOGO);
  });

  function Controlado({ onValue }: { onValue: (v: AlergenosValue) => void }) {
    const [value, setValue] = useState<AlergenosValue>(alergenosDeConsulta(CONSULTA));
    return (
      <AlergenosSelector
        value={value}
        origenes={{ 1: "texto", 2: "etiqueta" }}
        onChange={(next) => {
          setValue(next);
          onValue(next);
        }}
      />
    );
  }

  it("muestra el origen junto a cada alérgeno declarado", async () => {
    render(<Controlado onValue={vi.fn()} />);

    const contiene = await screen.findByRole("region", { name: "Contiene" });
    expect(within(contiene).getByText("(según el texto de ingredientes)")).toBeInTheDocument();
    const trazas = screen.getByRole("region", { name: "Puede contener" });
    expect(within(trazas).getByText("(según la etiqueta de la fuente)")).toBeInTheDocument();
  });

  it("no cambia el valor ni la validación: cambiar el tipo y quitar siguen entregando el mismo formato", async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlado onValue={onValue} />);

    await user.click(await screen.findByRole("button", { name: "Cambiar Maní a Contiene" }));
    expect(onValue).toHaveBeenLastCalledWith({
      items: [
        { alergeno_id: 1, tipo: "contiene" },
        { alergeno_id: 2, tipo: "contiene" },
      ],
      sinAlergenos: false,
    });
    await user.click(screen.getByRole("button", { name: "Quitar alérgeno Leche" }));
    expect(onValue).toHaveBeenLastCalledWith({ items: [{ alergeno_id: 2, tipo: "contiene" }], sinAlergenos: false });
    // Without the prop nothing is shown and nothing else changes.
  });

  it("sin la propiedad no muestra ningún origen", async () => {
    render(<AlergenosSelector value={alergenosDeConsulta(CONSULTA)} onChange={vi.fn()} />);

    await screen.findByRole("region", { name: "Contiene" });
    expect(screen.queryByText(/^\(según/)).not.toBeInTheDocument();
  });
});
