import type { ReactNode } from "react";

interface DashboardSectionProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}

export default function DashboardSection({
  title,
  description,
  actionLabel,
  onAction,
  children,
}: DashboardSectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
          ) : null}
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 text-sm font-medium text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline"
            aria-label={actionLabel}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}
