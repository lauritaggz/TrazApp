import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as elaboracionService from "@/services/elaboracionService";
import * as productService from "@/services/productService";
import {
  EMPTY_PRODUCT_COMMERCIAL_FIELDS,
  mockCategories,
  mockProductor,
  paginaElaboraciones,
  renderWithProviders,
} from "@/test/testUtils";
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

vi.mock("@/services/formulationService", () => ({
  getProductFormulation: vi.fn().mockResolvedValue({ existe: true, version: null }),
  saveProductFormulation: vi.fn(),
  listProductVersions: vi.fn().mockResolvedValue([]),
  getVersionFormulation: vi.fn(),
}));

vi.mock("@/services/elaboracionService", () => ({
  listElaboraciones: vi.fn(),
  getCodigoSugerido: vi.fn(),
  createElaboracion: vi.fn(),
  getElaboracion: vi.fn(),
}));

function producto(extra: Partial<Product> = {}): Product {
  return {
    id: 7,
    productor_id: 1,
    codigo_interno: "COD-007",
    nombre: "Mermelada de frutilla",
    descripcion: "Mermelada casera de frutilla.",
    contenido_neto: "250.000",
    unidad_medida: "g",
    presentacion: null,
    ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
    categorias: [mockCategories[0]],
    costo_produccion: "800.00",
    precio_venta: "1500.00",
    activo: true,
    created_at: "2026-08-23T12:00:00Z",
    tiene_formulacion: true,
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listCategories).mockResolvedValue(mockCategories);
  vi.mocked(elaboracionService.listElaboraciones).mockResolvedValue(paginaElaboraciones([]));
});

async function abrirDetalle(p: Product) {
  vi.mocked(productService.getProduct).mockResolvedValue(p);
  renderWithProviders(<App />, { initialEntries: ["/productos/7"] });
  await screen.findByRole("heading", { name: "Mermelada de frutilla", level: 1 });
}

describe("HU14 (PT14-13) — costo de producción calculado en el detalle del producto", () => {
  it("con costo_calculado lo muestra por unidad, con la etiqueta «Calculado» en texto y un enlace a la calculadora", async () => {
    await abrirDetalle(producto({ costo_calculado: "62.5625" }));

    const tarjeta = screen.getByRole("region", { name: "Costo de producción" });
    expect(within(tarjeta).getByText("$63")).toBeInTheDocument();
    expect(within(tarjeta).getByText("por unidad")).toBeInTheDocument();
    expect(within(tarjeta).getByText("Calculado")).toBeInTheDocument();
    expect(within(tarjeta).getByRole("link", { name: "Abrir calculadora" })).toHaveAttribute(
      "href",
      "/calculadora?producto=7",
    );
  });

  it("el valor manual no se oculta ni se pierde: aparece como referencia y en información comercial", async () => {
    await abrirDetalle(producto({ costo_calculado: "62.5625" }));

    const tarjeta = screen.getByRole("region", { name: "Costo de producción" });
    expect(within(tarjeta).getByText("Valor manual: $800 por unidad")).toBeInTheDocument();
    // El manual no se muestra como valor principal de la tarjeta calculada.
    expect(within(tarjeta).queryByText("$800")).not.toBeInTheDocument();
    const comercial = screen.getByRole("region", { name: "Información comercial" });
    expect(within(comercial).getByText("Costo de producción manual")).toBeInTheDocument();
    expect(within(comercial).getByText("$800")).toBeInTheDocument();
  });

  it("con costo_calculado y sin valor manual lo dice", async () => {
    await abrirDetalle(producto({ costo_calculado: "62.5625", costo_produccion: null }));

    const tarjeta = screen.getByRole("region", { name: "Costo de producción" });
    expect(within(tarjeta).getByText("$63")).toBeInTheDocument();
    expect(within(tarjeta).getByText("Sin valor manual")).toBeInTheDocument();
  });

  it("con costo_calculado null muestra el costo manual como hasta ahora, sin la etiqueta", async () => {
    await abrirDetalle(producto({ costo_calculado: null }));

    expect(screen.queryByRole("region", { name: "Costo de producción" })).not.toBeInTheDocument();
    expect(screen.queryByText("Calculado")).not.toBeInTheDocument();
    const comercial = screen.getByRole("region", { name: "Información comercial" });
    expect(within(comercial).getByText("Costo de producción")).toBeInTheDocument();
    expect(within(comercial).getByText("$800")).toBeInTheDocument();
  });

  it("con costo_calculado null y sin manual muestra el estado vacío de siempre", async () => {
    await abrirDetalle(producto({ costo_calculado: null, costo_produccion: null }));

    const comercial = screen.getByRole("region", { name: "Información comercial" });
    expect(within(comercial).getByText("Costo de producción")).toBeInTheDocument();
    expect(within(comercial).getByText("No informado")).toBeInTheDocument();
    expect(screen.queryByText("Calculado")).not.toBeInTheDocument();
  });

  it("si la respuesta no trae costo_calculado (producto de otra versión de la API) se comporta como null", async () => {
    await abrirDetalle(producto());

    expect(screen.queryByText("Calculado")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Información comercial" })).getByText("$800")).toBeInTheDocument();
  });
});

describe("HU14 (PT14-13) — el formulario del producto sigue con el costo manual", () => {
  async function abrirEdicion(p: Product) {
    vi.mocked(productService.getProduct).mockResolvedValue(p);
    renderWithProviders(<App />, { initialEntries: ["/productos/7/editar"] });
    await screen.findByRole("heading", { name: "Editar producto" });
  }

  it("la etiqueta es «Costo de producción por unidad» y muestra el manual aunque exista el calculado", async () => {
    await abrirEdicion(producto({ costo_calculado: "62.5625" }));

    expect(screen.getByLabelText("Costo de producción por unidad")).toHaveValue("800");
    expect(screen.queryByDisplayValue("63")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("62.5625")).not.toBeInTheDocument();
  });

  it("guardar otro cambio no envía el costo, ni el manual ni el calculado", async () => {
    const user = userEvent.setup();
    const actualizado = producto({ costo_calculado: "62.5625", nombre: "Mermelada de mora" });
    vi.mocked(productService.updateProduct).mockResolvedValue(actualizado);
    await abrirEdicion(producto({ costo_calculado: "62.5625" }));

    const nombre = screen.getByLabelText(/^Nombre/);
    await user.clear(nombre);
    await user.type(nombre, "Mermelada de mora");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(productService.updateProduct).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(productService.updateProduct).mock.calls[0][1];
    expect(payload).toStrictEqual({ nombre: "Mermelada de mora" });
  });

  it("editar el costo manual envía solo el manual", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.updateProduct).mockResolvedValue(producto({ costo_produccion: "900.00" }));
    await abrirEdicion(producto({ costo_calculado: "62.5625" }));

    const costo = screen.getByLabelText("Costo de producción por unidad");
    await user.clear(costo);
    await user.type(costo, "900");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(productService.updateProduct).toHaveBeenCalledWith(7, { costo_produccion: "900" }));
  });
});
