import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import Badge from "@/components/ui/Badge";
import { useNavegacionAnimada } from "@/components/layout/transicionPagina";

interface NavItemProps {
  icon: ReactNode;
  label: string;
  to: string;
  onClick?: () => void;
}

/**
 * Enlace del menú lateral. El activo se marca con un relleno verde (`nav-ind`) que,
 * al cambiar de sección, se desliza de un ítem al otro con la View Transitions API.
 */
export default function NavItem({ icon, label, to, onClick }: NavItemProps) {
  const animar = useNavegacionAnimada();

  return (
    <NavLink
      to={to}
      onClick={(event) => {
        onClick?.();
        animar(to)(event);
      }}
      className={({ isActive }) => `
        relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-200
        ${
          isActive
            ? "font-semibold text-on-brand"
            : "font-medium text-text-secondary hover:bg-wheat/70 hover:text-text-primary"
        }
      `}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-xl bg-brand-600 [view-transition-name:nav-ind]"
            />
          )}
          <span
            aria-hidden="true"
            className={`relative ${isActive ? "text-on-brand" : "text-text-muted"}`}
          >
            {icon}
          </span>
          <span className="relative">{label}</span>
        </>
      )}
    </NavLink>
  );
}

/** Sección planificada: se muestra como texto, sin enlace ni foco, para anticipar el menú. */
export function NavItemSoon({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted">
      <span aria-hidden="true">{icon}</span>
      {label}
      <Badge className="ml-auto">Pronto</Badge>
    </div>
  );
}
