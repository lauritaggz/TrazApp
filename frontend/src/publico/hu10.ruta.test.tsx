import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import { fichaDePrueba } from "@/publico/fichaPublicaDatos";
import * as authService from "@/services/authService";
import * as consultaPublica from "@/services/consultaPublicaService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock("@/services/consultaPublicaService", () => ({ obtenerFichaPublica: vi.fn() }));

describe("ruta pública /p/:idPublico (HU10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(consultaPublica.obtenerFichaPublica).mockResolvedValue(fichaDePrueba());
  });

  it("se abre sin sesión y sin pedir cuenta", async () => {
    vi.mocked(authService.getCurrentProductor).mockRejectedValue(new ApiError("No autenticado", 401));
    renderWithProviders(<App />, { initialEntries: ["/p/tok123"] });

    expect(await screen.findByRole("heading", { level: 1, name: "Mermelada de frutilla" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Iniciar sesión" })).not.toBeInTheDocument();
    expect(screen.getByText("Consulta pública · sin registro")).toBeInTheDocument();
  });

  it("con una sesión de productor abierta se ve igual, sin su menú ni redirigir al panel", async () => {
    setAccessToken("token-del-productor");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
    renderWithProviders(<App />, { initialEntries: ["/p/tok123"] });

    expect(await screen.findByRole("heading", { level: 1, name: "Mermelada de frutilla" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByText(/Cerrar sesión|Panel|Hola, Ana/)).not.toBeInTheDocument();
    expect(consultaPublica.obtenerFichaPublica).toHaveBeenCalledWith("tok123", {}, expect.any(AbortSignal));
  });

  it("el resto de la aplicación sigue protegida: sin sesión, /dashboard lleva al acceso", async () => {
    vi.mocked(authService.getCurrentProductor).mockRejectedValue(new ApiError("No autenticado", 401));
    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(await screen.findByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(consultaPublica.obtenerFichaPublica).not.toHaveBeenCalled();
  });
});
