import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fichaDePrueba } from "@/publico/fichaPublicaDatos";
import { renderFicha } from "@/publico/renderFicha";
import * as consultaPublica from "@/services/consultaPublicaService";
import type { FichaPublica } from "@/types/consultaPublica";

vi.mock("@/services/consultaPublicaService", () => ({ obtenerFichaPublica: vi.fn() }));

const obtener = vi.mocked(consultaPublica.obtenerFichaPublica);

function conElaboracion(codigo: string, fecha: string): FichaPublica {
  const base = fichaDePrueba();
  return { ...base, elaboracion: { ...base.elaboracion!, codigo, fecha } };
}

/** Answers according to the requested selection, like the API would. */
function responderSegunSeleccion() {
  obtener.mockImplementation(async (_id, seleccion = {}) => {
    if (seleccion.codigo === "MFRU-037") return conElaboracion("MFRU-037", "2026-03-06");
    return fichaDePrueba();
  });
}

const busquedaEnUrl = () => screen.getByLabelText("búsqueda en la URL");

describe("selección de la elaboración (HU10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista las elaboraciones visibles como «código · fecha» y marca la que se muestra", async () => {
    responderSegunSeleccion();
    renderFicha();

    const lista = await screen.findByRole("combobox", { name: "¿Qué elaboración tienes?" });
    expect(Array.from((lista as HTMLSelectElement).options).map((o) => o.textContent)).toEqual([
      "MFRU-042 · 18 mar 2026",
      "MFRU-037 · 6 mar 2026",
    ]);
    expect(lista).toHaveValue("MFRU-042");
    expect(obtener).toHaveBeenCalledWith("tok123", {}, expect.any(AbortSignal));
  });

  it("elegir en la lista pide esa elaboración y la refleja en la URL", async () => {
    const user = userEvent.setup();
    responderSegunSeleccion();
    renderFicha();

    await user.selectOptions(await screen.findByRole("combobox", { name: "¿Qué elaboración tienes?" }), "MFRU-037");

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Elaboración consultada" })).toHaveTextContent("MFRU-037"),
    );
    expect(obtener).toHaveBeenLastCalledWith("tok123", { codigo: "MFRU-037" }, expect.any(AbortSignal));
    expect(busquedaEnUrl()).toHaveTextContent("?codigo=MFRU-037");
  });

  it("el botón Atrás vuelve a la elaboración anterior", async () => {
    const user = userEvent.setup();
    responderSegunSeleccion();
    renderFicha();
    await user.selectOptions(await screen.findByRole("combobox", { name: "¿Qué elaboración tienes?" }), "MFRU-037");
    await waitFor(() => expect(busquedaEnUrl()).toHaveTextContent("?codigo=MFRU-037"));

    await user.click(screen.getByRole("button", { name: "Atrás del navegador" }));

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Elaboración consultada" })).toHaveTextContent("MFRU-042"),
    );
    expect(busquedaEnUrl()).toBeEmptyDOMElement();
  });

  it("un enlace compartido con ?codigo= abre esa elaboración y rellena la búsqueda", async () => {
    responderSegunSeleccion();
    renderFicha("/p/tok123?codigo=MFRU-037");

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Elaboración consultada" })).toHaveTextContent("MFRU-037"),
    );
    expect(obtener).toHaveBeenCalledWith("tok123", { codigo: "MFRU-037" }, expect.any(AbortSignal));
    expect(screen.getByLabelText("Código de la elaboración")).toHaveValue("MFRU-037");
  });

  it("buscar por código envía el texto sin espacios en los extremos y lo refleja en la URL", async () => {
    const user = userEvent.setup();
    responderSegunSeleccion();
    renderFicha();
    await screen.findByRole("combobox", { name: "¿Qué elaboración tienes?" });

    await user.type(screen.getByLabelText("Código de la elaboración"), "  mfru-037 ");
    await user.click(screen.getByRole("button", { name: "Buscar por código" }));

    await waitFor(() =>
      expect(obtener).toHaveBeenLastCalledWith("tok123", { codigo: "mfru-037" }, expect.any(AbortSignal)),
    );
    expect(busquedaEnUrl()).toHaveTextContent("?codigo=mfru-037");
  });

  it("buscar por fecha usa la etiqueta «Fecha de elaboración» y envía AAAA-MM-DD", async () => {
    const user = userEvent.setup();
    responderSegunSeleccion();
    renderFicha();
    await screen.findByRole("combobox", { name: "¿Qué elaboración tienes?" });

    expect(screen.getByLabelText("Fecha de elaboración")).toHaveAttribute("type", "date");
    expect(screen.getByRole("button", { name: "Buscar por fecha" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Fecha de elaboración"), { target: { value: "2026-03-06" } });
    await user.click(screen.getByRole("button", { name: "Buscar por fecha" }));

    await waitFor(() =>
      expect(obtener).toHaveBeenLastCalledWith("tok123", { fecha: "2026-03-06" }, expect.any(AbortSignal)),
    );
    expect(busquedaEnUrl()).toHaveTextContent("?fecha=2026-03-06");
  });

  it("no permite buscar un código vacío", async () => {
    responderSegunSeleccion();
    renderFicha();
    await screen.findByRole("combobox", { name: "¿Qué elaboración tienes?" });

    expect(screen.getByRole("button", { name: "Buscar por código" })).toBeDisabled();
  });

  it("mientras carga otra selección no deja visible la elaboración anterior", async () => {
    const user = userEvent.setup();
    let resolver: (ficha: FichaPublica) => void = () => {};
    obtener.mockResolvedValueOnce(fichaDePrueba());
    obtener.mockReturnValueOnce(new Promise<FichaPublica>((r) => (resolver = r)));
    renderFicha();
    await user.selectOptions(await screen.findByRole("combobox", { name: "¿Qué elaboración tienes?" }), "MFRU-037");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Cargando la elaboración"));
    expect(screen.queryByRole("region", { name: "Elaboración consultada" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Mermelada de frutilla" })).toBeInTheDocument();

    resolver(conElaboracion("MFRU-037", "2026-03-06"));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Elaboración consultada" })).toHaveTextContent("MFRU-037"),
    );
  });
});
