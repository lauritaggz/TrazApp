import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AlergenosPublicos from "@/components/fichaPublica/AlergenosPublicos";
import AvisoConsumidor from "@/components/fichaPublica/AvisoConsumidor";
import ElaboracionCabecera from "@/components/fichaPublica/ElaboracionCabecera";
import EstadoPublico from "@/components/fichaPublica/EstadoPublico";
import { ElaboracionCargando, FichaCargando } from "@/components/fichaPublica/FichaCargando";
import {
  IconoAlerta,
  IconoCalendarioTachado,
  IconoOjoTachado,
} from "@/components/fichaPublica/iconosPublicos";
import InsumosPublicos from "@/components/fichaPublica/InsumosPublicos";
import NotaVersionAnterior from "@/components/fichaPublica/NotaVersionAnterior";
import {
  ESTADO_404_PUBLICO,
  MENSAJE_ELABORACION_NO_DISPONIBLE,
  type TextosDeEstado,
} from "@/components/fichaPublica/fichaPublicaTextos";
import ProductoEncabezado from "@/components/fichaPublica/ProductoEncabezado";
import SelectorElaboracion from "@/components/fichaPublica/SelectorElaboracion";
import Logo from "@/components/Logo";
import Button from "@/components/ui/Button";
import { formatearFecha } from "@/lib/fichaPublicaFormato";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useFichaPublica } from "@/hooks/useFichaPublica";
import type { ApiError } from "@/types/auth";
import type { FichaPublica as Ficha, SeleccionElaboracion } from "@/types/consultaPublica";

export interface FichaVistaProps {
  /** Identifies where the ficha comes from (public id, or the product of a preview). */
  fuente: string;
  /** Loads the ficha for the selection in the URL. The ONLY thing that differs between the public
   *  view (no token) and the productor's preview (authenticated). */
  cargar: (seleccion: SeleccionElaboracion, signal: AbortSignal) => Promise<Ficha>;
  /** Address of this view without the search, for the «ver la más reciente» link. */
  rutaBase: string;
  /** Rendered above the consumer's header (the preview toolbar); never present in the public view. */
  barraSuperior?: ReactNode;
  prefijoTitulo?: string;
  estado404?: TextosDeEstado;
}

/** The public ficha as the consumer sees it (HU10). The URL holds the selection (`?codigo=` / `?fecha=`). */
export default function FichaVista({
  fuente,
  cargar,
  rutaBase,
  barraSuperior,
  prefijoTitulo,
  estado404 = ESTADO_404_PUBLICO,
}: FichaVistaProps) {
  const [params, setParams] = useSearchParams();
  const codigoEnUrl = params.get("codigo");
  const fechaEnUrl = params.get("fecha");
  const { fase, ficha, error, reintentar } = useFichaPublica(fuente, cargar, codigoEnUrl, fechaEnUrl);

  const noDisponible = fase === "error" && error?.status === 404;
  const titulo = ficha ? ficha.producto.nombre : noDisponible ? estado404.titulo : "Ficha del producto";
  useDocumentTitle(prefijoTitulo ? `${prefijoTitulo} · ${titulo}` : titulo);

  // One history entry per selection, so Back and shared links work.
  const elegirCodigo = (codigo: string) => setParams({ codigo });
  const elegirFecha = (fecha: string) => setParams({ fecha });

  return (
    <div className="min-h-[100dvh] bg-surface text-text-primary">
      {barraSuperior}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo size="sm" />
          <span className="text-xs text-text-muted">Consulta pública · sin registro</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-10 pt-4 sm:px-6 sm:pt-6">
        {fase === "error" && error ? (
          <EstadoDeError error={error} rutaBase={rutaBase} estado404={estado404} onReintentar={reintentar} />
        ) : ficha === null ? (
          <FichaCargando />
        ) : (
          <Contenido
            ficha={ficha}
            cargando={fase === "cargando"}
            codigoEnUrl={codigoEnUrl ?? ""}
            fechaEnUrl={fechaEnUrl ?? ""}
            onElegir={elegirCodigo}
            onBuscarCodigo={elegirCodigo}
            onBuscarFecha={elegirFecha}
          />
        )}
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-4 py-6 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
          <div>
            <Logo size="sm" />
            <p className="mt-2 text-xs text-text-muted">Trazabilidad clara, del productor a tu mesa.</p>
          </div>
          <p className="text-xs text-text-muted">Información declarada por el productor.</p>
        </div>
      </footer>
    </div>
  );
}

function EstadoDeError({
  error,
  rutaBase,
  estado404,
  onReintentar,
}: {
  error: ApiError;
  rutaBase: string;
  estado404: TextosDeEstado;
  onReintentar: () => void;
}) {
  if (error.status === 404) {
    // Not published, deleted or unknown look the same, and nothing of the product is shown.
    return <EstadoPublico icono={<IconoOjoTachado />} {...estado404} />;
  }
  if (error.status === 422) {
    return (
      <EstadoPublico
        icono={<IconoCalendarioTachado />}
        etiqueta="Búsqueda no válida"
        titulo="No pudimos usar esa búsqueda"
        descripcion={error.message}
      >
        <Link
          to={rutaBase}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          Ver la elaboración más reciente
        </Link>
      </EstadoPublico>
    );
  }
  // Network or server error: nothing partial is shown (an incomplete allergen list can mislead).
  return (
    <EstadoPublico
      icono={<IconoAlerta />}
      etiqueta="No se pudo cargar"
      titulo="No pudimos mostrar la información"
      descripcion="Hubo un problema al cargar la ficha. Mientras tanto, revisa el rotulado del envase, que es la fuente de información obligatoria."
    >
      <Button onClick={onReintentar}>Reintentar</Button>
    </EstadoPublico>
  );
}

interface ContenidoProps {
  ficha: Ficha;
  cargando: boolean;
  codigoEnUrl: string;
  fechaEnUrl: string;
  onElegir: (codigo: string) => void;
  onBuscarCodigo: (codigo: string) => void;
  onBuscarFecha: (fecha: string) => void;
}

function Contenido({ ficha, cargando, codigoEnUrl, fechaEnUrl, ...acciones }: ContenidoProps) {
  const sinElaboraciones = ficha.estado_elaboracion === "sin_elaboraciones";
  return (
    <>
      <ProductoEncabezado producto={ficha.producto} />

      {sinElaboraciones && !cargando ? (
        // Nothing to pick from: only the product identity (no recipe data).
        <EstadoPublico
          compacto
          icono={<IconoCalendarioTachado />}
          etiqueta="Sin elaboraciones"
          titulo="Todavía no hay elaboraciones disponibles"
          descripcion="El productor aún no tiene una elaboración para consultar."
        />
      ) : (
        <>
          <SelectorElaboracion
            elaboraciones={ficha.elaboraciones}
            codigoActual={cargando ? "" : (ficha.elaboracion?.codigo ?? "")}
            codigoEnUrl={codigoEnUrl}
            fechaEnUrl={fechaEnUrl}
            onElegir={acciones.onElegir}
            onBuscarCodigo={acciones.onBuscarCodigo}
            onBuscarFecha={acciones.onBuscarFecha}
          />
          {cargando ? <ElaboracionCargando /> : <AreaElaboracion ficha={ficha} />}
        </>
      )}

      <AvisoConsumidor />
    </>
  );
}

function AreaElaboracion({ ficha }: { ficha: Ficha }) {
  if (ficha.estado_elaboracion === "ok" && ficha.elaboracion) {
    const elaboracion = ficha.elaboracion;
    return (
      <>
        <ElaboracionCabecera elaboracion={elaboracion} />
        {elaboracion.version_anterior && <NotaVersionAnterior />}
        {/* Allergens first (CA5), then the detail of each supply (CA4). */}
        <AlergenosPublicos
          contiene={elaboracion.alergenos.contiene}
          puedeContener={elaboracion.alergenos.puede_contener}
        />
        <InsumosPublicos insumos={elaboracion.insumos} />
      </>
    );
  }
  if (ficha.estado_elaboracion === "varias") {
    return (
      <section aria-label="Elaboraciones de esa fecha" className="mt-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-text-primary">Hay más de una elaboración de esa fecha</h2>
        <p className="mt-1 text-sm text-text-secondary">Elige la tuya por el código impreso en el envase.</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {ficha.coincidencias.map((coincidencia) => (
            <li key={coincidencia.codigo}>
              <Link
                to={{ search: `?codigo=${encodeURIComponent(coincidencia.codigo)}` }}
                className="inline-flex min-h-11 items-center rounded-lg border border-border-strong bg-card px-4 text-sm font-medium text-text-primary hover:bg-surface"
              >
                {coincidencia.codigo} · {formatearFecha(coincidencia.fecha)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  // "no_disponible": hidden, not found or another product's look the same; nothing of any elaboración.
  return (
    <EstadoPublico
      compacto
      icono={<IconoCalendarioTachado />}
      etiqueta="Elaboración no disponible"
      titulo={MENSAJE_ELABORACION_NO_DISPONIBLE}
      descripcion="Revisa el código o la fecha impresos en el envase, o elige una elaboración de la lista."
    />
  );
}
