import { IconoInfo } from "@/components/fichaPublica/iconosPublicos";

export const TEXTO_AVISO_CONSUMIDOR =
  "Esta información no reemplaza el rotulado obligatorio del envase ni certifica que el producto sea seguro para una persona determinada. Ante alergias o dudas, revisa siempre la etiqueta y consulta al productor.";

/** Notice for the consumer (CA9). Always visible: never inside a collapsible block. */
export default function AvisoConsumidor() {
  return (
    <aside
      aria-label="Aviso al consumidor"
      className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <span className="mt-0.5 shrink-0 text-text-secondary">
        <IconoInfo />
      </span>
      <div>
        <p className="text-sm font-semibold text-text-primary">Información complementaria</p>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">{TEXTO_AVISO_CONSUMIDOR}</p>
      </div>
    </aside>
  );
}
