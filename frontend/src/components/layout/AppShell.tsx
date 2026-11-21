import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import TabBar from "@/components/layout/TabBar";
import { direccionDeEntrada } from "@/components/layout/transicionPagina";
import UserMenu from "@/components/layout/UserMenu";
import Sidebar, { type AppSection } from "@/components/layout/Sidebar";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const SECTION_TITLES: Record<AppSection, string> = {
  inicio: "Inicio",
  productos: "Productos",
  ingredientes: "Ingredientes",
  insumos: "Insumos",
  elaboraciones: "Elaboraciones",
  publicaciones: "Publicaciones",
  calculadora: "Calculadora de costos",
  perfil: "Mi perfil",
};

const SIDEBAR_ID = "app-sidebar";
const FOCUSABLE = "a[href], button:not([disabled])";

interface AppShellProps {
  children: ReactNode;
  activePage: AppSection;
  /** Título de la pestaña; por defecto el de la sección activa. */
  pageTitle?: string;
  onLogout: () => void;
  producerName?: string;
  businessName?: string | null;
}

export default function AppShell({
  children,
  activePage,
  pageTitle,
  onLogout,
  producerName,
  businessName,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desde qué lado entra el contenido: se fija una vez, al montarse la página.
  const [direccion] = useState(direccionDeEntrada);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarWrapRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(pageTitle ?? SECTION_TITLES[activePage]);

  const drawerOpen = sidebarOpen && !isDesktop;

  useEffect(() => {
    if (!drawerOpen) return;

    const wrap = sidebarWrapRef.current;
    // El foco inicial va a la primera sección de navegación, no al botón de modo.
    (
      wrap?.querySelector<HTMLElement>("nav a[href]") ??
      wrap?.querySelector<HTMLElement>(FOCUSABLE)
    )?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !wrap) return;
      const items = Array.from(wrap.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  return (
    <div className="flex min-h-[100dvh] bg-surface">
      <a
        href="#contenido-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-brand"
      >
        Saltar al contenido
      </a>

      {drawerOpen && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Cerrar menú"
          className="fixed inset-0 z-20 cursor-default bg-black/35 backdrop-blur-[2px] lg:hidden"
          onClick={() => {
            setSidebarOpen(false);
            menuButtonRef.current?.focus();
          }}
        />
      )}

      <div ref={sidebarWrapRef} className="contents">
        <Sidebar
          id={SIDEBAR_ID}
          open={sidebarOpen}
          interactive={isDesktop || sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[15] shrink-0 border-b border-border bg-surface/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-5 lg:px-8">
            {isDesktop ? (
              <span className="text-sm text-text-secondary">Panel de gestión</span>
            ) : (
              <Link
                to="/dashboard"
                className="-ml-1 flex min-h-11 items-center rounded-xl px-1"
              >
                <Logo size="sm" />
              </Link>
            )}

            <UserMenu
              producerName={producerName}
              businessName={businessName}
              onLogout={onLogout}
            />
          </div>
        </header>

        <main
          id="contenido-principal"
          tabIndex={-1}
          // Sin `overflow` propio: la que scrollea es la ventana. Con `overflow-y-auto` el `sticky` de
          // FormActions se ataba a este contenedor, que nunca scrollea, y la barra no se quedaba fija.
          // En el celular el borde inferior deja espacio a la barra de pestañas (--tabbar-h).
          className="flex-1 px-4 pt-5 pb-[calc(var(--tabbar-h)+1.5rem)] outline-none sm:px-5 lg:p-8"
        >
          <div className="app-page mx-auto w-full max-w-[1440px]" data-dir={direccion}>
            {children}
          </div>
        </main>
      </div>

      {!isDesktop && (
        <TabBar
          ref={menuButtonRef}
          menuId={SIDEBAR_ID}
          menuOpen={drawerOpen}
          onOpenMenu={() => setSidebarOpen(true)}
        />
      )}
    </div>
  );
}
