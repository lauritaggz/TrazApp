/// <reference types="node" />
/**
 * HT07, Bloque 4: vocabulario, etiquetas legibles y áreas táctiles de 44 px.
 *
 * Las palabras prohibidas se arman con piezas para que este archivo no se detecte a sí mismo.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import RegisterSuccess from "@/components/auth/RegisterSuccess";
import { PasswordInput } from "@/components/ui/Input";
import ListToolbar from "@/components/ui/ListToolbar";
import PageHeader from "@/components/ui/PageHeader";
import { FIELD_BASE } from "@/components/ui/fieldStyles";

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

const fuente = archivos("src").filter((r) => /\.tsx?$/.test(r) && !r.includes(".test."));
const leer = (ruta: string) => readFileSync(ruta, "utf-8");

describe("Etiquetas y textos en el código fuente (HT07, Bloque 4)", () => {
  it("encuentra los archivos que debe revisar", () => {
    expect(fuente.length).toBeGreaterThan(100);
  });

  it("ninguna etiqueta usa mayúsculas forzadas ni texto menor de 12 px", () => {
    const prohibido = [/\buppercase\b/, new RegExp("text-\\[(?:9|10|11)px\\]")];
    const infractores = fuente.filter((r) => prohibido.some((p) => p.test(leer(r))));
    expect(infractores).toEqual([]);
  });

  it("el vocabulario antiguo no sobrevive en los textos", () => {
    const viejos = [
      "correcta" + "mente.",
      "Registrar " + "primer",
      "Guardar " + "producto",
      "Guardar " + "ingrediente",
      "Inténtalo " + "nuevamente",
      "Registrar " + "otra elaboración",
      "Nombre del negocio o " + "emprendimiento",
    ];
    const infractores = fuente.flatMap((r) => viejos.filter((v) => leer(r).includes(v)).map((v) => `${r}: ${v}`));
    expect(infractores).toEqual([]);
  });
});

describe("Áreas táctiles de 44 px (HT07, Bloque 4)", () => {
  it("los campos de texto, selectores y áreas de texto parten de min-h-11", () => {
    expect(FIELD_BASE).toContain("min-h-11");
  });

  it("el botón de mostrar la contraseña mide 44 px", () => {
    render(<PasswordInput label="Contraseña" />);

    expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toHaveClass("h-11", "w-11");
  });

  it("las migas miden 44 px: el enlace y la página actual", () => {
    render(
      <MemoryRouter>
        <PageHeader title="Detalle" breadcrumbs={[{ label: "Insumos", to: "/insumos" }, { label: "Leche" }]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Insumos" })).toHaveClass("min-h-11");
    expect(screen.getByText("Leche", { selector: "[aria-current]" })).toHaveClass("min-h-11");
  });

  it("los enlaces de nombre y de detalle miden 44 px en las listas y los detalles", () => {
    const esperados = [
      "pages/Insumos.tsx",
      "pages/Ingredients.tsx",
      "pages/Products.tsx",
      "components/products/ProductsGrid.tsx",
      "pages/InsumoDetail.tsx",
      "pages/ElaboracionDetail.tsx",
      "components/insumos/OrigenInformacion.tsx",
    ];
    for (const ruta of esperados) {
      expect(leer(join("src", ruta)), ruta).toContain("inline-flex min-h-11 items-center");
    }
  });

  it("la barra de filtros con tres controles los pone en una sola fila en escritorio", () => {
    const controles = (
      <>
        <span>a</span>
        <span>b</span>
        <span>c</span>
      </>
    );
    const props = {
      search: "",
      onSearchChange: () => {},
      searchLabel: "Buscar",
      searchPlaceholder: "Buscar",
      controls: controles,
      chips: [],
      onClearAll: () => {},
    };
    const { container, rerender } = render(<ListToolbar {...props} controlsColumns={3} />);
    expect(container.querySelector(".sm\\:grid-cols-2")).toHaveClass("lg:grid-cols-3");

    rerender(<ListToolbar {...props} />);
    expect(container.querySelector(".sm\\:grid-cols-2")).not.toHaveClass("lg:grid-cols-3");
  });

  it("Insumos (tres filtros) pide tres columnas; Productos e Ingredientes no", () => {
    expect(leer("src/pages/Insumos.tsx")).toContain("controlsColumns={3}");
    expect(leer("src/pages/Products.tsx")).not.toContain("controlsColumns");
    expect(leer("src/pages/Ingredients.tsx")).not.toContain("controlsColumns");
  });
});

describe("Detalles y registro de cuenta (HT07, Bloque 4)", () => {
  it("los detalles de insumo e ingrediente no repiten «Volver a …»: quedan las migas", () => {
    expect(leer("src/pages/InsumoDetail.tsx")).not.toContain("Volver a insumos");
    expect(leer("src/pages/IngredientDetail.tsx")).not.toContain("Volver a ingredientes");
  });

  it("la bienvenida usa «Te damos la bienvenida a TrazApp, {nombre}»", () => {
    render(
      <MemoryRouter>
        <RegisterSuccess name="Ana" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Te damos la bienvenida a TrazApp,/)).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });
});
