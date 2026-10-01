import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { suggestInternalCode } from "@/lib/internalCode";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as ingredientService from "@/services/ingredientService";
import * as productService from "@/services/productService";
import {
  mockCategories,
  mockProductor,
  renderWithProviders,
} from "@/test/testUtils";
import type { Ingrediente } from "@/types/ingredient";
import type { Product } from "@/types/product";

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
  listIngredientAllergens: vi.fn(),
  listAlergenosCatalog: vi.fn(),
}));

const product: Product = {
  id: 1,
  productor_id: 1,
  codigo_interno: "GAL-001",
  nombre: "Galleta de chocolate",
  descripcion: "Con chips",
  contenido_neto: "250",
  unidad_medida: "g",
  presentacion: "Bolsa",
  costo_produccion: "500",
  precio_venta: "1200",
  imagen_url: null,
  categorias: [{ id: 1, nombre: "Pastelería" }],
  activo: true,
  created_at: "2026-08-24T12:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
  vi.mocked(productService.listProducts).mockResolvedValue([product]);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([]);
});

describe("suggestInternalCode", () => {
  it("toma las tres primeras letras sin tildes ni símbolos", () => {
    expect(suggestInternalCode("Galleta de chocolate")).toBe("GAL-001");
    expect(suggestInternalCode("Ñandú 2 kg")).toBe("NAN-001");
    expect(suggestInternalCode("12 Pan")).toBe("PAN-001");
  });

  it("no sugiere nada si el nombre es muy corto o no tiene letras", () => {
    expect(suggestInternalCode("")).toBeNull();
    expect(suggestInternalCode("A")).toBeNull();
    expect(suggestInternalCode("123")).toBeNull();
  });
});

describe("Crear producto: dos columnas con vista previa", () => {
  it("sugiere un código a partir del nombre y lo aplica con un clic", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/productos/nuevo"] });

    await screen.findByRole("heading", { name: "Nuevo producto", level: 1 });
    expect(
      screen.queryByRole("button", { name: /Usar sugerencia/ }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Nombre/), "Galleta de chocolate");
    await user.click(
      screen.getByRole("button", { name: "Usar sugerencia: GAL-001" }),
    );

    expect(screen.getByLabelText(/^Código interno/)).toHaveValue("GAL-001");
    expect(
      screen.queryByRole("button", { name: /Usar sugerencia/ }),
    ).not.toBeInTheDocument();
  });

  it("actualiza la vista previa y el avance de datos obligatorios mientras se escribe", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/productos/nuevo"] });

    await screen.findByRole("heading", { name: "Nuevo producto", level: 1 });
    const aside = screen.getByRole("complementary", {
      name: "Imagen y vista previa",
    });
    expect(within(aside).getByText("0 de 5")).toBeInTheDocument();
    expect(within(aside).getByText("Nombre del producto")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Nombre/), "Pan integral");
    await user.type(screen.getByLabelText(/^Contenido neto/), "500");
    await user.selectOptions(screen.getByLabelText(/^Unidad de medida/), "g");
    await user.type(screen.getByLabelText(/Precio de venta/), "1800");
    await user.click(await screen.findByRole("checkbox", { name: "Dulce" }));

    expect(within(aside).getByText("Pan integral")).toBeInTheDocument();
    expect(within(aside).getByText("500 g")).toBeInTheDocument();
    expect(within(aside).getByText("$1.800")).toBeInTheDocument();
    expect(within(aside).getByText("Dulce")).toBeInTheDocument();
    expect(within(aside).getByText("3 de 5")).toBeInTheDocument();
  });

  it("las categorías siguen siendo casillas accesibles con aspecto de etiqueta", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ["/productos/nuevo"] });

    const dulce = await screen.findByRole("checkbox", { name: "Dulce" });
    expect(dulce).not.toBeChecked();
    await user.click(dulce);
    expect(dulce).toBeChecked();
  });

  it("marca como opcionales las secciones que no bloquean el guardado", async () => {
    renderWithProviders(<App />, { initialEntries: ["/productos/nuevo"] });

    await screen.findByRole("heading", { name: "Nuevo producto", level: 1 });
    const classification = screen.getByRole("heading", {
      name: /Presentación y categorías/,
    });
    expect(within(classification).getByText("Opcional")).toBeInTheDocument();
    const commercial = screen.getByRole("heading", {
      name: /Información comercial/,
    });
    expect(within(commercial).getByText("Opcional")).toBeInTheDocument();
  });
});

describe("Crear ingrediente: próximos pasos", () => {
  it("explica qué se completa después de guardar", async () => {
    renderWithProviders(<App />, { initialEntries: ["/ingredientes/nuevo"] });

    await screen.findByRole("heading", { name: "Nuevo ingrediente", level: 1 });
    const aside = screen.getByRole("complementary", { name: "Después de guardar" });
    expect(within(aside).getByText("Alérgenos")).toBeInTheDocument();
    expect(within(aside).getByText("Composición")).toBeInTheDocument();
  });

  it("no muestra los próximos pasos al editar", async () => {
    const ingredient: Ingrediente = {
      id: 7,
      productor_id: 1,
      codigo_interno: "HAR-001",
      nombre: "Harina",
      descripcion: null,
      tipo: null,
      activo: true,
      created_at: "2026-08-24T12:00:00Z",
    };
    vi.mocked(ingredientService.getIngredient).mockResolvedValue(ingredient);
    renderWithProviders(<App />, { initialEntries: ["/ingredientes/7/editar"] });

    await screen.findByRole("heading", { name: "Editar ingrediente", level: 1 });
    expect(
      screen.queryByRole("complementary", { name: "Después de guardar" }),
    ).not.toBeInTheDocument();
  });

  it("tras crear, el aviso ofrece ir a declarar alérgenos y composición", async () => {
    const user = userEvent.setup();
    vi.mocked(ingredientService.createIngredient).mockResolvedValue({
      id: 9,
      productor_id: 1,
      codigo_interno: "AZU-001",
      nombre: "Azúcar",
      descripcion: null,
      tipo: null,
      activo: true,
      created_at: "2026-08-24T12:00:00Z",
    });
    renderWithProviders(<App />, { initialEntries: ["/ingredientes/nuevo"] });

    await screen.findByRole("heading", { name: "Nuevo ingrediente", level: 1 });
    await user.type(screen.getByLabelText(/^Nombre/), "Azúcar");
    await user.click(
      screen.getByRole("button", { name: "Usar sugerencia: AZU-001" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar ingrediente" }));

    expect(
      await screen.findByText("Ingrediente creado correctamente."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Declarar alérgenos y composición" }),
    ).toHaveAttribute("href", "/ingredientes/9");
  });
});

describe("Listado de productos: vista en cuadrícula", () => {
  it("alterna entre lista y cuadrícula y recuerda la elección", async () => {
    const user = userEvent.setup();
    const first = renderWithProviders(<App />, { initialEntries: ["/productos"] });

    await screen.findAllByRole("link", { name: "Ver producto Galleta de chocolate" });
    expect(screen.getByRole("table")).toBeInTheDocument();
    const listButton = screen.getByRole("button", { name: "Lista" });
    expect(listButton).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Cuadrícula" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver producto Galleta de chocolate" }),
    ).toHaveAttribute("href", "/productos/1");
    expect(screen.getByRole("button", { name: "Cuadrícula" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(window.localStorage.getItem("trazapp_vista_productos")).toBe("cuadricula");

    first.unmount();
    renderWithProviders(<App />, { initialEntries: ["/productos"] });
    await screen.findByRole("link", { name: "Ver producto Galleta de chocolate" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("Estados vacíos", () => {
  it("el de productos explica qué pasa al registrar el primero", async () => {
    vi.mocked(productService.listProducts).mockResolvedValue([]);
    renderWithProviders(<App />, { initialEntries: ["/productos"] });

    expect(
      await screen.findByRole("heading", { name: "Aún no tienes productos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Escribe su nombre, código y contenido."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar primer producto" }),
    ).toBeInTheDocument();
  });

  it("el de ingredientes menciona alérgenos y composición", async () => {
    renderWithProviders(<App />, { initialEntries: ["/ingredientes"] });

    expect(
      await screen.findByRole("heading", { name: "Aún no tienes ingredientes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Declara sus alérgenos desde el detalle."),
    ).toBeInTheDocument();
  });
});
