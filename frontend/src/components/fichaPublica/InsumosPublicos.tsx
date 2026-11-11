import { useId, useState } from "react";
import { IconoAlerta } from "@/components/fichaPublica/iconosPublicos";
import type { InsumoPublico, TipoAlergenoPublico } from "@/types/consultaPublica";

const TEXTO_TIPO: Record<TipoAlergenoPublico, string> = {
  contiene: "Contiene",
  puede_contener: "Puede contener",
};

function Flecha({ abierto }: { abierto: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-text-secondary transition-transform duration-150 motion-reduce:transition-none ${
        abierto ? "rotate-180" : ""
      }`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/** Name, brand or origin: what shows while the supply is folded. */
function Resumen({ insumo, numero }: { insumo: InsumoPublico; numero: number }) {
  return (
    <>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-accent">
        {numero}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs uppercase tracking-wide text-text-muted">{insumo.ingrediente}</span>
        <span className="block text-sm font-semibold text-text-primary">{insumo.nombre}</span>
        <span className="mt-1 block text-sm text-text-secondary">
          <span className="font-medium text-text-primary">Marca u origen:</span> {insumo.marca_origen}
        </span>
      </span>
    </>
  );
}

function InsumoTarjeta({ insumo, numero }: { insumo: InsumoPublico; numero: number }) {
  const [abierto, setAbierto] = useState(false);
  const idDetalle = useId();

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card transition-colors duration-150 hover:border-border-strong">
      {/* Every supply has the same shape: summary + arrow, so one with warnings looks like the rest. */}
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={idDetalle}
        onClick={() => setAbierto((valor) => !valor)}
        className="flex min-h-11 w-full items-start gap-3 p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <Resumen insumo={insumo} numero={numero} />
        <span className="mt-1 flex items-center gap-1 text-xs text-text-muted">
          <span className="sr-only">{abierto ? "Ocultar detalle" : "Ver detalle"}</span>
          <Flecha abierto={abierto} />
        </span>
      </button>

      {/* Allergens of this supply stay in the summary: they are what the consumer scans for. */}
      <div className="px-4 pb-3 pl-14">
        {insumo.alergenos.length > 0 ? (
          <ul aria-label={`Alérgenos de ${insumo.nombre}`} className="flex flex-wrap gap-1.5">
            {insumo.alergenos.map((alergeno) => (
              <li
                key={`${alergeno.tipo}-${alergeno.codigo}`}
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                  alergeno.tipo === "contiene"
                    ? "border-error-border bg-error-bg text-error"
                    : "border-warning-border bg-warning-bg text-warning"
                }`}
              >
                {TEXTO_TIPO[alergeno.tipo]}: {alergeno.nombre}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">Sin alérgenos declarados</p>
        )}
      </div>

      {insumo.advertencias && (
        <div className="flex items-start gap-2 border-t border-warning-border bg-warning-bg px-4 py-2.5">
          <span className="mt-0.5 shrink-0 text-warning">
            <IconoAlerta />
          </span>
          <p className="text-sm font-medium text-warning">
            <span className="sr-only">Advertencias: </span>
            {insumo.advertencias}
          </p>
        </div>
      )}

      {abierto && (
        <div id={idDetalle} className="border-t border-border px-4 py-4 sm:pl-14">
          <p className="text-sm leading-relaxed text-text-secondary">
            <span className="font-medium text-text-primary">Ingredientes declarados:</span>{" "}
            {insumo.ingredientes_declarados ?? "El productor no declaró ingredientes para este insumo."}
          </p>
        </div>
      )}
    </li>
  );
}

/** Supplies used in the elaboración (CA4). Each card always shows name, brand or origin, its allergens and its
 *  warnings; the arrow unfolds only the declared ingredients. */
export default function InsumosPublicos({ insumos }: { insumos: InsumoPublico[] }) {
  return (
    <section aria-labelledby="titulo-insumos" className="mt-6">
      <h2 id="titulo-insumos" className="text-base font-semibold text-text-primary">
        Insumos utilizados
      </h2>
      <p className="mb-3 mt-0.5 text-sm text-text-secondary">
        Productos concretos usados en esta elaboración. Toca uno para ver sus ingredientes declarados.
      </p>
      <ul className="space-y-2.5">
        {insumos.map((insumo, indice) => (
          <InsumoTarjeta key={`${insumo.ingrediente}-${insumo.nombre}`} insumo={insumo} numero={indice + 1} />
        ))}
      </ul>
    </section>
  );
}
