import type { ReactNode } from "react";

interface NavItemProps {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function NavItem({
  icon,
  label,
  active,
  onClick,
}: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
        ${
          active
            ? "bg-brand-50 text-brand-600"
            : "text-text-secondary hover:bg-surface hover:text-text-primary"
        }
      `}
    >
      <span className={active ? "text-brand-600" : "text-text-muted"}>
        {icon}
      </span>
      {label}
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-600" />
      )}
    </button>
  );
}
