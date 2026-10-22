import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { ApiError } from "@/types/auth";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as ingredientService from "@/services/ingredientService";
import * as productService from "@/services/productService";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("@/services/productService", () => ({
  listProducts: vi.fn(),
  listCategories: vi.fn(),
  createProduct: vi.fn(),
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  uploadProductImage: vi.fn(),
  deleteProduct: vi.fn(),
}));

vi.mock("@/services/ingredientService", () => ({
  listIngredients: vi.fn(),
  getIngredient: vi.fn(),
  createIngredient: vi.fn(),
  updateIngredient: vi.fn(),
  deleteIngredient: vi.fn(),
  listIngredientComposition: vi.fn(),
  addCompositionComponent: vi.fn(),
  updateCompositionComponent: vi.fn(),
  deleteCompositionComponent: vi.fn(),
  listIngredientAllergens: vi.fn(),
  addIngredientAllergen: vi.fn(),
  deleteIngredientAllergen: vi.fn(),
  listAlergenosCatalog: vi.fn(),
}));

async function fillRegisterForm(
  user: ReturnType<typeof userEvent.setup>,
  options?: { password?: string; skipBusiness?: boolean },
) {
  await user.type(screen.getByLabelText("Nombre completo"), "Ana Perez");
  if (!options?.skipBusiness) {
    await user.type(
      screen.getByLabelText("Nombre del negocio"),
      "Panaderia La Espiga",
    );
  }
  await user.type(
    screen.getByLabelText("Correo electrónico"),
    "ana@ejemplo.com",
  );
  await user.type(
    screen.getByLabelText("Contraseña"),
    options?.password ?? "SecretoProductor123!",
  );
}

describe("Login HU12", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.getCurrentProductor).mockRejectedValue(
      new ApiError("No autenticado", 401),
    );
    vi.mocked(productService.listProducts).mockResolvedValue([]);
    vi.mocked(productService.listCategories).mockResolvedValue([]);
    vi.mocked(ingredientService.listIngredients).mockResolvedValue([]);
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
      await screen.findByRole("heading", { name: /Hola, Ana/ }),
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
      screen.getByText(
        "El nombre del negocio es obligatorio.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("El correo electrónico es obligatorio."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("La contraseña es obligatoria."),
    ).toBeInTheDocument();
    expect(authService.register).not.toHaveBeenCalled();
  });

  it("incluye el campo nombre del negocio en el registro", async () => {
    renderWithProviders(<App />, { initialEntries: ["/register"] });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Crear cuenta" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText("Nombre del negocio"),
    ).toBeInTheDocument();
  });

  it("valida contraseña mínima de 8 caracteres", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/register"] });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Crear cuenta" }),
      ).toBeInTheDocument();
    });

    await fillRegisterForm(user, { password: "corta" });
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

    await fillRegisterForm(user);
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

    await fillRegisterForm(user);
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
    vi.mocked(productService.listProducts).mockResolvedValue([]);
    vi.mocked(productService.listCategories).mockResolvedValue([]);
    vi.mocked(ingredientService.listIngredients).mockResolvedValue([]);
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
      screen.queryByRole("heading", { name: /Hola/ }),
    ).not.toBeInTheDocument();
  });

  it("usuario autenticado puede visualizar el Dashboard", async () => {
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(
      await screen.findByRole("heading", { name: /Hola, Ana/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Menú de usuario: Ana Perez" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Panaderia La Espiga").length).toBeGreaterThan(0);
    expect(
      await screen.findByText("Aún no tienes productos."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Crear tu primer producto" })
        .length,
    ).toBeGreaterThan(0);
  });

  it("muestra error explícito si falla la carga de productos en el Dashboard", async () => {
    const user = userEvent.setup();
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
    vi.mocked(productService.listProducts)
      .mockRejectedValueOnce(new ApiError("fallo", 500))
      .mockResolvedValueOnce([]);

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    const productsError = await screen.findByText(
      "No pudimos cargar tus productos.",
    );
    expect(productsError).toBeInTheDocument();
    expect(
      screen.queryByText("Aún no tienes productos."),
    ).not.toBeInTheDocument();

    const productsAlert = productsError.closest("[role='alert']");
    expect(productsAlert).not.toBeNull();
    await user.click(
      within(productsAlert as HTMLElement).getByRole("button", {
        name: "Reintentar",
      }),
    );

    expect(
      await screen.findByText("Aún no tienes productos."),
    ).toBeInTheDocument();
  });

  it("cerrar sesión elimina el token y vuelve a Login", async () => {
    const user = userEvent.setup();
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);

    renderWithProviders(<App />, { initialEntries: ["/dashboard"] });

    expect(
      await screen.findByRole("heading", { name: /Hola, Ana/ }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Menú de usuario/ }),
    );
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await user.click(
      screen.getByRole("button", { name: "Sí, cerrar sesión" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("trazapp_access_token")).toBeNull();
  });
});

describe("Perfil HU12", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usuario sin autenticación no puede acceder a Mi perfil", async () => {
    vi.mocked(authService.getCurrentProductor).mockRejectedValue(
      new ApiError("No autenticado", 401),
    );

    renderWithProviders(<App />, { initialEntries: ["/perfil"] });

    expect(
      await screen.findByRole("heading", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Mi perfil" }),
    ).not.toBeInTheDocument();
  });

  it("perfil muestra datos del productor y correo no editable", async () => {
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);

    renderWithProviders(<App />, { initialEntries: ["/perfil"] });

    expect(
      await screen.findByRole("heading", { name: "Mi perfil" }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana Perez");
    expect(screen.getByLabelText("Nombre del negocio")).toHaveValue(
      "Panaderia La Espiga",
    );
    const emailInput = screen.getByLabelText("Correo electrónico");
    expect(emailInput).toHaveValue("ana@ejemplo.com");
    expect(emailInput).toBeDisabled();
  });

  it("permite modificar nombre y nombre del negocio y guardar", async () => {
    const user = userEvent.setup();
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
    vi.mocked(authService.updateProfile).mockResolvedValue({
      ...mockProductor,
      nombre: "Ana Maria Perez",
      nombre_negocio: "Espiga Artesanal",
    });

    renderWithProviders(<App />, { initialEntries: ["/perfil"] });

    expect(
      await screen.findByRole("heading", { name: "Mi perfil" }),
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText("Nombre");
    const businessInput = screen.getByLabelText("Nombre del negocio");
    await user.clear(nameInput);
    await user.type(nameInput, "Ana Maria Perez");
    await user.clear(businessInput);
    await user.type(businessInput, "Espiga Artesanal");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Cambios guardados.",
    );
    expect(authService.updateProfile).toHaveBeenCalledWith({
      nombre: "Ana Maria Perez",
      nombre_negocio: "Espiga Artesanal",
    });
    expect(screen.getByText("Ana Maria Perez")).toBeInTheDocument();
    expect(screen.getByText("Espiga Artesanal")).toBeInTheDocument();
  });

  it("lo que el usuario escribe en el instante en que se monta el perfil no se pisa después", async () => {
    // Regression of an intermittent failure. The page re-copied the productor into the form on
    // mount, although the form already started with those values. That copy runs as a pending effect
    // right after the first paint, so an edit made in that very instant was undone by it (under load
    // the test typed "Ana Perez" + "Ana Maria Perez"). The edit is fired from a MutationObserver:
    // right when the field enters the DOM, before the pending effects run.
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
    let editado = false;
    const observer = new MutationObserver(() => {
      const campo = screen.queryByLabelText("Nombre");
      if (campo && !editado) {
        editado = true;
        fireEvent.change(campo, { target: { value: "Ana Maria" } });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    renderWithProviders(<App />, { initialEntries: ["/perfil"] });
    await waitFor(() => expect(editado).toBe(true));
    observer.disconnect();
    // Let every pending effect of the mount run before looking at the field.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana Maria");
  });

  it("muestra error de API al guardar el perfil", async () => {
    const user = userEvent.setup();
    setAccessToken("valid-token");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
    vi.mocked(authService.updateProfile).mockRejectedValue(
      new ApiError("No se pudo completar la operación. Intenta de nuevo más tarde.", 500),
    );

    renderWithProviders(<App />, { initialEntries: ["/perfil"] });

    expect(
      await screen.findByRole("heading", { name: "Mi perfil" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo completar la operación. Intenta de nuevo más tarde.",
    );
  });
});
