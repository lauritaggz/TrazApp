import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fichaDePrueba } from "@/publico/fichaPublicaDatos";
import { renderFicha } from "@/publico/renderFicha";
import * as consultaPublica from "@/services/consultaPublicaService";
import { ApiError } from "@/types/auth";

vi.mock("@/services/consultaPublicaService", () => ({ obtenerFichaPublica: vi.fn() }));

const obtener = vi.mocked(consultaPublica.obtenerFichaPublica);
const MENSAJE_UNIFICADO = "No encontramos información disponible para esa elaboración";

describe("estados de la ficha pública (HU10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el producto y su elaboración por defecto", async () => {
    obtener.mockResolvedValue(fichaDePrueba());
    renderFicha();

    expect(await screen.findByRole("heading", { level: 1, name: "Mermelada de frutilla" })).toBeInTheDocument();
    expect(screen.getByText("Conservas · 350 g")).toBeInTheDocument();
    expect(screen.getByText("Conservas Valle de Curicó")).toBeInTheDocument();
    const cabecera = screen.getByRole("region", { name: "Elaboración consultada" });
    expect(cabecera).toHaveTextContent("MFRU-042");
    expect(cabecera).toHaveTextContent("18 mar 2026");
    expect(cabecera).toHaveTextContent("Fecha de elaboración");
    expect(document.body).not.toHaveTextContent(/vencimiento|preferentemente|lote/i);
  });

  it("omite «Elaborado por» cuando la respuesta no lo trae", async () => {
    const ficha = fichaDePrueba();
    obtener.mockResolvedValue({ ...ficha, producto: { ...ficha.producto, elaborado_por: null } });
    renderFicha();

    await screen.findByRole("heading", { level: 1, name: "Mermelada de frutilla" });
    expect(screen.queryByText("Elaborado por")).not.toBeInTheDocument();
  });

  it("usa la imagen del producto si existe y la quita si falla al cargar", async () => {
    const ficha = fichaDePrueba();
    obtener.mockResolvedValue({ ...ficha, producto: { ...ficha.producto, imagen_url: "/uploads/products/frasco.png" } });
    renderFicha();

    const imagen = await screen.findByAltText("Mermelada de frutilla");
    expect(imagen).toHaveAttribute("src", "http://localhost:8000/uploads/products/frasco.png");
    imagen.dispatchEvent(new Event("error"));
    await waitFor(() => expect(screen.queryByAltText("Mermelada de frutilla")).not.toBeInTheDocument());
  });

  it("producto no disponible (404): «Información no disponible» sin ningún dato del producto ni selector", async () => {
    obtener.mockRejectedValue(new ApiError("No se pudo completar la operación.", 404));
    renderFicha();

    expect(await screen.findByRole("heading", { level: 1, name: "Información no disponible" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/Mermelada/)).not.toBeInTheDocument();
    expect(document.title).toBe("Información no disponible · TrazApp");
  });

  it("elaboración no disponible: mensaje unificado, sin datos de ninguna elaboración y con el selector", async () => {
    obtener.mockResolvedValue(fichaDePrueba({ elaboracion: null, estado_elaboracion: "no_disponible" }));
    renderFicha("/p/tok123?codigo=OCULTA-1");

    expect(await screen.findByRole("heading", { name: MENSAJE_UNIFICADO })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Elaboración consultada" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "¿Qué elaboración tienes?" })).toBeInTheDocument();
    expect(screen.queryByText(/fue ocultada|está oculta/i)).not.toBeInTheDocument();
  });

  it("varias elaboraciones de la fecha: ofrece las coincidencias como enlaces y no elige ninguna", async () => {
    obtener.mockResolvedValue(
      fichaDePrueba({
        elaboracion: null,
        estado_elaboracion: "varias",
        coincidencias: [
          { codigo: "MFRU-044", fecha: "2026-03-18" },
          { codigo: "MFRU-042", fecha: "2026-03-18" },
        ],
      }),
    );
    renderFicha("/p/tok123?fecha=2026-03-18");

    expect(await screen.findByRole("heading", { name: "Hay más de una elaboración de esa fecha" })).toBeInTheDocument();
    const enlaces = screen.getAllByRole("link");
    expect(enlaces.map((e) => e.textContent)).toEqual(["MFRU-044 · 18 mar 2026", "MFRU-042 · 18 mar 2026"]);
    expect(enlaces[0]).toHaveAttribute("href", "/p/tok123?codigo=MFRU-044");
    expect(screen.queryByRole("region", { name: "Elaboración consultada" })).not.toBeInTheDocument();
  });

  it("producto sin elaboraciones visibles: solo su identidad y el estado, sin selector", async () => {
    obtener.mockResolvedValue(fichaDePrueba({ elaboraciones: [], elaboracion: null, estado_elaboracion: "sin_elaboraciones" }));
    renderFicha();

    expect(await screen.findByRole("heading", { name: "Todavía no hay elaboraciones disponibles" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Mermelada de frutilla" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ingredientes declarados/i)).not.toBeInTheDocument();
  });

  it("error de servidor o de red: no muestra datos parciales, pide revisar el envase y permite reintentar", async () => {
    const user = userEvent.setup();
    obtener.mockRejectedValueOnce(new ApiError("No se pudo completar la operación.", 500));
    obtener.mockResolvedValueOnce(fichaDePrueba());
    renderFicha();

    expect(await screen.findByRole("heading", { name: "No pudimos mostrar la información" })).toBeInTheDocument();
    expect(document.body).toHaveTextContent("rotulado del envase");
    expect(document.body).not.toHaveTextContent(/Contiene|Puede contener|Mermelada/);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Mermelada de frutilla" })).toBeInTheDocument();
    expect(obtener).toHaveBeenCalledTimes(2);
  });

  it("sin conexión (estado 0) se trata como error con «Reintentar»", async () => {
    obtener.mockRejectedValue(new ApiError("No se pudo conectar con el servidor.", 0));
    renderFicha();

    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("búsqueda no válida en el enlace (422): muestra el mensaje y un enlace a la más reciente", async () => {
    obtener.mockRejectedValue(new ApiError("La fecha debe tener el formato AAAA-MM-DD.", 422, {}, { mensaje: "x" }));
    renderFicha("/p/tok123?fecha=hoy");

    expect(await screen.findByText("La fecha debe tener el formato AAAA-MM-DD.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver la elaboración más reciente" })).toHaveAttribute("href", "/p/tok123");
  });

  it("mientras carga muestra un estado de carga accesible", () => {
    obtener.mockReturnValue(new Promise(() => {}));
    renderFicha();

    expect(screen.getByRole("status")).toHaveTextContent("Cargando la ficha");
  });

  it("el aviso al consumidor está visible en la ficha, en cada estado con datos del producto", async () => {
    const estados = [
      fichaDePrueba(),
      fichaDePrueba({ elaboracion: null, estado_elaboracion: "no_disponible" }),
      fichaDePrueba({ elaboracion: null, estado_elaboracion: "varias", coincidencias: [{ codigo: "A", fecha: "2026-03-18" }] }),
      fichaDePrueba({ elaboraciones: [], elaboracion: null, estado_elaboracion: "sin_elaboraciones" }),
    ];
    for (const ficha of estados) {
      obtener.mockResolvedValueOnce(ficha);
      const { unmount } = renderFicha();
      const aviso = await screen.findByRole("complementary", { name: "Aviso al consumidor" });
      expect(aviso).toBeVisible();
      expect(aviso).toHaveTextContent("no reemplaza el rotulado obligatorio");
      expect(aviso).toHaveTextContent("seguro para una persona determinada");
      unmount();
    }
  });

  it("pide a los buscadores no indexar la página mientras está montada", async () => {
    obtener.mockResolvedValue(fichaDePrueba());
    const { unmount } = renderFicha();

    await screen.findByRole("heading", { level: 1, name: "Mermelada de frutilla" });
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});
