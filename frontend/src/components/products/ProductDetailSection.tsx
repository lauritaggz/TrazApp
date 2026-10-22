import type { ReactNode } from "react";

interface ProductDetailSectionProps {
  id: string;
  title: string;
  /** A short line under the title that says what the section is for. */
  description?: string;
  children: ReactNode;
}

export default function ProductDetailSection({
  id,
  title,
  description,
  children,
}: ProductDetailSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6"
    >
      <h2 id={id} className="text-base font-semibold text-text-primary">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
