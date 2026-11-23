import { useCallback, useEffect, useState } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { formatFecha } from "@/lib/elaboracionUtils";
import { TEXTO_SIN_RESPUESTAS, textoPorcentaje, textoRespuestas } from "@/lib/evaluacionTexto";
import { obtenerResultadosEvaluacion } from "@/services/evaluacionService";
import type { ResultadosEvaluacion } from "@/types/product";

/**
 * «Evaluación de utilidad» of one product (HU11, T11-03): the share of positive answers and how many
 * answers it rests on, and the breakdown by elaboración. It loads on its own, so an error here shows
 * its own message and «Reintentar» without breaking the rest of the page.
 */
export default function EvaluacionUtilidadCard({ productoId }: { productoId: number }) {
  const [resultados, setResultados] = useState<ResultadosEvaluacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setResultados(await obtenerResultadosEvaluacion(productoId));
    } catch {
      setResultados(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [productoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const porcentaje = resultados ? textoPorcentaje(resultados) : null;

  return (
    <section aria-labelledby="evaluacion-utilidad" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 id="evaluacion-utilidad" className="text-sm font-semibold text-text-primary">
          Evaluación de utilidad
        </h2>
        <p className="mt-0.5 text-[13px] text-text-secondary">
          Respuestas anónimas de quienes consultaron la ficha: «¿Esta información te resultó útil?».
        </p>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {loading && <p className="text-sm text-text-secondary" aria-live="polite">Cargando evaluaciones...</p>}

        {!loading && error && (
          <Alert type="error">
            <p>No pudimos cargar las evaluaciones. Revisa tu conexión e inténtalo de nuevo.</p>
            <Button type="button" variant="secondary" className="mt-3" onClick={() => void cargar()}>
              Reintentar
            </Button>
          </Alert>
        )}

        {!loading && resultados && (
          <>
            {porcentaje === null ? (
              <p className="text-sm text-text-secondary">{TEXTO_SIN_RESPUESTAS}</p>
            ) : (
              <p className="flex flex-wrap items-baseline gap-x-2 text-text-primary">
                <span className="text-2xl font-semibold">{porcentaje}</span>
                <span className="text-sm text-text-secondary">
                  de respuestas positivas · {textoRespuestas(resultados.total)}
                </span>
              </p>
            )}

            {resultados.por_elaboracion.length > 0 && (
              <table className="w-full text-left text-[13px]">
                <caption className="sr-only">Evaluación por elaboración</caption>
                <thead className="text-text-secondary">
                  <tr>
                    <th scope="col" className="py-2 pr-2 font-medium">Elaboración</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Fecha</th>
                    <th scope="col" className="py-2 pr-2 text-right font-medium">Positivas</th>
                    <th scope="col" className="py-2 text-right font-medium">Respuestas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-text-primary">
                  {resultados.por_elaboracion.map((fila) => (
                    <tr key={`${fila.codigo}-${fila.fecha}`}>
                      <th scope="row" className="break-all py-2.5 pr-2 font-mono font-semibold">{fila.codigo}</th>
                      <td className="py-2.5 pr-2">{formatFecha(fila.fecha)}</td>
                      <td className="py-2.5 pr-2 text-right">{textoPorcentaje(fila)}</td>
                      <td className="py-2.5 text-right">{fila.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </section>
  );
}
