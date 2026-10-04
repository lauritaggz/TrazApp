/// <reference types="node" />
import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "@/components/layout/AppShell";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Login from "@/pages/Login";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { THEME_STORAGE_KEY } from "@/theme/themeContext";
import { renderWithProviders } from "@/test/testUtils";

function stubSystemTheme(prefersDark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-color-scheme: dark") ? prefersDark : true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Selector de modo claro u oscuro", () => {
  it("alterna entre claro y oscuro, lo aplica a <html> y lo recuerda", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset.theme).toBe("light");
    const toActivateDark = screen.getByRole("button", {
      name: "Cambiar a modo oscuro",
    });

    await user.click(toActivateDark);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Cambiar a modo claro" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("respeta la elección guardada por encima del sistema", () => {
    stubSystemTheme(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Cambiar a modo claro" }),
    ).toBeInTheDocument();
  });

  it("sin elección guardada usa la preferencia del sistema", () => {
    stubSystemTheme(true);
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("ignora un valor guardado inválido", () => {
    stubSystemTheme(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "morado");
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("funciona aunque el almacenamiento falle", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Cambiar a modo oscuro" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    vi.restoreAllMocks();
  });
});

describe("Ubicación del selector", () => {
  it("en el menú lateral va justo al lado del logo", () => {
    stubSystemTheme(true);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ThemeProvider>
          <AppShell activePage="inicio" onLogout={vi.fn()} producerName="Ana Perez">
            <h1>Contenido</h1>
          </AppShell>
        </ThemeProvider>
      </MemoryRouter>,
    );

    const sidebar = screen.getByRole("complementary", {
      name: "Navegación principal",
    });
    const logo = within(sidebar).getByText("TrazApp");
    const toggle = within(sidebar).getByRole("button", {
      name: /Cambiar a modo/,
    });
    expect(logo.closest("div")?.parentElement).toBe(toggle.parentElement);
  });

  it("en el login también está junto al logo", () => {
    renderWithProviders(<Login />, { initialEntries: ["/login"] });

    const toggles = screen.getAllByRole("button", { name: /Cambiar a modo/ });
    expect(toggles.length).toBeGreaterThan(0);
    for (const toggle of toggles) {
      expect(within(toggle.parentElement!).getByText("TrazApp")).toBeInTheDocument();
    }
  });
});

describe("Contraste del modo oscuro", () => {
  const css = readFileSync("src/index.css", "utf8");
  const dark = css.slice(css.indexOf(':root[data-theme="dark"]'));

  function token(name: string, source = dark): string {
    const match = source.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
    if (!match) throw new Error(`Token ${name} no encontrado`);
    return match[1];
  }

  function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function ratio(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  it.each([
    ["text-primary", "card"],
    ["text-secondary", "surface"],
    ["text-secondary", "card"],
    ["text-muted", "surface"],
    ["text-muted", "card"],
    ["text-muted", "brand-50"],
    ["accent-strong", "card"],
    ["accent-strong", "brand-50"],
    ["error", "error-bg"],
    ["success", "success-bg"],
    ["warning", "warning-bg"],
    ["info", "info-bg"],
    ["error", "card"],
  ])("texto %s sobre %s cumple 4.5:1", (fg, bg) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["border-strong", "card"],
    ["accent", "card"],
  ])("%s sobre %s cumple 3:1 (bordes y anillos de foco)", (fg, bg) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(3);
  });

  it("el relleno de marca conserva texto blanco legible", () => {
    expect(ratio("#ffffff", token("brand-600", css))).toBeGreaterThanOrEqual(4.5);
  });
});
