/**
 * DetailNeighborsNav y useDetailNeighbors (HT08): genéricos, sin nada de productos, para reutilizarlos en
 * los detalles de elaboración e insumo (T-HT08-04B). El recorrido completo se prueba en
 * products/ht08.navegacion-producto.test.tsx.
 */
import { renderHook, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import DetailNeighborsNav from "@/components/detail/DetailNeighborsNav";
import { useDetailNeighbors } from "@/hooks/useDetailNeighbors";
import type { Vecinos } from "@/types/vecinos";

const VECINOS: Vecinos = { anterior: { id: 4, nombre: "Leche Soprole" }, siguiente: null };

function montar(props: Partial<Parameters<typeof DetailNeighborsNav>[0]> = {}) {
  return render(
    <MemoryRouter>
      <DetailNeighborsNav
        vecinos={VECINOS}
        cargando={false}
        rutaBase="/insumos"
        etiqueta="Navegación entre insumos"
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("DetailNeighborsNav", () => {
  it("usa la ruta base y la etiqueta que recibe", () => {
    montar();

    const nav = screen.getByRole("navigation", { name: "Navegación entre insumos" });
    const anterior = within(nav).getByRole("link", { name: "Anterior: Leche Soprole" });
    expect(anterior).toHaveAttribute("href", "/insumos/4");
    expect(anterior).not.toHaveAttribute("aria-disabled");
    const extremo = within(nav).getByText("Siguiente").closest("[aria-disabled='true']");
    expect(extremo?.tagName).toBe("SPAN");
  });

  it("mientras carga, el enlace sigue ahí pero aria-disabled y con el nombre corto", () => {
    montar({ cargando: true });

    const anterior = screen.getByRole("link", { name: "Anterior" });
    expect(anterior).toHaveAttribute("aria-disabled", "true");
    expect(anterior).toHaveAttribute("href", "/insumos/4");
  });

  it("sin vecinos (antes de la primera respuesta o con error) no dibuja nada", () => {
    montar({ vecinos: null });
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("no tiene nada específico de productos", async () => {
    const { readFileSync } = await import("node:fs");
    for (const archivo of ["src/components/detail/DetailNeighborsNav.tsx", "src/hooks/useDetailNeighbors.ts"]) {
      const codigo = readFileSync(archivo, "utf-8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(codigo, archivo).not.toMatch(/product|producto/i);
    }
  });
});

describe("useDetailNeighbors", () => {
  it("pide con la función del recurso, marca cargando y conserva los vecinos anteriores hasta la nueva respuesta", async () => {
    let resolver: (v: Vecinos) => void = () => {};
    const cargar = vi.fn((id: number) =>
      id === 1 ? Promise.resolve(VECINOS) : new Promise<Vecinos>((resolve) => (resolver = resolve)),
    );
    const { result, rerender } = renderHook(({ id }) => useDetailNeighbors(id, cargar), {
      initialProps: { id: 1 as number | null },
    });
    expect(result.current).toEqual({ vecinos: null, cargando: true });
    await waitFor(() => expect(result.current).toEqual({ vecinos: VECINOS, cargando: false }));

    rerender({ id: 2 });
    expect(result.current).toEqual({ vecinos: VECINOS, cargando: true });
    const nuevos: Vecinos = { anterior: null, siguiente: { id: 9, nombre: "Otro" } };
    resolver(nuevos);
    await waitFor(() => expect(result.current).toEqual({ vecinos: nuevos, cargando: false }));
    expect(cargar).toHaveBeenCalledWith(2);
  });

  it("con id null no pide nada; si la consulta falla, vecinos es null", async () => {
    const cargar = vi.fn().mockRejectedValue(new Error("falla"));
    const { result, rerender } = renderHook(({ id }) => useDetailNeighbors(id, cargar), {
      initialProps: { id: null as number | null },
    });
    expect(cargar).not.toHaveBeenCalled();

    rerender({ id: 3 });
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.vecinos).toBeNull();
  });
});
