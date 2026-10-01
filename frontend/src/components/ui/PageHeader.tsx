import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  titleSuffix?: ReactNode;
}

export default function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  titleSuffix,
}: PageHeaderProps) {
  return (
    <div className="space-y-3">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Ruta de navegación">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-text-secondary">
            {breadcrumbs.map((item, index) => {
              const last = index === breadcrumbs.length - 1;
              return (
                <li
                  key={`${item.label}-${index}`}
                  className="flex items-center gap-1.5"
                >
                  {item.to && !last ? (
                    <Link
                      to={item.to}
                      className="rounded font-medium text-brand-700 underline-offset-2 hover:underline"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={last ? "page" : undefined}
                      className={last ? "text-text-primary" : ""}
                    >
                      {item.label}
                    </span>
                  )}
                  {!last && (
                    <span aria-hidden="true" className="text-text-muted">
                      /
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-text-primary">
              {title}
            </h1>
            {titleSuffix}
          </div>
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>
        )}
      </div>
    </div>
  );
}
