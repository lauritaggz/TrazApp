import type { ReactNode } from "react";
import Badge from "@/components/ui/Badge";

interface ProductFormSectionProps {
  id: string;
  title: string;
  description?: string;
  optional?: boolean;
  children: ReactNode;
}

export default function ProductFormSection({
  id,
  title,
  description,
  optional = false,
  children,
}: ProductFormSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-4 border-t border-border pt-8 first:border-t-0 first:pt-0"
    >
      <div className="space-y-1">
        <h2
          id={id}
          className="flex items-center gap-2 text-sm font-semibold text-text-primary"
        >
          {title}
          {optional && <Badge>Opcional</Badge>}
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
