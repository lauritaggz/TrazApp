import { Link } from "react-router-dom";
import { CheckIcon, FlechaDerechaIcon, LapizIcon } from "@/components/elaboraciones/historial/iconos";
import EtiquetaOculta from "@/components/elaboraciones/EtiquetaOculta";
import Badge from "@/components/ui/Badge";
import { formatFecha } from "@/lib/elaboracionUtils";
import type { ElaboracionResumen } from "@/types/elaboracion";

/** «Faltan 3 de 5 ingredientes» of a draft, or that it can be finalized. */
export function textoAvanceBorrador(pendientes: number, total: number): string {
  if (pendientes === 0) return "Lista para finalizar";
  return `Falta${pendientes === 1 ? "" : "n"} ${pendientes} de ${total} ingrediente${total === 1 ? "" : "s"}`;
}

/**
 * One row of the history: the state icon, the product with its badge, the code and the date, and an
 * arrow. The whole row is the link: a finalizada opens its detail, a draft its registro (the same as
 * in the product page).
 */
export default function HistorialFila({ elaboracion }: { elaboracion: ElaboracionResumen }) {
  const borrador = elaboracion.estado === "borrador";
  const destino = borrador ? `/elaboraciones/${elaboracion.id}/registro` : `/elaboraciones/${elaboracion.id}`;

  return (
    <li>
      <Link
        to={destino}
        className="flex min-h-11 items-start gap-3 px-4 py-3 transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:px-5 sm:py-4"
      >
        <span
          aria-hidden="true"
          data-icono={borrador ? "borrador" : "finalizada"}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            borrador ? "bg-warning-bg text-warning" : "bg-brand-50 text-accent"
          }`}
        >
          {borrador ? <LapizIcon size={18} /> : <CheckIcon size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{elaboracion.producto.nombre}</span>
            <Badge variant={borrador ? "warning" : "success"}>{borrador ? "Borrador" : "Finalizada"}</Badge>
            {elaboracion.oculta === true && <EtiquetaOculta />}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-text-secondary">
            <span className="font-mono font-medium">{elaboracion.codigo}</span>
            <span aria-hidden="true">·</span>
            <span>{formatFecha(elaboracion.fecha)}</span>
          </span>
          {borrador && (
            <span className={`mt-1 block text-xs font-medium ${elaboracion.pendientes === 0 ? "text-success" : "text-warning"}`}>
              {textoAvanceBorrador(elaboracion.pendientes, elaboracion.total_ingredientes)}
            </span>
          )}
        </span>
        <span aria-hidden="true" className="mt-3 shrink-0 text-text-muted">
          <FlechaDerechaIcon />
        </span>
      </Link>
    </li>
  );
}
