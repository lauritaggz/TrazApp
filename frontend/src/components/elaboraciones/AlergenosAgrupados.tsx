import Badge from "@/components/ui/Badge";
import { ROTULACION_OBLIGATORIA_AYUDA } from "@/lib/alergenos";
import type { AlergenoConsolidado } from "@/lib/alergenosResumen";

interface AlergenosAgrupadosProps {
  contiene: AlergenoConsolidado[];
  puedeContener: AlergenoConsolidado[];
  /** Text when there is no allergen at all. */
  vacio: string;
  /** Show both groups even when one is empty (the summary does; each supply does not). */
  mostrarGruposVacios?: boolean;
  /** Names the block for assistive technology when several appear on a page. */
  etiqueta: string;
}

function Grupo({
  titulo,
  items,
  etiqueta,
  mostrarVacio,
}: {
  titulo: string;
  items: AlergenoConsolidado[];
  etiqueta: string;
  mostrarVacio: boolean;
}) {
  if (items.length === 0 && !mostrarVacio) return null;
  return (
    <div role="group" aria-label={`${titulo} · ${etiqueta}`} className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{titulo}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">Ninguno</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item.alergeno_id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <span className="text-sm font-medium text-text-primary">{item.nombre}</span>
              {item.obligatorio_chile && (
                <Badge
                  variant="warning"
                  title={ROTULACION_OBLIGATORIA_AYUDA}
                  className="text-[10px] font-semibold uppercase tracking-wide"
                >
                  Rotulación obligatoria
                  <span className="sr-only">. {ROTULACION_OBLIGATORIA_AYUDA}</span>
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Allergens in two groups, "Contiene" and "Puede contener", with the mandatory-labelling tag. */
export default function AlergenosAgrupados({
  contiene,
  puedeContener,
  vacio,
  mostrarGruposVacios = false,
  etiqueta,
}: AlergenosAgrupadosProps) {
  if (contiene.length === 0 && puedeContener.length === 0) {
    return <p className="text-sm text-text-secondary">{vacio}</p>;
  }
  return (
    <div className="space-y-4">
      <Grupo titulo="Contiene" items={contiene} etiqueta={etiqueta} mostrarVacio={mostrarGruposVacios} />
      <Grupo
        titulo="Puede contener"
        items={puedeContener}
        etiqueta={etiqueta}
        mostrarVacio={mostrarGruposVacios}
      />
    </div>
  );
}
