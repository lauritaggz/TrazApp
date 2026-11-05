/**
 * The elaboraciones list as a page (T06-04 / HU06): what the service asks for and returns, and the
 * «Elaboraciones en curso» section that receives the latest drafts plus the total.
 */
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardElaboracionesEnCurso from "@/components/dashboard/DashboardElaboracionesEnCurso";
import ProductElaboracionesSection from "@/components/products/ProductElaboracionesSection";
import { apiRequest } from "@/lib/apiClient";
import { listElaboraciones } from "@/services/elaboracionService";
import type { ElaboracionResumen } from "@/types/elaboracion";

vi.mock("@/lib/apiClient", () => ({ apiRequest: vi.fn() }));

const PAGINA = { items: [], total: 0, limit: 20, offset: 0 };

function borrador(id: number, codigo: string): ElaboracionResumen {
  return {
    id,
    producto: { id: 5, nombre: "Queque de vainilla" },
    version: { id: 1, numero_version: 1 },
    codigo,
    fecha: "2026-10-05",
    estado: "borrador",
    finalizada_at: null,
    total_ingredientes: 2,
    pendientes: 2,
  };
}

describe("listElaboraciones (servicio)", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    vi.mocked(apiRequest).mockResolvedValue(PAGINA);
  });

  it("sin parámetros pide la ruta sola y devuelve el objeto de la página tal como llega", async () => {
    const pagina = { items: [borrador(1, "E-001")], total: 9, limit: 20, offset: 0 };
    vi.mocked(apiRequest).mockResolvedValue(pagina);

    await expect(listElaboraciones()).resolves.toEqual(pagina);

    expect(apiRequest).toHaveBeenCalledWith("/gestion/elaboraciones", { method: "GET" }, true);
  });

  it("envía cada parámetro con el nombre del backend", async () => {
    await listElaboraciones({
      productoId: 5,
      estado: "finalizada",
      fechaDesde: "2026-10-01",
      fechaHasta: "2026-10-31",
      codigo: "e-01",
      limit: 10,
      offset: 20,
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/gestion/elaboraciones?producto_id=5&estado=finalizada&fecha_desde=2026-10-01&fecha_hasta=2026-10-31&codigo=e-01&limit=10&offset=20",
      { method: "GET" },
      true,
    );
  });

  it("recorta el código y omite los parámetros vacíos", async () => {
    await listElaboraciones({ codigo: "  e-01  ", fechaDesde: "", fechaHasta: "" });
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe("/gestion/elaboraciones?codigo=e-01");

    vi.mocked(apiRequest).mockClear();
    await listElaboraciones({ codigo: "   " });
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe("/gestion/elaboraciones");
  });

  it("un offset de 0 también se envía (no se confunde con «sin offset»)", async () => {
    await listElaboraciones({ limit: 1, offset: 0 });

    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe("/gestion/elaboraciones?limit=1&offset=0");
  });
});

describe("Elaboraciones en curso: total y «Ver todas»", () => {
  function mostrar(props: { total: number; verTodasTo?: string }) {
    render(
      <MemoryRouter>
        <DashboardElaboracionesEnCurso borradores={[borrador(1, "E-001"), borrador(2, "E-002")]} {...props} />
      </MemoryRouter>,
    );
    return screen.getByRole("region", { name: "Elaboraciones en curso" });
  }

  it("la cifra y el aviso salen del total de borradores, no de los que se descargaron", () => {
    const region = mostrar({ total: 9 });

    expect(within(region).getByText("9")).toBeInTheDocument();
    expect(within(region).getByText("Mostrando las 2 más recientes de 9.")).toBeInTheDocument();
  });

  it("con todos a la vista no avisa que hay más", () => {
    const region = mostrar({ total: 2 });

    expect(within(region).queryByText(/Mostrando las/)).not.toBeInTheDocument();
  });

  it("«Ver todas» no se muestra mientras no haya ruta (la página del historial llega con T06-03)", () => {
    const region = mostrar({ total: 9 });

    expect(within(region).queryByRole("link", { name: "Ver todas" })).not.toBeInTheDocument();
  });

  it("con una ruta, «Ver todas» lleva al historial de borradores y mide 44 px", () => {
    const region = mostrar({ total: 9, verTodasTo: "/elaboraciones?estado=borrador" });

    const enlace = within(region).getByRole("link", { name: "Ver todas" });
    expect(enlace).toHaveAttribute("href", "/elaboraciones?estado=borrador");
    expect(enlace).toHaveClass("min-h-11");
  });
});

describe("Elaboraciones del producto: aviso y «Ver todas» (T06-04)", () => {
  async function mostrar(items: ElaboracionResumen[], total: number, verTodasTo?: string) {
    vi.mocked(apiRequest).mockReset();
    vi.mocked(apiRequest).mockResolvedValue({ items, total, limit: 5, offset: 0 });
    render(
      <MemoryRouter>
        <ProductElaboracionesSection
          productoId={5}
          tieneFormulacion
          idSinFormulacion="sin-formulacion"
          verTodasTo={verTodasTo}
        />
      </MemoryRouter>,
    );
    await screen.findAllByRole("link", { name: /E-00/ });
  }

  const CINCO = [1, 2, 3, 4, 5].map((n) => borrador(n, `E-00${n}`));

  it("con más de cinco avisa cuántas hay en total", async () => {
    await mostrar(CINCO, 8);

    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("Mostrando las 5 más recientes de 8.")).toBeInTheDocument();
  });

  it("con cinco o menos no avisa", async () => {
    await mostrar(CINCO, 5);

    expect(screen.queryByText(/Mostrando las/)).not.toBeInTheDocument();
  });

  it("pide al servidor las cinco más recientes del producto", async () => {
    await mostrar(CINCO, 8);

    expect(apiRequest).toHaveBeenCalledWith("/gestion/elaboraciones?producto_id=5&limit=5", { method: "GET" }, true);
  });

  it("«Ver todas» no se muestra mientras no haya ruta (el historial llega con T06-03)", async () => {
    await mostrar(CINCO, 8);

    expect(screen.queryByRole("link", { name: "Ver todas" })).not.toBeInTheDocument();
  });

  it("con una ruta, «Ver todas» lleva al historial filtrado por el producto y mide 44 px", async () => {
    await mostrar(CINCO, 8, "/elaboraciones?producto=5");

    const enlace = screen.getByRole("link", { name: "Ver todas" });
    expect(enlace).toHaveAttribute("href", "/elaboraciones?producto=5");
    expect(enlace).toHaveClass("min-h-11");
  });
});
