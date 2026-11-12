import { Link } from "react-router-dom";
import {
  EtiquetaEstado,
  EtiquetaOculta,
  EtiquetaPublicacion,
  EtiquetaSinLote,
} from "@/components/elaboraciones/relacionadas/Etiquetas";
import { formatFecha } from "@/lib/elaboracionUtils";
import { textoDelLote } from "@/lib/relacionadas";
import type { ElaboracionRelacionada, UsoRelacionado } from "@/types/relacionadas";

/** The link classes shared by the two actions of a row (44 px tall). */
const ENLACE =
  "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-accent-strong underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function LineaDeUso({ uso, insumoNombre }: { uso: UsoRelacionado; insumoNombre: string }) {
  // A finalizada shows the name it was registered with: if it is not today's name, say so.
  const otroNombre = uso.insumo_nombre && uso.insumo_nombre !== insumoNombre ? uso.insumo_nombre : null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
      {uso.ingrediente.nombre && <span>{uso.ingrediente.nombre}:</span>}
      {uso.lote_estado === "con_lote" ? (
        <span className="font-mono font-medium text-text-primary">
          Lote {uso.lote ? textoDelLote(uso.lote) : "sin datos conservados"}
        </span>
      ) : (
        <EtiquetaSinLote estado={uso.lote_estado} />
      )}
      {otroNombre && <span>Registrado como «{otroNombre}»</span>}
    </div>
  );
}

/**
 * One related elaboración: product, state, publication and hiding as text labels, code, date, the lot it
 * used (or that it has none), and the two ways on: the elaboración and the management of its publication.
 */
export default function FilaRelacionada({
  elaboracion,
  insumoNombre,
}: {
  elaboracion: ElaboracionRelacionada;
  insumoNombre: string;
}) {
  const borrador = elaboracion.estado === "borrador";
  const destino = borrador ? `/elaboraciones/${elaboracion.id}/registro` : `/elaboraciones/${elaboracion.id}`;
  return (
    <li className="flex flex-col gap-2 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">{elaboracion.producto.nombre}</span>
          <EtiquetaEstado estado={elaboracion.estado} />
          <EtiquetaPublicacion publicado={elaboracion.producto.publicado} />
          {elaboracion.oculta && <EtiquetaOculta />}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-text-secondary">
          <span className="font-mono font-medium">{elaboracion.codigo}</span>
          <span aria-hidden="true">·</span>
          <span>{formatFecha(elaboracion.fecha)}</span>
        </div>
        {elaboracion.usos.map((uso, indice) => (
          <LineaDeUso key={indice} uso={uso} insumoNombre={insumoNombre} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-1">
        <Link to={destino} className={ENLACE} aria-label={`Ver la elaboración ${elaboracion.codigo}`}>
          Ver elaboración
        </Link>
        {elaboracion.producto.publicado && (
          <Link
            to={`/publicaciones/${elaboracion.producto.id}`}
            className={ENLACE}
            aria-label={`Gestionar la publicación de ${elaboracion.producto.nombre}`}
          >
            Gestionar publicación
          </Link>
        )}
      </div>
    </li>
  );
}
