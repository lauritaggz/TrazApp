import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder with the shape of the ficha while it loads. */
export function FichaCargando({ etiqueta = "Cargando la ficha…" }: { etiqueta?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-3">
      <p className="text-sm text-text-secondary">{etiqueta}</p>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}

/** Placeholder for the elaboración area only (the product and the selector stay). */
export function ElaboracionCargando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="mt-4 space-y-3">
      <p className="text-sm text-text-secondary">Cargando la elaboración…</p>
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}
