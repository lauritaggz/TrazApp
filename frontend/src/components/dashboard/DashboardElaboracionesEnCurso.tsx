import { Link } from "react-router-dom";
import Badge from "@/components/ui/Badge";
import { formatFecha } from "@/lib/elaboracionUtils";
import type { ElaboracionResumen } from "@/types/elaboracion";

export const MAX_ELABORACIONES_EN_CURSO = 5;

/** Most recent first: by date, then by id (the newest registered). Does not change the list it receives. */
export function ordenarBorradores(borradores: ElaboracionResumen[]): ElaboracionResumen[] {
  return [...borradores].sort((a, b) =>
    a.fecha === b.fecha ? b.id - a.id : a.fecha < b.fecha ? 1 : -1,
  );
}

interface DashboardElaboracionesEnCursoProps {
  borradores: ElaboracionResumen[];
}

/** The drafts the productor can pick up again (HT06-07). Nothing is rendered without drafts. */
export default function DashboardElaboracionesEnCurso({
  borradores,
}: DashboardElaboracionesEnCursoProps) {
  if (borradores.length === 0) return null;
  const visibles = ordenarBorradores(borradores).slice(0, MAX_ELABORACIONES_EN_CURSO);
  const ocultos = borradores.length - visibles.length;

  return (
    <section
      aria-labelledby="dashboard-en-curso-title"
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="dashboard-en-curso-title" className="text-base font-semibold text-text-primary">
            Elaboraciones en curso
          </h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Borradores que puedes retomar donde los dejaste.
          </p>
        </div>
        <Badge variant="warning">{borradores.length}</Badge>
      </div>

      <ul className="divide-y divide-border">
        {visibles.map((borrador) => (
          <li key={borrador.id}>
            {/* La fila completa es el enlace: más de 44 px de alto en cualquier pantalla. */}
            <Link
              to={`/elaboraciones/${borrador.id}/registro`}
              aria-label={`Continuar elaboración ${borrador.codigo} de ${borrador.producto.nombre}`}
              className="-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-text-primary">
                  {borrador.producto.nombre}
                </span>
                <span className="mt-0.5 block text-[13px] text-text-secondary">
                  {borrador.codigo} · {formatFecha(borrador.fecha)}
                </span>
              </span>
              <span aria-hidden="true" className="shrink-0 text-sm font-medium text-accent-strong">
                Continuar
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {ocultos > 0 && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-text-secondary">
          Mostrando las {visibles.length} más recientes de {borradores.length}.
        </p>
      )}
    </section>
  );
}
