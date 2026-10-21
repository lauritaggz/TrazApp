import { formatFechaDeMomento } from "@/lib/elaboracionUtils";
import { esFuenteManual, nombreFuente, urlDeLaFicha } from "@/lib/fuentesInsumo";

interface OrigenInformacionProps {
  fuente: string;
  /** When the information was retrieved from the source (ISO); empty for a manual record. */
  fechaRecuperacion: string | null;
  /** The source's raw data record; its `url` is the page of the product there. */
  ficha: Record<string, unknown> | null;
}

/** Where the information of a supply comes from (HU13, CA11): typed by hand, or retrieved from a source. */
export default function OrigenInformacion({ fuente, fechaRecuperacion, ficha }: OrigenInformacionProps) {
  if (esFuenteManual(fuente)) {
    return <p className="text-sm text-text-primary">Registrado manualmente</p>;
  }

  const nombre = nombreFuente(fuente);
  const url = urlDeLaFicha(ficha);

  return (
    <div className="space-y-2">
      <p className="text-sm text-text-primary">
        {fechaRecuperacion
          ? `Obtenido de ${nombre} el ${formatFechaDeMomento(fechaRecuperacion)}`
          : `Obtenido de ${nombre}`}
      </p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-medium text-accent-strong underline-offset-2 hover:underline"
        >
          Ver la ficha en {nombre}
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      )}
      <p className="text-[13px] text-text-secondary">
        Los datos se completaron desde esa fuente y confirmaste estos datos al crear el insumo.
      </p>
    </div>
  );
}
