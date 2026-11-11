import { Link } from "react-router-dom";

const ESTILO_BOTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

interface AccionesFichaPublicaProps {
  productoId: number;
  publicado: boolean;
  urlPublica: string | null | undefined;
}

/** «Vista previa pública» (always) and «Comprobar ficha pública» (only while published and with a link). */
export default function AccionesFichaPublica({ productoId, publicado, urlPublica }: AccionesFichaPublicaProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link to={`/publicaciones/${productoId}/vista-previa`} className={ESTILO_BOTON}>
        Vista previa pública
      </Link>
      {publicado && urlPublica && (
        <a href={urlPublica} target="_blank" rel="noopener noreferrer" className={ESTILO_BOTON}>
          Comprobar ficha pública
          <span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
      )}
    </div>
  );
}
