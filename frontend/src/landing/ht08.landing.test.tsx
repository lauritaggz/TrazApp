import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("Landing (HT08)", () => {
  it("la raíz muestra la landing, no redirige al inicio de sesión", async () => {
    renderWithProviders(<App />, { initialEntries: ["/"] });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Cada frasco sabe de dónde viene" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Iniciar sesión" })).not.toBeInTheDocument();
  });

  it("sin sesión ofrece ingresar y crear cuenta", async () => {
    renderWithProviders(<App />, { initialEntries: ["/"] });

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/login");
    for (const enlace of screen.getAllByRole("link", { name: "Crear cuenta" })) {
      expect(enlace).toHaveAttribute("href", "/register");
    }
    expect(screen.getByRole("link", { name: "Ya tengo cuenta" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: /Ir a mi panel/ })).not.toBeInTheDocument();
  });

  it("con sesión iniciada lleva al panel en vez de pedir cuenta", async () => {
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
    renderWithProviders(<App />, { initialEntries: ["/"] });

    const enlaces = await screen.findAllByRole("link", { name: /Ir a mi panel/ });
    expect(enlaces.length).toBeGreaterThan(0);
    for (const enlace of enlaces) expect(enlace).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: "Ingresar" })).not.toBeInTheDocument();
  });

  it("los enlaces del menú llevan a secciones que existen, cada una con su título", async () => {
    renderWithProviders(<App />, { initialEntries: ["/"] });

    const nav = await screen.findByRole("navigation", { name: "Secciones de la página" });
    for (const enlace of within(nav).getAllByRole("link")) {
      const id = enlace.getAttribute("href")!.slice(1);
      const seccion = document.getElementById(id);
      expect(seccion, id).not.toBeNull();
      expect(within(seccion!).getByRole("heading", { level: 2 })).toBeInTheDocument();
    }
  });

  it("las maquetas no se leen en voz alta: van ocultas para lectores de pantalla", async () => {
    renderWithProviders(<App />, { initialEntries: ["/"] });

    await screen.findByRole("heading", { level: 1 });
    // El ejemplo del panel y la ficha del teléfono solo existen dentro de las maquetas.
    for (const texto of ["Requiere tu atención", "Pesto de albahaca"]) {
      for (const nodo of screen.getAllByText(texto)) {
        expect(nodo.closest('[aria-hidden="true"]'), texto).not.toBeNull();
      }
    }
  });

  it("desde Crear cuenta se puede volver a la landing", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/register"] });

    await user.click(await screen.findByRole("link", { name: "Volver" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Cada frasco sabe de dónde viene" }),
    ).toBeInTheDocument();
  });
});
