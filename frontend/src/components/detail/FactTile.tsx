import type { ReactNode } from "react";

/** A labelled value in a tinted tile; goes inside a `<dl>` grid. */
export default function FactTile({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bg-surface px-4 py-3 ${className}`}>
      <dt className="text-xs font-medium text-text-secondary">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-base font-medium text-text-primary">
        {children}
      </dd>
    </div>
  );
}
