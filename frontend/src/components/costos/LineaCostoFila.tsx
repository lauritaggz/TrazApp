import { Link } from "react-router-dom";
import ActualizarJumbo from "@/components/costos/ActualizarJumbo";
import { ELEMENTO_DE_DATOS } from "@/components/costos/estilos";
import { AlertIcon } from "@/components/costos/iconosCostos";
import Select from "@/components/ui/Select";
import { enlaceDeEdicionDesdeCalculadora, etiquetaUnidad, nombreDeOrigen } from "@/lib/costosInsumo";
import {
  AVISO_ULTIMO_INACTIVO,
  ETIQUETA_ORIGEN,
  TEXTO_ULTIMO_INACTIVO,
  UNIDADES_CANTIDAD,
  type BorradorLinea,
} from "@/lib/costosCalculadora";
import { formatearCantidad, formatearFechaLarga, formatearPesos, formatearPrecio } from "@/lib/dinero";
import type { InsumoCosto, LineaCosto } from "@/types/costos";

/** Las columnas de la tabla de ingredientes: las usan la fila de encabezados y cada fila (desde lg). */
export const COLUMNAS_LINEA = "lg:grid-cols-[1.05fr_1.45fr_150px_110px]";

interface LineaCostoFilaProps {
  linea: LineaCosto;
  productoId: number;
  borrador: BorradorLinea;
  errores?: { cantidad?: string; unidad?: string };
  /** Mensaje del servidor (422 con ingrediente_id) para ESTA línea. */
  errorServidor?: string;
  recalculando: boolean;
  onCambiar: (cambios: Partial<BorradorLinea>) => void;
  onElegirInsumo: (insumoId: number) => void;
  /** El precio del insumo se actualizó desde Jumbo: hay que recalcular. */
  onPrecioActualizado: () => void;
}

function nombreDeInsumo(insumo: InsumoCosto): string {
  const partes = [insumo.nombre, insumo.marca_origen];
  if (insumo.presentacion) partes.push(insumo.presentacion);
  return `${partes.join(" · ")}${insumo.habitual ? " (habitual)" : ""}`;
}

/** Rótulo de columna que solo se ve cuando la fila va apilada (celular y tableta): en escritorio lo da el encabezado. */
function Rotulo({ children }: { children: string }) {
  return (
    <p className="mb-1 text-xs font-semibold tracking-wide text-text-muted lg:hidden">{children}</p>
  );
}

const CAMPO =
  "min-h-11 rounded-lg border bg-card text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent";

/** Una fila de la tabla de ingredientes: ingrediente, insumo con su precio, cantidad con su unidad y costo. */
export default function LineaCostoFila({
  linea,
  productoId,
  borrador,
  errores,
  errorServidor,
  recalculando,
  onCambiar,
  onElegirInsumo,
  onPrecioActualizado,
}: LineaCostoFilaProps) {
  const { insumo } = linea;
  const idBase = `linea-${linea.ingrediente_id}`;
  const origen = linea.origen_insumo ? ETIQUETA_ORIGEN[linea.origen_insumo] : null;
  const sinInsumos = linea.insumos_disponibles.length === 0;
  const pendiente = linea.faltantes.length > 0;
  const fecha = insumo ? formatearFechaLarga(insumo.precio_fecha) : null;
  const errorCantidad = errores?.cantidad ?? errores?.unidad;

  return (
    <li
      id={idBase}
      tabIndex={-1}
      className={`p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:p-5 ${
        pendiente ? "bg-error-bg/50" : ""
      }`}
    >
      <div className={`grid grid-cols-1 gap-3 lg:items-start lg:gap-4 ${COLUMNAS_LINEA}`}>
        <div className="min-w-0">
          <Rotulo>Ingrediente</Rotulo>
          <h3 className="break-words text-sm font-semibold text-text-primary">{linea.ingrediente_nombre}</h3>
          {origen && <p className="mt-1 text-xs text-text-secondary">{origen}</p>}
          {linea.aviso_insumo === AVISO_ULTIMO_INACTIVO && (
            <p className="mt-1 text-xs font-medium text-warning">{TEXTO_ULTIMO_INACTIVO}</p>
          )}
        </div>

        <div className="min-w-0">
          <Rotulo>Insumo seleccionado</Rotulo>
          {sinInsumos ? (
            <p className="text-sm text-text-secondary">
              Este ingrediente no tiene insumos disponibles. Registra un insumo para poder calcular su costo.{" "}
              <Link
                to="/insumos/nuevo"
                className="inline-flex min-h-11 items-center font-medium text-accent-strong underline-offset-2 hover:underline"
              >
                Crear insumo
              </Link>
            </p>
          ) : (
            <Select
              id={`${idBase}-insumo`}
              aria-label={`Insumo de ${linea.ingrediente_nombre}`}
              value={insumo ? String(insumo.id) : ""}
              disabled={recalculando}
              onChange={(e) => {
                if (e.target.value !== "") onElegirInsumo(Number(e.target.value));
              }}
            >
              {!insumo && <option value="">Elige un insumo…</option>}
              {linea.insumos_disponibles.map((i) => (
                <option key={i.id} value={i.id}>
                  {nombreDeInsumo(i)}
                </option>
              ))}
            </Select>
          )}

          {insumo && (
            <div className="mt-1 overflow-hidden text-xs text-text-secondary">
              <div className="-ml-5 flex flex-wrap items-center">
                <span className={`${ELEMENTO_DE_DATOS} min-h-6 tabular-nums`}>
                  {insumo.precio_referencia === null
                    ? "Sin precio"
                    : `${formatearPrecio(insumo.precio_referencia)} / ${
                        insumo.contenido_cantidad === null || !insumo.contenido_unidad
                          ? "—"
                          : `${formatearCantidad(insumo.contenido_cantidad)} ${etiquetaUnidad(insumo.contenido_unidad)}`
                      }`}
                </span>
                {insumo.precio_fuente && (
                  <span className={`${ELEMENTO_DE_DATOS} min-h-6`}>{nombreDeOrigen(insumo.precio_fuente)}</span>
                )}
                {fecha && <span className={`${ELEMENTO_DE_DATOS} min-h-6 tabular-nums`}>{fecha}</span>}
                <Link
                  to={enlaceDeEdicionDesdeCalculadora(insumo.id, productoId)}
                  className={`${ELEMENTO_DE_DATOS} min-h-11 font-medium text-accent-strong underline-offset-2 hover:underline`}
                >
                  Editar insumo
                  <span className="sr-only"> de {linea.ingrediente_nombre}</span>
                </Link>
                <ActualizarJumbo
                  insumo={insumo}
                  ingredienteNombre={linea.ingrediente_nombre}
                  onActualizado={onPrecioActualizado}
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <Rotulo>Cantidad por tanda</Rotulo>
          <div className="flex">
            <input
              id={`${idBase}-cantidad`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              aria-label={`Cantidad de ${linea.ingrediente_nombre}`}
              aria-invalid={errores?.cantidad ? true : undefined}
              aria-describedby={errorCantidad ? `${idBase}-error` : undefined}
              value={borrador.cantidad}
              onChange={(e) => onCambiar({ cantidad: e.target.value })}
              className={`${CAMPO} min-w-[4.25rem] flex-1 rounded-r-none border-r-0 px-2.5 tabular-nums ${
                errores?.cantidad ? "border-error bg-error-bg" : "border-border-strong"
              }`}
            />
            <select
              id={`${idBase}-unidad`}
              aria-label={`Unidad de ${linea.ingrediente_nombre}`}
              aria-invalid={errores?.unidad ? true : undefined}
              value={borrador.unidad}
              onChange={(e) => onCambiar({ unidad: e.target.value })}
              className={`${CAMPO} w-[4.75rem] shrink-0 rounded-l-none bg-surface px-2 ${
                errores?.unidad ? "border-error" : "border-border-strong"
              }`}
            >
              <option value="">—</option>
              {UNIDADES_CANTIDAD.map((u) => (
                <option key={u} value={u}>
                  {etiquetaUnidad(u)}
                </option>
              ))}
            </select>
          </div>
          {errorCantidad && (
            <p id={`${idBase}-error`} className="mt-1 text-[13px] text-error">
              {errores?.cantidad ?? errores?.unidad}
            </p>
          )}
        </div>

        <div className="lg:text-right">
          <Rotulo>Costo de la línea</Rotulo>
          <p className={`text-sm font-semibold tabular-nums ${pendiente ? "text-error" : "text-text-primary"}`}>
            {pendiente || linea.costo === null ? "Pendiente" : formatearPesos(linea.costo)}
          </p>
        </div>
      </div>

      {pendiente && (
        <ul className="mt-3 space-y-1">
          {linea.faltantes.map((f) => (
            <li key={f.codigo} className="flex items-center gap-2 text-xs text-error">
              <AlertIcon />
              {f.mensaje}
            </li>
          ))}
        </ul>
      )}

      {errorServidor && (
        <p role="alert" className="mt-3 text-sm font-medium text-error">
          {errorServidor}
        </p>
      )}
    </li>
  );
}
