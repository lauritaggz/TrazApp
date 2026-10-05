import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import NavItem, { NavItemSoon } from "@/components/layout/NavItem";

export type AppSection = "inicio" | "productos" | "ingredientes" | "insumos" | "perfil";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  /** Cuando es false el panel móvil está fuera de pantalla y no debe recibir foco. */
  interactive: boolean;
  id?: string;
}

export default function Sidebar({ open, onClose, interactive, id }: SidebarProps) {
  return (
    <aside
      id={id}
      aria-label="Navegación principal"
      inert={!interactive}
      className={`
        fixed lg:static inset-y-0 left-0 z-30 flex flex-col
        w-[240px] bg-card border-r border-border
        transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border pl-5 pr-3">
        <Logo size="sm" />
        <ThemeToggle />
      </div>

      <nav
        aria-label="Secciones"
        className="flex-1 overflow-y-auto px-3 py-4 space-y-6"
      >
        <div className="space-y-1">
          <NavItem icon={<HomeIcon />} label="Inicio" to="/dashboard" onClick={onClose} />
          <NavItem icon={<BoxIcon />} label="Productos" to="/productos" onClick={onClose} />
          <NavItem
            icon={<LeafIcon />}
            label="Ingredientes"
            to="/ingredientes"
            onClick={onClose}
          />
          <NavItem icon={<SupplyIcon />} label="Insumos" to="/insumos" onClick={onClose} />
        </div>

        <div className="space-y-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Trazabilidad
          </p>
          <NavItemSoon icon={<LotIcon />} label="Lotes" />
          <NavItemSoon icon={<HistoryIcon />} label="Consulta histórica" />
        </div>
      </nav>
    </aside>
  );
}

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
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
      aria-hidden="true"
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
      aria-hidden="true"
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

function LotIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 106 5.3L3 8" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function SupplyIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}
