import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AvisoAmbar from "@/components/elaboraciones/relacionadas/AvisoAmbar";
import FilaRelacionada from "@/components/elaboraciones/relacionadas/FilaRelacionada";
import ProductDetailSection from "@/components/products/ProductDetailSection";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { useElaboracionesRelacionadas } from "@/hooks/useElaboracionesRelacionadas";
import { avisoSinLoteDelInsumo, opcionesDeLotes, rutaRastrear } from "@/lib/relacionadas";
import { listLotesInsumo } from "@/services/elaboracionService";
import type { LoteInsumo } from "@/types/elaboracion";
import type { ElaboracionesDeInsumo } from "@/types/relacionadas";

/** How many of the most recent elaboraciones the supply detail shows; the rest are one link away. */
export const RECIENTES_EN_EL_DETALLE = 5;

const ENLACE =
  "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-accent-strong underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/**
 * «Uso reciente en elaboraciones» of the supply detail (HU08): the totals and the notice of the elaboraciones
 * without lot ALWAYS on top, the most recent ones, a link to all of them and a link per lot. A failure stays in
 * this section (with «Reintentar») and does not touch the rest of the detail.
 */
export default function SeccionUsoInsumo({ insumoId }: { insumoId: number }) {
  const { estado, recargar } = useElaboracionesRelacionadas(insumoId, null);
  const [lotes, setLotes] = useState<LoteInsumo[]>([]);

  useEffect(() => {
    let vigente = true;
    listLotesInsumo(insumoId).then(
      (lista) => {
        if (vigente) setLotes(Array.isArray(lista) ? lista : []);
      },
      () => {
        // Without the lots only their links are missing.
      },
    );
    return () => {
      vigente = false;
    };
  }, [insumoId]);

  return (
    <ProductDetailSection
      id="insumo-detail-uso"
      title="Uso reciente en elaboraciones"
      description="Elaboraciones donde se usó este insumo y con qué lote."
    >
      {estado.fase === "cargando" && (
        <p className="text-sm text-text-secondary" aria-live="polite">
          Cargando elaboraciones...
        </p>
      )}

      {(estado.fase === "error" || estado.fase === "no_encontrado") && (
        <Alert type="error">
          <p>No pudimos cargar las elaboraciones. Revisa tu conexión e inténtalo de nuevo.</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={recargar}>
            Reintentar
          </Button>
        </Alert>
      )}

      {estado.fase === "ok" && (
        <Contenido datos={estado.datos as ElaboracionesDeInsumo} insumoId={insumoId} lotes={lotes} />
      )}
    </ProductDetailSection>
  );
}

function Contenido({
  datos,
  insumoId,
  lotes,
}: {
  datos: ElaboracionesDeInsumo;
  insumoId: number;
  lotes: LoteInsumo[];
}) {
  const { resumen, elaboraciones, insumo } = datos;
  if (resumen.total_elaboraciones === 0) {
    return <p className="text-sm text-text-secondary">Este insumo no se ha usado en ninguna elaboración</p>;
  }
  const aviso = avisoSinLoteDelInsumo(resumen.elaboraciones_sin_lote);
  const opciones = opcionesDeLotes(lotes);
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-text-primary">
        {resumen.total_elaboraciones} {resumen.total_elaboraciones === 1 ? "elaboración" : "elaboraciones"}:{" "}
        {resumen.finalizadas} {resumen.finalizadas === 1 ? "finalizada" : "finalizadas"} y {resumen.borradores}{" "}
        {resumen.borradores === 1 ? "borrador" : "borradores"}
      </p>
      {aviso && <AvisoAmbar>{aviso}</AvisoAmbar>}

      <ul
        aria-label="Elaboraciones más recientes"
        className="divide-y divide-border overflow-hidden rounded-xl border border-border"
      >
        {elaboraciones.slice(0, RECIENTES_EN_EL_DETALLE).map((elaboracion) => (
          <FilaRelacionada key={elaboracion.id} elaboracion={elaboracion} insumoNombre={insumo.nombre} />
        ))}
      </ul>

      <Link to={rutaRastrear(insumoId)} className={ENLACE}>
        Ver las {resumen.total_elaboraciones} {resumen.total_elaboraciones === 1 ? "elaboración" : "elaboraciones"} y
        buscar por lote
      </Link>

      {opciones.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-secondary">Consultar por lote</p>
          <ul aria-label="Lotes del insumo" className="mt-1 flex flex-wrap gap-x-1">
            {opciones.map((opcion) => (
              <li key={opcion.id}>
                <Link to={rutaRastrear(insumoId, opcion.id)} className={ENLACE}>
                  {opcion.codigo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
