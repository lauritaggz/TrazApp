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
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft sm:p-10">
      {/* El recorrido del logo: del origen (punto lleno) a quien consume (punto abierto). */}
      <svg
        aria-hidden="true"
        width="112"
        height="56"
        viewBox="0 0 112 56"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mx-auto mb-5"
      >
        <path
          d="M14 14H66L30 42H94"
          stroke="var(--color-brand-200)"
          strokeWidth="4"
          strokeDasharray="1 9"
        />
        <circle cx="14" cy="14" r="7" fill="var(--color-brand-600)" />
        <circle cx="66" cy="14" r="4" fill="var(--color-wheat-deep)" />
        <circle cx="30" cy="42" r="4" fill="var(--color-wheat-deep)" />
        <circle cx="98" cy="42" r="6.5" stroke="var(--color-brand-600)" strokeWidth="3" />
      </svg>
      <h2 className="mb-2 text-xl font-bold text-text-primary">{title}</h2>
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
