import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

interface NavItemProps {
  icon: ReactNode;
  label: string;
  to: string;
  onClick?: () => void;
}

export default function NavItem({ icon, label, to, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => `
        flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
        ${
          isActive
            ? "bg-brand-50 text-brand-700"
            : "text-text-secondary hover:bg-surface hover:text-text-primary"
        }
      `}
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={isActive ? "text-brand-600" : "text-text-muted"}
          >
            {icon}
          </span>
          {label}
          {isActive && (
            <span
              aria-hidden="true"
              className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-600"
            />
          )}
        </>
      )}
    </NavLink>
  );
}
