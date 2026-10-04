import type { ReactNode } from "react";

interface EmptyStateCardProps {
  title: string;
  description: string;
  action?: ReactNode;
  /** Pasos cortos que explican qué ocurre al crear el primer registro. */
  steps?: string[];
}

export default function EmptyStateCard({
  title,
  description,
  action,
  steps,
}: EmptyStateCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center shadow-soft sm:p-10">
      <svg
        aria-hidden="true"
        width="96"
        height="56"
        viewBox="0 0 96 56"
        fill="none"
        className="mx-auto mb-5"
      >
        <line x1="16" y1="30" x2="48" y2="14" stroke="var(--color-brand-200)" strokeWidth="2" />
        <line x1="48" y1="14" x2="80" y2="30" stroke="var(--color-brand-200)" strokeWidth="2" />
        <line x1="48" y1="14" x2="48" y2="44" stroke="var(--color-brand-200)" strokeWidth="2" />
        <circle cx="16" cy="30" r="8" fill="var(--color-brand-100)" stroke="var(--color-brand-500)" strokeWidth="2" />
        <circle cx="80" cy="30" r="8" fill="var(--color-brand-100)" stroke="var(--color-brand-500)" strokeWidth="2" />
        <circle cx="48" cy="44" r="8" fill="var(--color-brand-100)" stroke="var(--color-brand-500)" strokeWidth="2" />
        <circle cx="48" cy="14" r="10" fill="var(--color-brand-600)" />
      </svg>
      <h2 className="mb-2 text-lg font-semibold text-text-primary">{title}</h2>
      <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-text-secondary">
        {description}
      </p>
      {steps && steps.length > 0 && (
        <ol className="mx-auto mb-6 max-w-sm space-y-2 text-left">
          {steps.map((step, index) => (
            <li
              key={step}
              className="flex items-start gap-3 text-sm text-text-secondary"
            >
              <span
                aria-hidden="true"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold tabular-nums text-accent-strong"
              >
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      )}
      {action}
    </div>
  );
}
