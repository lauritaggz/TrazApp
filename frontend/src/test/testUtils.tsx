import { MemoryRouter } from "react-router-dom";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { AuthProvider } from "@/auth/AuthContext";

interface Options extends Omit<RenderOptions, "wrapper"> {
  initialEntries?: string[];
}

export function renderWithProviders(
  ui: ReactElement,
  { initialEntries = ["/"], ...options }: Options = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

import type { Categoria, Product } from "@/types/product";

export const mockCategories: Categoria[] = [
  { id: 1, nombre: "Pastelería" },
  { id: 2, nombre: "Dulce" },
  { id: 3, nombre: "Panadería" },
  { id: 4, nombre: "Salado" },
  { id: 5, nombre: "Bebidas" },
  { id: 6, nombre: "Otros" },
];

export const EMPTY_PRODUCT_COMMERCIAL_FIELDS = {
  costo_produccion: null,
  precio_venta: null,
  imagen_url: null,
  categorias: [],
} satisfies Pick<Product, "costo_produccion" | "precio_venta" | "imagen_url" | "categorias">;

export const mockProductor = {
  id: 1,
  nombre: "Ana Perez",
  nombre_negocio: "Panaderia La Espiga",
  email: "ana@ejemplo.com",
  activo: true,
  created_at: "2026-08-24T12:00:00Z",
};
