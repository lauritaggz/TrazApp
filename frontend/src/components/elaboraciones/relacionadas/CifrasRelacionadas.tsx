import type { Cifras } from "@/lib/relacionadas";

const CIFRAS: { clave: keyof Cifras; etiqueta: string; ayuda?: string }[] = [
  { clave: "finalizadas", etiqueta: "Finalizadas" },
  { clave: "borradores", etiqueta: "Borradores" },
  { clave: "deProductosPublicados", etiqueta: "De productos publicados" },
  { clave: "ocultas", etiqueta: "Ocultas" },
  {
    clave: "visiblesAlPublico",
    etiqueta: "Visibles al público",
    ayuda: "Finalizadas de un producto publicado y que no están ocultas",
  },
];

/** The five numbers of the result. Two columns on a phone (the last one takes the whole row), one row from `md`. */
export default function CifrasRelacionadas({ cifras }: { cifras: Cifras }) {
  return (
    <div
      role="group"
      aria-label="Resumen del resultado"
      className="grid grid-cols-2 gap-3 md:grid-cols-5"
    >
      {CIFRAS.map(({ clave, etiqueta, ayuda }, indice) => (
        <div
          key={clave}
          title={ayuda}
          className={`min-w-0 rounded-xl border border-border bg-card p-3 ${
            indice === CIFRAS.length - 1 ? "col-span-2 md:col-span-1" : ""
          }`}
        >
          <p className="text-2xl font-semibold tabular-nums text-text-primary">{cifras[clave]}</p>
          <p className="mt-0.5 text-xs leading-snug text-text-secondary">{etiqueta}</p>
        </div>
      ))}
    </div>
  );
}
