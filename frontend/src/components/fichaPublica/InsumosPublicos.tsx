import { IconoAlerta } from "@/components/fichaPublica/iconosPublicos";
import type { InsumoPublico, TipoAlergenoPublico } from "@/types/consultaPublica";

const TEXTO_TIPO: Record<TipoAlergenoPublico, string> = {
  contiene: "Contiene",
  puede_contener: "Puede contener",
};

function InsumoTarjeta({ insumo, numero }: { insumo: InsumoPublico; numero: number }) {
  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3 p-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-accent">
          {numero}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-text-muted">{insumo.ingrediente}</p>
          <p className="text-sm font-semibold text-text-primary">{insumo.nombre}</p>
          <p className="mt-2 text-sm text-text-secondary">
            <span className="font-medium text-text-primary">Marca u origen:</span> {insumo.marca_origen}
          </p>
          {insumo.ingredientes_declarados && (
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              <span className="font-medium text-text-primary">Ingredientes declarados:</span>{" "}
              {insumo.ingredientes_declarados}
            </p>
          )}
          {insumo.alergenos.length > 0 && (
            <ul aria-label={`Alérgenos de ${insumo.nombre}`} className="mt-3 flex flex-wrap gap-1.5">
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
          )}
        </div>
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
    </li>
  );
}

/** Supplies used in the elaboración, each with brand or origin, declared ingredients, warnings and allergens (CA4). */
export default function InsumosPublicos({ insumos }: { insumos: InsumoPublico[] }) {
  return (
    <section aria-labelledby="titulo-insumos" className="mt-6">
      <h2 id="titulo-insumos" className="text-base font-semibold text-text-primary">
        Insumos utilizados
      </h2>
      <p className="mb-3 mt-0.5 text-sm text-text-secondary">Productos concretos usados en esta elaboración.</p>
      <ul className="space-y-2.5">
        {insumos.map((insumo, indice) => (
          <InsumoTarjeta key={`${insumo.ingrediente}-${insumo.nombre}`} insumo={insumo} numero={indice + 1} />
        ))}
      </ul>
    </section>
  );
}
