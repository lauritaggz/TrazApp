import { Link } from "react-router-dom";
import Badge from "@/components/ui/Badge";
import { formatFecha } from "@/lib/elaboracionUtils";
import type { ElaboracionResumen } from "@/types/elaboracion";

/** «Faltan 3 de 5 ingredientes» of a draft, or that it can be finalized. */
export function textoAvanceBorrador(pendientes: number, total: number): string {
  if (pendientes === 0) return "Lista para finalizar";
  return `Falta${pendientes === 1 ? "" : "n"} ${pendientes} de ${total} ingrediente${total === 1 ? "" : "s"}`;
}

/**
 * One row of the history. The whole row is the link: a finalizada opens its detail, a draft its
 * registro (the same as in the product page).
 */
export default function HistorialFila({ elaboracion }: { elaboracion: ElaboracionResumen }) {
  const borrador = elaboracion.estado === "borrador";
  const destino = borrador ? `/elaboraciones/${elaboracion.id}/registro` : `/elaboraciones/${elaboracion.id}`;

  return (
    <li>
      <Link
        to={destino}
        className="flex min-h-11 flex-col gap-2 px-4 py-3 transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{elaboracion.codigo}</span>
            <Badge variant={borrador ? "warning" : "success"}>{borrador ? "Borrador" : "Finalizada"}</Badge>
          </span>
          <span className="mt-0.5 block truncate text-sm text-text-secondary">{elaboracion.producto.nombre}</span>
        </span>
        <span className="flex shrink-0 flex-col gap-0.5 text-sm text-text-secondary sm:items-end">
          <span>{formatFecha(elaboracion.fecha)}</span>
          {borrador && (
            <span className={elaboracion.pendientes === 0 ? "text-success" : "text-warning"}>
              {textoAvanceBorrador(elaboracion.pendientes, elaboracion.total_ingredientes)}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
