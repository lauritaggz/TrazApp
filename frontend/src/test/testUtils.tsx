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

export const mockProductor = {
  id: 1,
  nombre: "Ana Perez",
  nombre_negocio: "Panaderia La Espiga",
  email: "ana@ejemplo.com",
  activo: true,
  created_at: "2026-08-24T12:00:00Z",
};
