import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ElaboracionCreateDialog from "@/components/elaboraciones/ElaboracionCreateDialog";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { formatFecha } from "@/lib/elaboracionUtils";
import { listElaboraciones } from "@/services/elaboracionService";
import { getProductFormulation } from "@/services/formulationService";
import type { ElaboracionResumen } from "@/types/elaboracion";

const MAX_RECIENTES = 5;

interface ProductElaboracionesSectionProps {
  productoId: number;
  /** Changes when the formulation was saved, so the button follows it. */
  refreshKey?: number;
}

/** Latest elaboraciones of the product and the way to register a new one (HU05). */
export default function ProductElaboracionesSection({
  productoId,
  refreshKey = 0,
}: ProductElaboracionesSectionProps) {
  const navigate = useNavigate();
  const [elaboraciones, setElaboraciones] = useState<ElaboracionResumen[]>([]);
  const [tieneFormulacion, setTieneFormulacion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [formulacion, lista] = await Promise.all([
        getProductFormulation(productoId),
        listElaboraciones({ productoId }),
      ]);
      setTieneFormulacion(formulacion.existe);
      setElaboraciones(lista);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [productoId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading) {
    return <p className="text-sm text-text-secondary">Cargando elaboraciones...</p>;
  }

  if (error) {
    return (
      <div role="alert" className="space-y-2">
        <p className="text-sm font-medium text-error">No pudimos cargar las elaboraciones.</p>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const recientes = elaboraciones.slice(0, MAX_RECIENTES);

  return (
    <div className="space-y-4">
      {tieneFormulacion ? (
        <Button type="button" className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
          Registrar elaboración
        </Button>
      ) : (
        <p className="text-sm text-text-secondary">
          Define la formulación del producto para poder registrar elaboraciones.
        </p>
      )}

      {recientes.length === 0 ? (
        <p className="text-sm text-text-secondary">Aún no hay elaboraciones de este producto.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {recientes.map((item) => (
            <li key={item.id}>
              <Link
                to={
                  item.estado === "borrador"
                    ? `/elaboraciones/${item.id}/registro`
                    : `/elaboraciones/${item.id}`
                }
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface"
              >
                <span className="text-sm font-medium text-text-primary">{item.codigo}</span>
                <span className="flex items-center gap-3 text-sm text-text-secondary">
                  {formatFecha(item.fecha)}
                  {item.estado === "borrador" ? (
                    <Badge variant="warning">Borrador</Badge>
                  ) : (
                    <Badge variant="success">Finalizada</Badge>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {dialogOpen && (
        <ElaboracionCreateDialog
          productoId={productoId}
          onCreated={(creada) => navigate(`/elaboraciones/${creada.id}/registro`)}
          onCancel={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
