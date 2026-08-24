import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { ApiError } from "@/types/auth";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import * as authService from "@/services/authService";
import { setAccessToken } from "@/lib/tokenStorage";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
}));

describe("Login HU12", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.getCurrentProductor).mockRejectedValue(
      new ApiError("No autenticado", 401),
    );
  });

  it("valida campos obligatorios", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/login"] });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Iniciar sesión" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(
      screen.getByText("El correo electrónico es obligatorio."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("La contraseña es obligatoria."),
    ).toBeInTheDocument();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it("muestra error ante credenciales inválidas", async () => {
    const user = userEvent.setup();
    vi.mocked(authService.login).mockRejectedValue(
      new ApiError("Credenciales inválidas", 401),
    );

    renderWithProviders(<App />, { initialEntries: ["/login"] });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Iniciar sesión" }),
      ).toBeInTheDocument();
    });

    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "ana@ejemplo.com",
    );
    await user.type(screen.getByLabelText("Contraseña"), "clave-incorrecta");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Credenciales inválidas",
    );
    expect(
      screen.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
  });

  it("login satisfactorio lleva al área privada", async () => {
    const user = userEvent.setup();
    vi.mocked(authService.login).mockResolvedValue({
      access_token: "test-token",
      token_type: "bearer",
      productor: mockProductor,
    });

    renderWithProviders(<App />, { initialEntries: ["/login"] });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Iniciar sesión" }),
      ).toBeInTheDocument();
    });

    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "ana@ejemplo.com",
    );
    await user.type(screen.getByLabelText("Contraseña"), "SecretoProductor123!");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(
      await screen.findByRole("heading", { name: "Bienvenida, Ana" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("trazapp_access_token")).toBe("test-token");
  });
});

describe("Registro HU12", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.getCurrentProductor).mockRejectedValue(
      new ApiError("No autenticado", 401),
    );
  });

  it("valida campos obligatorios", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/register"] });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Crear cuenta" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(screen.getByText("El nombre es obligatorio.")).toBeInTheDocument();
    expect(
      screen.getByText("El correo electrónico es obligatorio."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("La contraseña es obligatoria."),
    ).toBeInTheDocument();
    expect(authService.register).not.toHaveBeenCalled();
  });

  it("valida contraseña mínima de 8 caracteres", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/register"] });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Crear cuenta" }),
      ).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Nombre completo"), "Ana Perez");
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "ana@ejemplo.com",
    );
    await user.type(screen.getByLabelText("Contraseña"), "corta");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      screen.getByText("La contraseña debe tener al menos 8 caracteres."),
    ).toBeInTheDocument();
    expect(authService.register).not.toHaveBeenCalled();
  });

  it("muestra error de correo duplicado", async () => {
    const user = userEvent.setup();
    vi.mocked(authService.register).mockRejectedValue(
      new ApiError("El correo ya está registrado", 409),
    );

    renderWithProviders(<App />, { initialEntries: ["/register"] });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Crear cuenta" }),
      ).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Nombre completo"), "Ana Perez");
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "ana@ejemplo.com",
    );
    await user.type(screen.getByLabelText("Contraseña"), "SecretoProductor123!");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El correo ya está registrado",
    );
  });

  it("registro satisfactorio muestra la confirmación", async () => {
    const user = userEvent.setup();
    vi.mocked(authService.register).mockResolvedValue(mockProductor);

    renderWithProviders(<App />, { initialEntries: ["/register"] });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Crear cuenta" }),
      ).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Nombre completo"), "Ana Perez");
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "ana@ejemplo.com",
    );
    await user.type(screen.getByLabelText("Contraseña"), "SecretoProductor123!");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      await screen.findByRole("heading", {
        name: "Cuenta creada exitosamente",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana Perez")).toBeInTheDocument();
    expect(
      screen.getByText(/Ya puedes iniciar sesión con tu correo/i),
    ).toBeInTheDocument();
  });
});

describe("Protección y logout HU12", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usuario sin sesión no puede acceder al Dashboard", async () => {
    vi.mocked(authService.getCurrentProductor).mockRejectedValue(
      new ApiError("No autenticado", 401),
    );

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(
      await screen.findByRole("heading", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Bienvenida/ }),
    ).not.toBeInTheDocument();
  });

  it("usuario autenticado puede visualizar el Dashboard", async () => {
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(
      await screen.findByRole("heading", { name: "Bienvenida, Ana" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Productor")).toBeInTheDocument();
  });

  it("cerrar sesión elimina el token y vuelve a Login", async () => {
    const user = userEvent.setup();
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(
      await screen.findByRole("heading", { name: "Bienvenida, Ana" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(
      await screen.findByRole("heading", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("trazapp_access_token")).toBeNull();
  });
});
