import Logo from "@/components/Logo";
import NavItem from "@/components/layout/NavItem";

export type DashboardSection = "inicio" | "productos" | "ingredientes";

interface SidebarProps {
  activePage: DashboardSection;
  onNavigate: (page: DashboardSection) => void;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({
  activePage,
  onNavigate,
  onLogout,
  open,
  onClose,
}: SidebarProps) {
  function go(page: DashboardSection) {
    onNavigate(page);
    onClose();
  }

  return (
    <aside
      className={`
        fixed lg:static inset-y-0 left-0 z-30 flex flex-col
        w-[240px] bg-card border-r border-border
        transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
    >
      <div className="flex items-center h-16 px-5 border-b border-border shrink-0">
        <Logo size="sm" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavItem
          icon={<HomeIcon />}
          label="Inicio"
          active={activePage === "inicio"}
          onClick={() => go("inicio")}
        />
        <NavItem
          icon={<BoxIcon />}
          label="Productos"
          active={activePage === "productos"}
          onClick={() => go("productos")}
        />
        <NavItem
          icon={<LeafIcon />}
          label="Ingredientes"
          active={activePage === "ingredientes"}
          onClick={() => go("ingredientes")}
        />
      </nav>

      <div className="px-3 pb-4 border-t border-border pt-3 shrink-0">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:text-error hover:bg-error-bg transition-colors"
        >
          <LogoutIcon />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function HomeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 8C8 10 5.9 16.17 3.82 19.82A2 2 0 004 22h1c8.27 0 15-6.73 15-15v-1l-3 2z" />
      <line x1="7" y1="17" x2="13" y2="11" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
