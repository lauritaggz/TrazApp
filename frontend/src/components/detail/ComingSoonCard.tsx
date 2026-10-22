import type { ReactNode } from "react";
import Badge from "@/components/ui/Badge";

interface ComingSoonCardProps {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  /** How many empty placeholder rows to draw, to show the shape of what is coming. */
  rows?: number;
}

/**
 * A mockup of something that is not built yet (future work). It shows the shape and says
 * «Próximamente»; it has no data and nothing to press.
 */
export default function ComingSoonCard({ id, title, description, icon, rows = 2 }: ComingSoonCardProps) {
  return (
    <section
      aria-labelledby={id}
      data-proximamente
      className="rounded-2xl border border-dashed border-border-strong bg-card/60 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-text-secondary"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={id} className="text-base font-semibold text-text-primary">
              {title}
            </h2>
            <Badge variant="info">Próximamente</Badge>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">{description}</p>
        </div>
      </div>
      {rows > 0 && (
        <div aria-hidden="true" className="mt-4 space-y-2">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border px-3 py-3">
              <span className="h-8 w-8 shrink-0 rounded-lg bg-surface" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-2.5 w-2/5 rounded bg-surface" />
                <span className="block h-2 w-3/5 rounded bg-surface" />
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
