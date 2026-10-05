/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import { PasswordInput } from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { ToastProvider } from "@/components/ui/Toast";
import { useToast } from "@/components/ui/toastContext";

function renderShell(path: string, props: Partial<Parameters<typeof AppShell>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell
        activePage="productos"
        onLogout={vi.fn()}
        producerName="Ana Perez"
        {...props}
      >
        <h1>Contenido</h1>
      </AppShell>
    </MemoryRouter>,
  );
}

function mockViewport(isDesktop: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: isDesktop,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.title = "";
});

describe("Contraste de tokens (UI-A1/A2/A3)", () => {
  const css = readFileSync("src/index.css", "utf8");

  function token(name: string): string {
    const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
    if (!match) throw new Error(`Token ${name} no encontrado`);
    return match[1];
  }

  function luminance(hex: string): number {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, b] = channels.map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function ratio(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  it.each([
    ["text-muted", "card"],
    ["text-muted", "surface"],
    ["text-secondary", "surface"],
    ["panel-muted", "brand-600"],
    ["panel-soft", "brand-600"],
    ["panel-faint", "brand-600"],
    ["warning", "warning-bg"],
    ["info", "info-bg"],
    ["error", "error-bg"],
    ["success", "success-bg"],
  ])("texto %s sobre %s cumple 4.5:1", (fg, bg) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it("el borde de campos cumple 3:1 sobre la tarjeta", () => {
    expect(ratio(token("border-strong"), token("card"))).toBeGreaterThanOrEqual(3);
  });
});

describe("AppShell accesible", () => {
  it("marca la sección actual con aria-current y usa enlaces reales", () => {
    mockViewport(true);
    renderShell("/productos");

    const products = screen.getByRole("link", { name: "Productos" });
    expect(products).toHaveAttribute("href", "/productos");
    expect(products).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Inicio" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("ofrece saltar al contenido y un main enfocable", () => {
    mockViewport(true);
    renderShell("/productos");

    expect(screen.getByRole("link", { name: "Saltar al contenido" })).toHaveAttribute(
      "href",
      "#contenido-principal",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "contenido-principal");
  });

  it("actualiza document.title por sección y por pageTitle", () => {
    mockViewport(true);
    const { unmount } = renderShell("/productos");
    expect(document.title).toBe("Productos · TrazApp");
    unmount();

    renderShell("/productos/nuevo", { pageTitle: "Nuevo producto" });
    expect(document.title).toBe("Nuevo producto · TrazApp");
  });

  it("en móvil el menú cerrado no es accesible y se abre y cierra con Esc", async () => {
    mockViewport(false);
    const user = userEvent.setup();
    const { container } = renderShell("/productos");

    const aside = container.querySelector("aside");
    expect(aside).toHaveAttribute("inert");

    const menuButton = screen.getByRole("button", { name: "Abrir menú" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await user.click(menuButton);
    expect(aside).not.toHaveAttribute("inert");
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(aside).toHaveAttribute("inert");
    expect(menuButton).toHaveFocus();
  });

  it("en móvil el foco queda atrapado dentro del menú", async () => {
    mockViewport(false);
    const user = userEvent.setup();
    renderShell("/productos");

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    const first = screen.getByRole("button", { name: "Cambiar a modo oscuro" });
    const last = screen.getByRole("link", { name: "Insumos" });
    last.focus();

    await user.tab();
    expect(first).toHaveFocus();

    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });
});

describe("Campos de formulario", () => {
  it("Select asocia etiqueta, error y descripción", () => {
    render(
      <Select label="Unidad" error="Selecciona una unidad" defaultValue="">
        <option value="">—</option>
      </Select>,
    );

    const select = screen.getByLabelText("Unidad");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Selecciona una unidad");
  });

  it("Textarea muestra la ayuda cuando no hay error", () => {
    render(<Textarea label="Descripción" hint="Opcional" />);

    expect(screen.getByLabelText("Descripción")).toHaveAccessibleDescription(
      "Opcional",
    );
  });

  it("PasswordInput es alcanzable por teclado y enlaza su error", async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Contraseña" error="Obligatoria" />);

    const input = screen.getByLabelText("Contraseña");
    expect(input).toHaveAccessibleDescription("Obligatoria");

    const toggle = screen.getByRole("button", { name: "Mostrar contraseña" });
    expect(toggle).not.toHaveAttribute("tabindex", "-1");

    await user.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Ocultar contraseña" }),
    ).toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("renderiza migas con la página actual marcada", () => {
    render(
      <MemoryRouter>
        <PageHeader
          title="Galleta"
          breadcrumbs={[
            { label: "Productos", to: "/productos" },
            { label: "Galleta" },
          ]}
          actions={<button type="button">Editar</button>}
        />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "Ruta de navegación" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Productos" })).toHaveAttribute(
      "href",
      "/productos",
    );
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("Galleta");
    expect(screen.getByRole("heading", { level: 1, name: "Galleta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });
});

describe("Toast", () => {
  function Trigger() {
    const { notify } = useToast();
    return (
      <>
        <button type="button" onClick={() => notify("Guardado")}>
          ok
        </button>
        <button type="button" onClick={() => notify("Falló", "error")}>
          fail
        </button>
      </>
    );
  }

  it("anuncia éxito como status y error como alert, y se puede cerrar", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "ok" }));
    expect(screen.getByRole("status")).toHaveTextContent("Guardado");

    await user.click(screen.getByRole("button", { name: "fail" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Falló");

    await user.click(screen.getAllByRole("button", { name: "Cerrar notificación" })[0]);
    expect(screen.queryByText("Guardado")).not.toBeInTheDocument();
  });

  it("se descarta solo después del tiempo de espera", () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <Trigger />
        </ToastProvider>,
      );

      act(() => {
        screen.getByRole("button", { name: "ok" }).click();
      });
      expect(screen.getByText("Guardado")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(5100);
      });
      expect(screen.queryByText("Guardado")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("useToast no falla fuera de un proveedor", () => {
    expect(() => render(<Trigger />)).not.toThrow();
  });
});
