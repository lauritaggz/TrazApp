import type { ReactNode } from "react";

interface ProductDetailSectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

export default function ProductDetailSection({
  id,
  title,
  children,
}: ProductDetailSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className="bg-card border border-border rounded-xl p-5 sm:p-6"
    >
      <h2
        id={id}
        className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-4"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
