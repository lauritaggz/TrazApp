import { useEffect, useState, type ReactNode } from "react";
import { CapasIcon, CheckIcon, LapizIcon } from "@/components/elaboraciones/historial/iconos";
import { listElaboraciones } from "@/services/elaboracionService";

interface Cifras {
  totales: number | null;
  finalizadas: number | null;
  borradores: number | null;
}

/**
 * Totals of the productor's elaboraciones: all, finalizadas and drafts. They do NOT follow the filters
 * of the list: they are the whole picture, asked once (three pages of one row and their `total`).
 * The count of what the filters found is the list's own.
 */
export default function HistorialCifras() {
  const [cifras, setCifras] = useState<Cifras | null>(null);

  useEffect(() => {
    let vigente = true;
    const total = (estado?: "finalizada" | "borrador") =>
      listElaboraciones({ ...(estado ? { estado } : {}), limit: 1 }).then(
        (pagina) => pagina.total,
        () => null,
      );
    void Promise.all([total(), total("finalizada"), total("borrador")]).then(
      ([totales, finalizadas, borradores]) => {
        if (vigente) setCifras({ totales, finalizadas, borradores });
      },
    );
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <div role="group" aria-label="Resumen de elaboraciones" className="grid grid-cols-3 gap-3">
      <Cifra etiqueta="Elaboraciones totales" valor={cifras?.totales} cargando={cifras === null} icono={<CapasIcon />} />
      <Cifra etiqueta="Finalizadas" valor={cifras?.finalizadas} cargando={cifras === null} tono="positivo" icono={<CheckIcon />} />
      <Cifra etiqueta="En borrador" valor={cifras?.borradores} cargando={cifras === null} icono={<LapizIcon />} />
    </div>
  );
}

function Cifra({
  etiqueta,
  valor,
  cargando,
  tono = "normal",
  icono,
}: {
  etiqueta: string;
  valor: number | null | undefined;
  cargando: boolean;
  tono?: "normal" | "positivo";
  icono: ReactNode;
}): ReactNode {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p
            className="text-2xl font-semibold text-text-primary"
            aria-live={cargando ? "polite" : undefined}
          >
            {cargando || valor === null || valor === undefined ? "—" : valor}
          </p>
          <p className="mt-1 text-xs leading-snug text-text-secondary">{etiqueta}</p>
        </div>
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            tono === "positivo" ? "bg-success-bg text-success" : "bg-brand-50 text-accent"
          }`}
        >
          {icono}
        </span>
      </div>
    </div>
  );
}
