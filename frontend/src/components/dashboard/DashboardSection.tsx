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
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-text-primary">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[13px] text-text-secondary">{description}</p>
          ) : null}
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-accent underline-offset-2 transition-colors hover:text-accent-strong hover:underline"
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
