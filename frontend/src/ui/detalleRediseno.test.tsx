import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ComingSoonCard from "@/components/detail/ComingSoonCard";
import DetailHero from "@/components/detail/DetailHero";
import FactTile from "@/components/detail/FactTile";

describe("Páginas de detalle: componentes del rediseño", () => {
  it("DetailHero muestra el tipo, el título como h1, el estado y las acciones; el icono es decorativo", () => {
    render(
      <DetailHero
        kind="Insumo"
        icon={<svg data-testid="icono" />}
        title="Leche entera"
        badges={<span>Activo</span>}
        subtitle="Soprole"
        actions={<button type="button">Editar insumo</button>}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Leche entera" })).toBeInTheDocument();
    expect(screen.getByText("Insumo")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar insumo" })).toBeInTheDocument();
    expect(screen.getByTestId("icono").closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("ComingSoonCard dice «Próximamente», no tiene nada que pulsar y sus filas de muestra no se leen", () => {
    const { container } = render(
      <ComingSoonCard id="soon" title="Uso en formulaciones" description="Verás los productos." icon={<svg />} />,
    );

    const region = screen.getByRole("region", { name: "Uso en formulaciones" });
    expect(region).toHaveAttribute("data-proximamente");
    expect(screen.getByText("Próximamente")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container.querySelector("[aria-hidden='true'] .rounded-xl")).not.toBeNull();
  });

  it("FactTile es un par término/valor dentro de una lista de descripción", () => {
    const { container } = render(
      <dl>
        <FactTile label="Código interno">GAL-001</FactTile>
      </dl>,
    );

    expect(container.querySelector("dt")).toHaveTextContent("Código interno");
    expect(container.querySelector("dd")).toHaveTextContent("GAL-001");
  });
});

describe("Páginas de detalle: maquetas y simplicidad (código fuente)", () => {
  it("producto, insumo e ingrediente usan el mismo encabezado y marcan lo futuro como «Próximamente»", async () => {
    const { readFileSync } = await import("node:fs");
    const leer = (r: string) => readFileSync(`src/pages/${r}`, "utf-8");
    for (const pagina of ["ProductDetail.tsx", "InsumoDetail.tsx", "IngredientDetail.tsx"]) {
      expect(leer(pagina), pagina).toContain("<DetailHero");
      expect(leer(pagina), pagina).toMatch(/ComingSoonCard|próximamente/);
    }
    expect(leer("ProductDetail.tsx")).toContain("Ver QR (próximamente)");
  });
});
