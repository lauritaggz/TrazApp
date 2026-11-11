import { IconoAlerta } from "@/components/fichaPublica/iconosPublicos";
import type { AlergenoGrupoPublico } from "@/types/consultaPublica";

export const TEXTO_SIN_ALERGENOS = "No se declararon alérgenos";
export const TEXTO_SIN_TRAZAS = "No se declararon trazas";

interface GrupoProps {
  titulo: string;
  items: AlergenoGrupoPublico[];
  textoVacio: string;
  /** Visual tone; the group title says the same in words, so colour is never the only cue. */
  tono: "contiene" | "trazas";
}

const ESTILOS = {
  contiene: {
    icono: "bg-error-bg text-error",
    titulo: "text-error",
    etiqueta: "bg-error-bg border-error-border text-error",
  },
  trazas: {
    icono: "bg-warning-bg text-warning",
    titulo: "text-warning",
    etiqueta: "bg-warning-bg border-warning-border text-warning",
  },
} as const;

function Grupo({ titulo, items, textoVacio, tono }: GrupoProps) {
  const estilos = ESTILOS[tono];
  return (
    <div role="group" aria-label={titulo} className="flex items-start gap-3 p-4">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${estilos.icono}`}>
        <IconoAlerta />
      </span>
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${estilos.titulo}`}>{titulo}</p>
        {items.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {items.map((alergeno) => (
              <li
                key={alergeno.codigo}
                className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${estilos.etiqueta}`}
              >
                {alergeno.nombre}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm font-medium text-text-primary">{textoVacio}</p>
        )}
      </div>
    </div>
  );
}

interface AlergenosPublicosProps {
  contiene: AlergenoGrupoPublico[];
  puedeContener: AlergenoGrupoPublico[];
}

/** Allergens of the whole elaboración in two groups (CA5). An empty list only says nothing was declared. */
export default function AlergenosPublicos({ contiene, puedeContener }: AlergenosPublicosProps) {
  return (
    <section aria-labelledby="titulo-alergenos" className="mt-6">
      <h2 id="titulo-alergenos" className="text-base font-semibold text-text-primary">
        Información de alérgenos
      </h2>
      <p className="mb-3 mt-0.5 text-sm text-text-secondary">Declaración del productor para esta elaboración.</p>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        <Grupo titulo="Contiene" items={contiene} textoVacio={TEXTO_SIN_ALERGENOS} tono="contiene" />
        <Grupo titulo="Puede contener" items={puedeContener} textoVacio={TEXTO_SIN_TRAZAS} tono="trazas" />
      </div>
    </section>
  );
}
