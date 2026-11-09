import { formatearFecha } from "@/lib/fichaPublicaFormato";
import type { ElaboracionPublica } from "@/types/consultaPublica";

/** Code and date of the elaboración being shown. */
export default function ElaboracionCabecera({ elaboracion }: { elaboracion: ElaboracionPublica }) {
  return (
    <section
      aria-label="Elaboración consultada"
      className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-text-muted">Código de la elaboración</p>
        <p className="mt-1 text-sm font-semibold text-text-primary">{elaboracion.codigo}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-text-muted">Fecha de elaboración</p>
        <p className="mt-1 text-sm font-semibold text-text-primary">{formatearFecha(elaboracion.fecha)}</p>
      </div>
    </section>
  );
}
