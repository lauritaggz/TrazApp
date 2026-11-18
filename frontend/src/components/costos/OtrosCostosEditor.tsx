import { PlusIcon, TrashIcon } from "@/components/costos/iconosCostos";
import { Input } from "@/components/ui/Input";
import {
  MAX_OTROS_COSTOS,
  NOMBRE_OTRO_COSTO_MAX,
  type BorradorOtroCosto,
  type ErroresBorrador,
} from "@/lib/costosCalculadora";

interface OtrosCostosEditorProps {
  otros: BorradorOtroCosto[];
  errores: ErroresBorrador;
  onAgregar: () => void;
  onCambiar: (clave: number, cambios: { nombre?: string; monto?: string }) => void;
  onQuitar: (clave: number) => void;
}

/** Tarjeta «Otros costos por tanda»: lo que cuesta la tanda y no es un ingrediente. Se guarda con las cantidades. */
export default function OtrosCostosEditor({ otros, errores, onAgregar, onCambiar, onQuitar }: OtrosCostosEditorProps) {
  return (
    <section
      aria-labelledby="costos-otros"
      className="overflow-hidden rounded-xl border border-border bg-card shadow-soft"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 id="costos-otros" className="text-sm font-semibold text-text-primary">
            Otros costos por tanda
          </h2>
          <p className="mt-0.5 text-xs text-text-secondary">Agrega energía, envases u otros costos directos.</p>
        </div>
        <button
          type="button"
          disabled={otros.length >= MAX_OTROS_COSTOS}
          onClick={onAgregar}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-accent hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlusIcon />
          Agregar{" "}
          <span className="sr-only">otro costo</span>
        </button>
      </div>

      {otros.length === 0 ? (
        <p className="px-4 py-4 text-sm text-text-secondary sm:px-5">No has agregado otros costos.</p>
      ) : (
        <ul className="divide-y divide-border">
          {otros.map((otro, indice) => {
            const e = errores.otros[otro.clave];
            return (
              <li key={otro.clave} className="flex items-start gap-3 p-4 sm:px-5">
                <div className="min-w-0 flex-1">
                  <Input
                    label="Nombre"
                    aria-label={`Nombre del otro costo ${indice + 1}`}
                    id={`otro-${otro.clave}-nombre`}
                    type="text"
                    placeholder="Ej. Envases"
                    maxLength={NOMBRE_OTRO_COSTO_MAX + 20}
                    autoComplete="off"
                    value={otro.nombre}
                    error={e?.nombre}
                    onChange={(ev) => onCambiar(otro.clave, { nombre: ev.target.value })}
                  />
                </div>
                <div className="w-32 shrink-0">
                  <Input
                    label="Monto"
                    aria-label={`Monto del otro costo ${indice + 1}`}
                    id={`otro-${otro.clave}-monto`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    leftIcon={<span className="text-sm">$</span>}
                    value={otro.monto}
                    error={e?.monto}
                    onChange={(ev) => onCambiar(otro.clave, { monto: ev.target.value })}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Quitar el otro costo ${indice + 1}`}
                  onClick={() => onQuitar(otro.clave)}
                  className="mt-[1.625rem] inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-error hover:bg-error-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
                >
                  <TrashIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {errores.otrosExceso && (
        <p role="alert" className="px-4 pb-4 text-sm font-medium text-error sm:px-5">
          {errores.otrosExceso}
        </p>
      )}
    </section>
  );
}
