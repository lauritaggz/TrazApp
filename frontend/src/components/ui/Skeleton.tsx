export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-border/70 ${className}`}
    />
  );
}

/** Fila con miniatura y dos líneas de texto: imita las filas reales de los listados. */
export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <Skeleton className="h-10 w-10 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/5" />
      </div>
      <Skeleton className="hidden h-3.5 w-16 sm:block" />
    </div>
  );
}

export function ListSkeleton({
  rows = 3,
  label,
}: {
  rows?: number;
  label: string;
}) {
  return (
    <div
      className="space-y-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm text-text-secondary">{label}</p>
      {Array.from({ length: rows }, (_, index) => (
        <ListRowSkeleton key={index} />
      ))}
    </div>
  );
}
