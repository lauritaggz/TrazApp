import { Link } from "react-router-dom";
import { AlertIcon, LockIcon } from "@/components/costos/iconosCostos";
import { Input } from "@/components/ui/Input";
import { formatearFechaLarga, formatearPesos } from "@/lib/dinero";
import type { CostosProducto } from "@/types/costos";

interface ResumenCostosProps {
  datos: CostosProducto;
  /** Hay cambios sin guardar: el resumen todavía no los refleja. */
  sucio: boolean;
  rendimiento: string;
  errorRendimiento?: string;
  onRendimiento: (valor: string) => void;
}

function Fila({ etiqueta, valor, pendiente = false }: { etiqueta: string; valor: string; pendiente?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-text-secondary">{etiqueta}</span>
      <span className={`text-sm font-medium tabular-nums ${pendiente ? "text-error" : "text-text-primary"}`}>
        {valor}
      </span>
    </div>
  );
}

/**
 * Columna lateral: el resumen del cálculo. Un total solo se muestra con el cálculo completo, nunca uno parcial:
 * con faltantes, el recuadro rojo lista cada uno como «Ingrediente: mensaje» y enlaza con su línea.
 */
export default function ResumenCostos({ datos, sucio, rendimiento, errorRendimiento, onRendimiento }: ResumenCostosProps) {
  const { resumen } = datos;
  const faltantes = datos.lineas.flatMap((l) => l.faltantes.map((f) => ({ linea: l, faltante: f })));
  const pendiente = faltantes.length > 0;
  const masAntiguo = formatearFechaLarga(resumen.precio_mas_antiguo);

  return (
    <aside className="space-y-4 xl:sticky xl:top-5">
      <section aria-labelledby="costos-resumen" className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <h2 id="costos-resumen" className="text-sm font-semibold text-text-primary">
          Resumen del cálculo
        </h2>

        <div className="mt-4">
          <Input
            id="costos-rendimiento"
            label="Rendimiento por tanda"
            hint="Cantidad de productos terminados"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={rendimiento}
            error={errorRendimiento}
            onChange={(e) => onRendimiento(e.target.value)}
          />
        </div>

        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <Fila
            etiqueta="Ingredientes"
            valor={pendiente || resumen.total_ingredientes === null ? "Pendiente" : formatearPesos(resumen.total_ingredientes)}
            pendiente={pendiente || resumen.total_ingredientes === null}
          />
          <Fila etiqueta="Otros costos" valor={formatearPesos(resumen.total_otros_costos)} />
        </div>

        {resumen.completo && resumen.costo_tanda !== null ? (
          <div className="mt-5 rounded-xl bg-brand-600 p-4 text-white">
            <div>
              <p className="text-xs text-brand-100">Costo por tanda</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatearPesos(resumen.costo_tanda)}</p>
            </div>
            <div className="mt-4 border-t border-white/20 pt-4">
              {resumen.costo_unidad !== null ? (
                <div className="flex items-end justify-between gap-3">
                  <p className="text-xs text-brand-100">Costo por unidad</p>
                  <p className="text-xl font-semibold tabular-nums">{formatearPesos(resumen.costo_unidad)}</p>
                </div>
              ) : (
                <p className="text-xs text-brand-100">Indica el rendimiento para ver el costo por unidad.</p>
              )}
            </div>
            <span className="mt-3 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">Calculado</span>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-error-border bg-error-bg p-3 text-error">
            <p className="flex items-center gap-2 text-xs font-semibold">
              <AlertIcon />
              No se puede calcular el total
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs leading-relaxed">
              {faltantes.map(({ linea, faltante }) => (
                <li key={`${linea.ingrediente_id}-${faltante.codigo}`}>
                  <a
                    href={`#linea-${linea.ingrediente_id}`}
                    className="inline-flex min-h-11 items-center underline underline-offset-2"
                    onClick={(e) => {
                      const destino = document.getElementById(`linea-${linea.ingrediente_id}`);
                      if (!destino) return;
                      e.preventDefault();
                      destino.scrollIntoView?.({ block: "center" });
                      destino.focus();
                    }}
                  >
                    {linea.ingrediente_nombre}: {faltante.mensaje}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {sucio && (
          <p className="mt-4 text-xs leading-relaxed text-text-secondary">
            Estos valores se recalculan cuando guardas los cambios.
          </p>
        )}

        {masAntiguo && (
          <p className="mt-4 text-xs leading-relaxed text-text-secondary">
            Precio más antiguo considerado: <strong className="font-medium text-text-primary">{masAntiguo}</strong>.
          </p>
        )}

        <Link
          to={`/productos/${datos.producto_id}`}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-text-primary hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Ver detalle del producto
        </Link>
      </section>

      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface p-4">
        <span className="mt-0.5 text-text-secondary">
          <LockIcon />
        </span>
        <p className="text-xs leading-relaxed text-text-secondary">
          La selección temporal de insumos no se guarda ni altera elaboraciones finalizadas.
        </p>
      </div>
    </aside>
  );
}
