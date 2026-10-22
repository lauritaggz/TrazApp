import type { ReactNode } from "react";

interface DetailHeroProps {
  /** What this page is about: «Producto», «Insumo», «Ingrediente». */
  kind: string;
  icon: ReactNode;
  title: string;
  /** Badges next to the title (state, «Habitual»…). */
  badges?: ReactNode;
  subtitle?: ReactNode;
  /** Main action first: on a phone they stack full width, on a desktop they sit on the right. */
  actions?: ReactNode;
}

/**
 * The top of a detail page: a tinted band with the icon tile resting on its edge, the name, the
 * state and the actions. The same shape for productos, insumos and ingredientes so they read as
 * one family.
 */
export default function DetailHero({ kind, icon, title, badges, subtitle, actions }: DetailHeroProps) {
  return (
    <header className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div aria-hidden="true" className="h-14 bg-brand-100 sm:h-16" />
      <div className="flex flex-col gap-5 px-5 pb-5 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:pb-6">
        <div className="min-w-0">
          <div
            aria-hidden="true"
            className="-mt-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-200 bg-brand-50 text-accent-strong shadow-soft ring-4 ring-card"
          >
            {icon}
          </div>
          <p className="mt-3 text-sm font-medium text-accent-strong">{kind}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="break-words text-2xl font-semibold leading-tight text-text-primary sm:text-3xl">
              {title}
            </h1>
            {badges}
          </div>
          {subtitle && (
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:pt-4">{actions}</div>
        )}
      </div>
    </header>
  );
}
