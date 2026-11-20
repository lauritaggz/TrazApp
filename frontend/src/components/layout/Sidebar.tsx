import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import NavItem from "@/components/layout/NavItem";
import { GRUPOS } from "@/components/layout/secciones";

export type AppSection = "inicio" | "productos" | "ingredientes" | "insumos" | "elaboraciones" | "publicaciones" | "calculadora" | "perfil";

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
        fixed inset-y-0 left-0 z-30 flex w-[264px] flex-col
        border-r border-border bg-panel
        transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
        lg:sticky lg:top-0 lg:z-auto lg:h-[100dvh] lg:w-[248px] lg:shrink-0
        ${open ? "translate-x-0 shadow-lift lg:shadow-none" : "-translate-x-full lg:translate-x-0"}
      `}
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 pl-5 pr-3 lg:h-[72px]">
        <Logo size="sm" />
        <ThemeToggle />
      </div>

      <nav
        aria-label="Secciones"
        className="flex-1 space-y-6 overflow-y-auto px-3 pb-6 pt-2"
      >
        {GRUPOS.map((grupo) => (
          <div key={grupo.titulo} className="space-y-0.5">
            <p className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-text-muted">{grupo.titulo}</p>
            {grupo.items.map((item) => (
              <NavItem key={item.to} icon={item.icono} label={item.etiqueta} to={item.to} onClick={onClose} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
