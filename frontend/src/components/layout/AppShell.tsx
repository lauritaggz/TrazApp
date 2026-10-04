import { useEffect, useRef, useState, type ReactNode } from "react";
import UserMenu from "@/components/layout/UserMenu";
import Sidebar, { type AppSection } from "@/components/layout/Sidebar";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const SECTION_TITLES: Record<AppSection, string> = {
  inicio: "Inicio",
  productos: "Productos",
  ingredientes: "Ingredientes",
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
    <div className="min-h-screen bg-surface flex">
      <a
        href="#contenido-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Saltar al contenido
      </a>

      {drawerOpen && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Cerrar menú"
          className="fixed inset-0 z-20 cursor-default bg-black/30 lg:hidden"
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
        <header className="shrink-0 border-b border-border bg-card">
          <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-5 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface lg:hidden"
                aria-label="Abrir menú"
                aria-controls={SIDEBAR_ID}
                aria-expanded={drawerOpen}
              >
                <MenuIcon />
              </button>
              <span className="hidden text-sm text-text-secondary sm:block">
                Panel de gestión
              </span>
            </div>

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
          className="flex-1 overflow-y-auto p-5 outline-none lg:p-8"
        >
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
