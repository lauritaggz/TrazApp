import { Link } from "react-router-dom";
import EscanerCodigoBarras from "@/components/insumos/EscanerCodigoBarras";
import Button from "@/components/ui/Button";
import type { BusquedaCodigoBarras } from "@/hooks/useBusquedaCodigoBarras";
import { nombreFuente } from "@/lib/fuentesInsumo";
import type { InsumoDuplicateInfo } from "@/types/insumo";

export const MENSAJE_BUSCANDO = "Buscando el producto…";
export const mensajeEncontrado = (fuente: string) =>
  `Encontramos este producto en ${nombreFuente(fuente)}. Revisa los datos antes de registrar.`;
export const MENSAJE_NO_ENCONTRADO = "No encontramos este código. Completa los datos manualmente.";
export const MENSAJE_NO_DISPONIBLE =
  "No pudimos consultar la fuente en este momento. Completa los datos manualmente.";
export const MENSAJE_ERROR_BUSQUEDA =
  "No pudimos completar la búsqueda. Intenta de nuevo o completa los datos manualmente.";
export const TITULO_DUPLICADO = "Ya tienes este insumo registrado";

/** What can be done with the supply that already has the code; the screen decides which options it offers. */
export interface AccionesExistente {
  /** The page: a link to the supply's detail. */
  hrefVer?: (existente: InsumoDuplicateInfo) => string;
  /** The elaboración dialog: use it for the line (only if it belongs to the line's ingredient). */
  onUsar?: (existente: InsumoDuplicateInfo) => void;
  onReactivar: (existente: InsumoDuplicateInfo) => void;
  ocupado: boolean;
  /** Why it cannot be used (another ingredient, or it could not be checked). */
  aviso: string;
}

interface BuscarPorCodigoProps {
  busqueda: BusquedaCodigoBarras;
  existente: AccionesExistente;
  /** Inside a dialog: tighter spacing, no card. */
  embedded?: boolean;
}

const NOTA = "rounded-lg border px-3.5 py-3 text-sm leading-relaxed";

/** The «scan the barcode» block of the supply form (HU13). It owns no form data: it only reports the lookup. */
export default function BuscarPorCodigo({ busqueda, existente, embedded = false }: BuscarPorCodigoProps) {
  const { estado, duplicado } = busqueda;

  let mensaje = "";
  if (estado === "buscando") mensaje = MENSAJE_BUSCANDO;
  else if (estado === "encontrado") {
    mensaje = mensajeEncontrado(busqueda.consulta?.fuente ?? "");
  }
  else if (estado === "no_encontrado") mensaje = MENSAJE_NO_ENCONTRADO;
  else if (estado === "no_disponible") mensaje = MENSAJE_NO_DISPONIBLE;
  else if (estado === "invalido") mensaje = busqueda.mensajeInvalido;
  else if (estado === "error") mensaje = MENSAJE_ERROR_BUSQUEDA;

  return (
    <section
      aria-label="Buscar por código de barras"
      className={
        embedded
          ? "space-y-3 rounded-lg border border-border p-3.5"
          : "max-w-2xl space-y-3 rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6"
      }
    >
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-text-primary">Completar con el código de barras</h2>
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Escanea el envase con la cámara o escribe el número del código. Buscamos el producto y
          completamos el formulario; tú revisas y confirmas antes de registrar.
        </p>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full sm:w-auto"
        disabled={estado === "buscando"}
        onClick={busqueda.abrirEscaner}
      >
        Escanear código de barras
      </Button>

      {/* Always mounted: a live region announces what it receives. */}
      <p
        role="status"
        aria-live="polite"
        className={
          mensaje
            ? estado === "encontrado"
              ? `${NOTA} border-success-border bg-success-bg text-success`
              : estado === "buscando"
                ? "text-sm text-text-secondary"
                : `${NOTA} border-info-border bg-info-bg text-info`
            : "sr-only"
        }
      >
        {mensaje}
      </p>

      {estado === "duplicado" && duplicado && (
        <div
          className={`${NOTA} space-y-3 border-warning-border bg-warning-bg text-warning`}
          role="status"
        >
          <p className="font-medium">
            {TITULO_DUPLICADO}
            {!duplicado.activo && (
              <span className="font-normal"> (está desactivado; puedes reactivarlo)</span>
            )}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {existente.hrefVer && (
              <Link
                to={existente.hrefVer(duplicado)}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Ver insumo
              </Link>
            )}
            {duplicado.activo && existente.onUsar && (
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                loading={existente.ocupado}
                onClick={() => existente.onUsar?.(duplicado)}
              >
                Usar este insumo
              </Button>
            )}
            {!duplicado.activo && (
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                loading={existente.ocupado}
                onClick={() => existente.onReactivar(duplicado)}
              >
                Reactivar
              </Button>
            )}
          </div>
          {existente.aviso && <p className="font-medium text-error">{existente.aviso}</p>}
        </div>
      )}

      {busqueda.escanerAbierto && (
        <EscanerCodigoBarras onDetectado={busqueda.buscar} onCerrar={busqueda.cerrarEscaner} />
      )}
    </section>
  );
}
