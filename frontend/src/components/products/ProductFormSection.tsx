import type { ReactNode } from "react";

interface ProductFormSectionProps {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export default function ProductFormSection({
  id,
  title,
  description,
  children,
}: ProductFormSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-4 pt-6 first:pt-0 border-t border-border first:border-t-0"
    >
      <div className="space-y-1">
        <h2 id={id} className="text-sm font-semibold text-text-primary">
          {title}
        </h2>
        {description && (
          <p className="text-xs text-text-secondary leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
