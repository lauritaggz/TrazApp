import { Link } from "react-router-dom";

interface BarraVistaPreviaProps {
  /** Publication state of the product; null while it is unknown (loading or failed to load). */
  publicado: boolean | null;
  /** The product's publication page. */
  volverA: string;
}

/** Bar of the productor's preview (CA10): says this is a preview, the publication state, and the way back.
 *  The consumer's public view never renders it. */
export default function BarraVistaPrevia({ publicado, volverA }: BarraVistaPreviaProps) {
  return (
    <section aria-label="Vista previa pública" className="bg-brand-800 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Vista previa pública</p>
          <p className="mt-0.5 text-xs text-white/80">
            Así verá el consumidor esta ficha. Esta barra no es visible para él.
          </p>
          {publicado !== null && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex rounded-full bg-white/15 px-2.5 py-1 font-semibold">
                {publicado ? "Publicado" : "No publicado"}
              </span>
              <span className="text-white/80">
                {publicado
                  ? "El enlace público ya muestra esta información."
                  : "El enlace público sigue «información no disponible» hasta que habilites la publicación."}
              </span>
            </p>
          )}
        </div>
        <Link
          to={volverA}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-white/40 px-4 text-sm font-medium text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Volver a la publicación
        </Link>
      </div>
    </section>
  );
}
