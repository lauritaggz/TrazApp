import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppShell from "@/components/layout/AppShell";
import FormActions from "@/components/ui/FormActions";
import { ToastProvider } from "@/components/ui/Toast";
import { useToast } from "@/components/ui/toastContext";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

function renderShell(onLogout = vi.fn()) {
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AppShell
        activePage="inicio"
        onLogout={onLogout}
        producerName="Ana Perez"
        businessName="Panadería La Espiga"
      >
        <h1>Contenido</h1>
      </AppShell>
    </MemoryRouter>,
  );
  return onLogout;
}

describe("Menú de usuario del header", () => {
  it("abre con teclado, ofrece Mi perfil y cierra con Esc devolviendo el foco", async () => {
    const user = userEvent.setup();
    renderShell();

    const trigger = screen.getByRole("button", {
      name: "Menú de usuario: Ana Perez",
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Mi perfil" })).toHaveAttribute(
      "href",
      "/perfil",
    );

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("link", { name: "Mi perfil" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("pide confirmación antes de cerrar sesión", async () => {
    const user = userEvent.setup();
    const onLogout = renderShell();

    await user.click(screen.getByRole("button", { name: /Menú de usuario/ }));
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(onLogout).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quedarme" }));
    expect(onLogout).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Menú de usuario/ }));
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await user.click(screen.getByRole("button", { name: "Sí, cerrar sesión" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe("Menú lateral", () => {
  it("anticipa Trazabilidad sin enlaces ni foco en lo que aún no existe", () => {
    renderShell();

    expect(screen.getByText("Trazabilidad")).toBeInTheDocument();
    expect(screen.getByText("Elaboraciones")).toBeInTheDocument();
    expect(screen.getByText("Elaboraciones relacionadas")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Elaboraciones/ })).not.toBeInTheDocument();
    // Los términos del modelo anterior ya no aparecen en el menú.
    expect(screen.queryByText("Lotes")).not.toBeInTheDocument();
    expect(screen.queryByText("Consulta histórica")).not.toBeInTheDocument();
  });
});

describe("useUnsavedChangesGuard", () => {
  function FormPage({ initialDirty }: { initialDirty: boolean }) {
    const [dirty, setDirty] = useState(initialDirty);
    const { pendingHref, clearPending } = useUnsavedChangesGuard(dirty);
    return (
      <div>
        <button type="button" onClick={() => setDirty(true)}>
          editar
        </button>
        <Link to="/otra">Ir a otra</Link>
        <a href="https://example.com" onClick={(e) => e.preventDefault()}>
          Externo
        </a>
        {pendingHref && (
          <div role="alertdialog">
            <p>Destino: {pendingHref}</p>
            <button type="button" onClick={clearPending}>
              Seguir editando
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderPage(initialDirty: boolean) {
    return render(
      <MemoryRouter initialEntries={["/form"]}>
        <Routes>
          <Route path="/form" element={<FormPage initialDirty={initialDirty} />} />
          <Route path="/otra" element={<p>Otra página</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("no interfiere cuando no hay cambios", async () => {
    const user = userEvent.setup();
    renderPage(false);

    await user.click(screen.getByRole("link", { name: "Ir a otra" }));
    expect(screen.getByText("Otra página")).toBeInTheDocument();
  });

  it("intercepta enlaces internos con cambios y permite seguir editando", async () => {
    const user = userEvent.setup();
    renderPage(true);

    await user.click(screen.getByRole("link", { name: "Ir a otra" }));
    expect(screen.queryByText("Otra página")).not.toBeInTheDocument();
    expect(screen.getByText("Destino: /otra")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("empieza a proteger en cuanto el formulario se modifica", async () => {
    const user = userEvent.setup();
    renderPage(false);

    await user.click(screen.getByRole("button", { name: "editar" }));
    await user.click(screen.getByRole("link", { name: "Ir a otra" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("ignora enlaces externos y clics con modificadores", async () => {
    const user = userEvent.setup();
    renderPage(true);

    await user.click(screen.getByRole("link", { name: "Externo" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.keyboard("{Control>}");
    await user.click(screen.getByRole("link", { name: "Ir a otra" }));
    await user.keyboard("{/Control}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("avisa al cerrar la pestaña solo si hay cambios", () => {
    const { unmount } = renderPage(true);
    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
    unmount();

    renderPage(false);
    const cleanEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
  });
});

describe("FormActions y Toast", () => {
  it("la barra de acciones queda fija al borde inferior", () => {
    render(
      <FormActions>
        <button type="submit">Guardar</button>
      </FormActions>,
    );

    expect(screen.getByRole("button", { name: "Guardar" }).parentElement).toHaveClass(
      "sticky",
      "bottom-0",
    );
  });

  it("no duplica un aviso idéntico que ya está visible", async () => {
    function Trigger() {
      const { notify } = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            notify("Producto actualizado correctamente.");
            notify("Producto actualizado correctamente.");
          }}
        >
          avisar
        </button>
      );
    }

    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "avisar" }));
    expect(screen.getAllByText("Producto actualizado correctamente.")).toHaveLength(1);
  });
});

describe("FormActions según el scroll", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockObserver() {
    let callback: IntersectionObserverCallback = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn(function (cb: IntersectionObserverCallback) {
        callback = cb;
        return { observe: vi.fn(), disconnect, unobserve: vi.fn() };
      }),
    );
    return {
      disconnect,
      setVisible(isIntersecting: boolean) {
        act(() => {
          callback(
            [{ isIntersecting } as IntersectionObserverEntry],
            {} as IntersectionObserver,
          );
        });
      },
    };
  }

  function bar() {
    return screen.getByRole("button", { name: "Guardar" }).parentElement!;
  }

  it("queda plana en reposo y flota con animación cuando el final no se ve", () => {
    const observer = mockObserver();
    render(
      <FormActions>
        <button type="submit">Guardar</button>
      </FormActions>,
    );

    expect(bar()).toHaveAttribute("data-floating", "false");
    expect(bar()).not.toHaveClass("form-actions-float");
    expect(bar()).toHaveClass("shadow-none");

    observer.setVisible(false);
    expect(bar()).toHaveAttribute("data-floating", "true");
    expect(bar()).toHaveClass("form-actions-float", "shadow-lift");

    observer.setVisible(true);
    expect(bar()).toHaveAttribute("data-floating", "false");
    expect(bar()).not.toHaveClass("form-actions-float");
  });

  it("deja de observar al desmontarse", () => {
    const observer = mockObserver();
    const { unmount } = render(
      <FormActions>
        <button type="submit">Guardar</button>
      </FormActions>,
    );

    unmount();
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it("sin IntersectionObserver sigue funcionando en reposo", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(
      <FormActions>
        <button type="submit">Guardar</button>
      </FormActions>,
    );

    expect(bar()).toHaveAttribute("data-floating", "false");
  });
});
