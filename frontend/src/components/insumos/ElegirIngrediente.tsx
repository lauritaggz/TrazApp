import Button from "@/components/ui/Button";
import type { Ingrediente } from "@/types/ingredient";
import type { IngredienteResumen } from "@/types/insumo";

interface ElegirIngredienteProps {
  /** The id of the ingredient chosen, as a string; empty if none. */
  valor: string;
  onElegir: (id: string) => void;
  ingredientes: Ingrediente[];
  /** Edit mode: the ingredient already assigned, kept as an option even if it is no longer active. */
  ingredienteActual?: IngredienteResumen | null;
  cargando?: boolean;
  error?: string;
  onReintentar?: () => void;
  /** The validation message of the field. */
  mensaje?: string;
  deshabilitado?: boolean;
  onCrear?: () => void;
}

/**
 * «Asociar a un ingrediente» (HU04, CA7): the productor's active ingredients as options of 44 px in a list with
 * a maximum height, plus «Crear ingrediente». A group of radio buttons, so the keyboard and the screen reader
 * work as in any single choice.
 */
export default function ElegirIngrediente({
  valor,
  onElegir,
  ingredientes,
  ingredienteActual = null,
  cargando = false,
  error,
  onReintentar,
  mensaje,
  deshabilitado = false,
  onCrear,
}: ElegirIngredienteProps) {
  const opciones = [...ingredientes];
  const faltaElActual = ingredienteActual != null && !opciones.some((item) => item.id === ingredienteActual.id);
  const sinIngredientes = !cargando && !error && opciones.length === 0 && !ingredienteActual;

  return (
    <div className="space-y-3">
      {cargando && <p className="text-sm text-text-secondary">Cargando ingredientes...</p>}

      <div
        role="radiogroup"
        aria-label="Ingrediente"
        aria-required="true"
        aria-invalid={mensaje ? true : undefined}
        className="max-h-64 space-y-2 overflow-y-auto pr-1"
      >
        {faltaElActual && ingredienteActual && (
          <OpcionDeIngrediente
            id={ingredienteActual.id}
            nombre={`${ingredienteActual.nombre} (desactivado)`}
            valor={valor}
            onElegir={onElegir}
            deshabilitado={deshabilitado || cargando}
          />
        )}
        {opciones.map((item) => (
          <OpcionDeIngrediente
            key={item.id}
            id={item.id}
            nombre={item.nombre}
            valor={valor}
            onElegir={onElegir}
            deshabilitado={deshabilitado || cargando}
          />
        ))}
      </div>

      {mensaje && (
        <p className="text-[13px] text-error" role="alert">
          {mensaje}
        </p>
      )}
      {error && (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-[13px] text-error">{error}</p>
          {onReintentar && (
            <Button type="button" variant="secondary" onClick={onReintentar}>
              Reintentar
            </Button>
          )}
        </div>
      )}
      {sinIngredientes && <p className="text-[13px] text-text-secondary">Aún no tienes ingredientes activos.</p>}
      {onCrear && (
        <Button type="button" variant="ghost" className="w-full px-2 sm:w-auto" onClick={onCrear} disabled={deshabilitado}>
          Crear ingrediente
        </Button>
      )}
    </div>
  );
}

function OpcionDeIngrediente({
  id,
  nombre,
  valor,
  onElegir,
  deshabilitado,
}: {
  id: number;
  nombre: string;
  valor: string;
  onElegir: (id: string) => void;
  deshabilitado: boolean;
}) {
  const elegido = valor === String(id);
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-accent ${
        elegido
          ? "border-brand-600 bg-brand-50 font-medium text-brand-700"
          : "border-border bg-card text-text-primary hover:bg-surface"
      } ${deshabilitado ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        type="radio"
        name="ingrediente_id"
        value={id}
        checked={elegido}
        onChange={() => onElegir(String(id))}
        disabled={deshabilitado}
        className="h-4 w-4 shrink-0 accent-brand-600"
      />
      {nombre}
    </label>
  );
}
